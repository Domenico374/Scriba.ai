// Trascrive un pezzo di registrazione con OpenAI.
// La pagina divide l'audio in pezzi WAV di circa due minuti, così ognuno resta sotto il limite di Vercel (4,5 MB).
import { codiceValido } from '../lib/accesso.js';

const MASSIMO_PEZZO = 4.4 * 1024 * 1024;

async function leggiCorpo(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'binary');
  const pezzi = [];
  for await (const pezzo of req) pezzi.push(pezzo);
  return Buffer.concat(pezzi);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errore: 'Metodo non consentito.' });
  if (!codiceValido(req.headers['x-codice'])) return res.status(401).json({ errore: 'Codice di accesso errato.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ errore: 'La trascrizione audio non è configurata.' });

  try {
    const audio = await leggiCorpo(req);
    if (!audio.length) return res.status(400).json({ errore: 'Pezzo di audio vuoto.' });
    if (audio.length > MASSIMO_PEZZO) return res.status(413).json({ errore: 'Pezzo di audio troppo grande.' });

    const modulo = new FormData();
    modulo.append('file', new Blob([audio], { type: 'audio/wav' }), 'pezzo.wav');
    modulo.append('model', process.env.MODELLO_TRASCRIZIONE || 'gpt-4o-transcribe');
    modulo.append('language', 'it');
    modulo.append('response_format', 'json');
    // Nomi propri e parole ricorrenti della riunione, perché la trascrizione li scriva bene.
    const vocabolario = decodeURIComponent(req.headers['x-vocabolario'] ?? '').slice(0, 800);
    if (vocabolario) modulo.append('prompt', vocabolario);

    const risposta = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: modulo,
    });
    if (!risposta.ok) {
      console.error('OpenAI', risposta.status, (await risposta.text()).slice(0, 300));
      return res.status(502).json({ errore: 'Trascrizione non riuscita. Riprova tra poco.' });
    }
    const { text } = await risposta.json();
    return res.status(200).json({ testo: text ?? '' });
  } catch (errore) {
    console.error(errore?.message);
    return res.status(500).json({ errore: 'Trascrizione non riuscita. Riprova tra poco.' });
  }
}
