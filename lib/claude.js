// Trasforma la trascrizione, la bozza o il PDF nei dati strutturati del verbale.
import Anthropic from '@anthropic-ai/sdk';
import { MODELLI, MODELLO_PREDEFINITO } from './modelli.js';

const testo = { type: 'string' };
const lista = { type: 'array', items: testo };
const oggetto = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const SCHEMA = oggetto({
  ente: testo,
  sottotitolo: testo,
  organo: testo,
  informazioni: { type: 'array', items: oggetto({ etichetta: testo, valore: testo }) },
  apertura: testo,
  ordineDelGiorno: oggetto({ titolo: testo, voci: lista }),
  sezioni: {
    type: 'array',
    items: oggetto({
      titolo: testo,
      blocchi: {
        type: 'array',
        items: oggetto({
          tipo: { type: 'string', enum: ['paragrafo', 'nota', 'sottotitolo', 'elenco', 'riquadro', 'tabella'] },
          testo,
          titolo: testo,
          voci: lista,
          intestazioni: lista,
          righe: { type: 'array', items: lista },
        }),
      },
    }),
  },
  chiusura: testo,
  firma: oggetto({ ruolo: testo, nome: testo, perConto: testo }),
  puntiDaControllare: { type: 'array', items: oggetto({ argomento: testo, nota: testo }) },
  nomeFile: testo,
});

const ETICHETTE_DATI = {
  ente: 'Organizzazione',
  organo: 'Organo o gruppo che si riunisce',
  data: 'Data della riunione',
  oggetto: 'Oggetto',
  partecipanti: 'Partecipanti',
  redattore: 'Redattore del verbale',
};

function istruzioniSistema(idModello, aggiuntive) {
  const modello = MODELLI[idModello] ?? MODELLI[MODELLO_PREDEFINITO];
  if (!aggiuntive?.trim()) return modello.istruzioni;
  return `${modello.istruzioni}

Preferenze del redattore, da seguire quando non contrastano con le regole di contenuto:
${aggiuntive.trim()}`;
}

function datiForniti(dati = {}) {
  const righe = Object.entries(ETICHETTE_DATI)
    .filter(([chiave]) => String(dati[chiave] ?? '').trim())
    .map(([chiave, etichetta]) => `${etichetta}: ${String(dati[chiave]).trim()}`);
  return righe.length ? `<dati_della_riunione>\n${righe.join('\n')}\n</dati_della_riunione>\n\n` : '';
}

// documento: { testo } oppure { pdf } con il PDF in base64.
export async function generaDati({ documento, modello, istruzioniAggiuntive, dati }, client = new Anthropic()) {
  const premessa = datiForniti(dati);
  const content = documento.pdf
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: documento.pdf } },
        { type: 'text', text: `${premessa}Il documento da verbalizzare è il PDF allegato.` },
      ]
    : `${premessa}<documento>\n${documento.testo}\n</documento>`;

  const stream = client.beta.messages.stream({
    model: process.env.MODELLO || 'claude-opus-5-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    system: istruzioniSistema(modello, istruzioniAggiuntive),
    messages: [{ role: 'user', content }],
  });
  const risposta = await stream.finalMessage();
  if (risposta.stop_reason === 'refusal') throw new Error('Il modello ha rifiutato il documento.');
  if (risposta.stop_reason === 'max_tokens') throw new Error('Il verbale è troppo lungo e si è interrotto.');
  const blocco = risposta.content.find((b) => b.type === 'text');
  if (!blocco) throw new Error('Il modello non ha restituito il verbale.');
  return JSON.parse(blocco.text);
}
