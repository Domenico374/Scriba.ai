import { MODELLI, MODELLO_PREDEFINITO } from '../lib/modelli.js';

// Elenco dei modelli per la pagina: nome, descrizione e vocabolario, non le regole.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    predefinito: MODELLO_PREDEFINITO,
    modelli: Object.entries(MODELLI).map(([id, { nome, descrizione, vocabolario }]) => ({ id, nome, descrizione, vocabolario })),
  });
}
