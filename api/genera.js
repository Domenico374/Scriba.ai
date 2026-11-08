import mammoth from 'mammoth';
import { codiceValido } from '../lib/accesso.js';
import { generaDati } from '../lib/claude.js';
import { MODELLI } from '../lib/modelli.js';
import { creaVerbale } from '../lib/verbale-docx.js';
import { creaPdf } from '../lib/verbale-pdf.js';

const MASSIMO_ISTRUZIONI = 4000;

async function leggiDocumento({ testo, file, nomeFile }) {
  if (testo?.trim()) return { testo };
  if (!file) return { testo: '' };
  if (/\.pdf$/i.test(nomeFile ?? '')) return { pdf: file };
  const contenuto = Buffer.from(file, 'base64');
  if (/\.docx$/i.test(nomeFile ?? '')) {
    return { testo: (await mammoth.extractRawText({ buffer: contenuto })).value };
  }
  return { testo: contenuto.toString('utf8') };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errore: 'Metodo non consentito.' });
  if (!codiceValido(req.body?.codice)) return res.status(401).json({ errore: 'Codice di accesso errato.' });

  const { modello, istruzioniAggiuntive = '', dati = {} } = req.body;
  if (!MODELLI[modello]) return res.status(400).json({ errore: 'Modello di verbale sconosciuto.' });
  if (String(istruzioniAggiuntive).length > MASSIMO_ISTRUZIONI) {
    return res.status(400).json({ errore: `Le istruzioni aggiuntive superano i ${MASSIMO_ISTRUZIONI} caratteri.` });
  }

  try {
    const documento = await leggiDocumento(req.body);
    if (!documento.pdf && !documento.testo.trim()) return res.status(400).json({ errore: 'Il documento è vuoto.' });

    const verbale = await generaDati({ documento, modello, istruzioniAggiuntive: String(istruzioniAggiuntive), dati });
    const [word, pdf] = await Promise.all([creaVerbale(verbale), creaPdf(verbale)]);
    return res.status(200).json({
      nomeFile: verbale.nomeFile,
      word: word.toString('base64'),
      pdf: pdf.toString('base64'),
      puntiDaControllare: verbale.puntiDaControllare,
    });
  } catch (errore) {
    console.error(errore?.message);
    return res.status(500).json({ errore: 'Generazione non riuscita. Riprova tra poco.' });
  }
}
