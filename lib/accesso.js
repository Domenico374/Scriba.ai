import { createHash, timingSafeEqual } from 'node:crypto';

const hash = (valore) => createHash('sha256').update(String(valore)).digest();

// Senza la variabile CODICE_ACCESSO la pagina rifiuta tutti.
export function codiceValido(codice) {
  const atteso = process.env.CODICE_ACCESSO;
  return Boolean(atteso) && typeof codice === 'string' && timingSafeEqual(hash(codice), hash(atteso));
}
