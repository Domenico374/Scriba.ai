// Prepara una registrazione per la trascrizione, tutto nel browser:
// la decodifica, la porta a 16 kHz mono e la divide in pezzi WAV di circa due minuti,
// tagliando nei momenti di silenzio per non spezzare le parole.
const FREQUENZA = 16000;
const DURATA_PEZZO = 120;
const FINESTRA_TAGLIO = 15;
const FRAME = FREQUENZA / 50;
const SOGLIA_SILENZIO = 0.004;

async function decodifica(file) {
  const dati = await file.arrayBuffer();
  const Contesto = window.AudioContext || window.webkitAudioContext;
  let contesto;
  try {
    contesto = new Contesto({ sampleRate: FREQUENZA });
  } catch {
    contesto = new Contesto();
  }
  try {
    return await contesto.decodeAudioData(dati);
  } catch {
    throw new Error('Non riesco a leggere questa registrazione. Prova con un file MP3, M4A o WAV.');
  } finally {
    contesto.close?.();
  }
}

// Mono a 16 kHz in interi a 16 bit: occupa un quarto della memoria di un AudioBuffer stereo.
function monoSedici(buffer) {
  const canali = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const passo = buffer.sampleRate / FREQUENZA;
  const lunghezza = Math.floor(buffer.length / passo);
  const uscita = new Int16Array(lunghezza);
  for (let i = 0; i < lunghezza; i += 1) {
    const inizio = Math.floor(i * passo);
    const fine = Math.max(inizio + 1, Math.floor((i + 1) * passo));
    let somma = 0;
    for (const canale of canali) for (let j = inizio; j < fine; j += 1) somma += canale[j];
    const valore = somma / (canali.length * (fine - inizio));
    uscita[i] = Math.max(-32768, Math.min(32767, Math.round(valore * 32767)));
  }
  return uscita;
}

function energia(campioni, inizio, fine) {
  let somma = 0;
  for (let i = inizio; i < fine; i += 1) somma += (campioni[i] / 32768) ** 2;
  return Math.sqrt(somma / Math.max(1, fine - inizio));
}

// Dove tagliare: il frame più silenzioso negli ultimi secondi del pezzo.
function puntoDiTaglio(campioni, inizio) {
  const limite = inizio + DURATA_PEZZO * FREQUENZA;
  if (limite >= campioni.length) return campioni.length;
  let migliore = limite;
  let minima = Infinity;
  for (let f = limite - FINESTRA_TAGLIO * FREQUENZA; f + FRAME <= limite; f += FRAME) {
    const e = energia(campioni, f, f + FRAME);
    if (e < minima) {
      minima = e;
      migliore = f + FRAME / 2;
    }
  }
  return Math.floor(migliore);
}

function silenzioso(campioni, inizio, fine) {
  for (let f = inizio; f + FRAME <= fine; f += FRAME * 5) {
    if (energia(campioni, f, f + FRAME) > SOGLIA_SILENZIO) return false;
  }
  return true;
}

export function wav(campioni) {
  const intestazione = new DataView(new ArrayBuffer(44));
  const scrivi = (pos, testo) => [...testo].forEach((c, i) => intestazione.setUint8(pos + i, c.charCodeAt(0)));
  scrivi(0, 'RIFF');
  intestazione.setUint32(4, 36 + campioni.byteLength, true);
  scrivi(8, 'WAVE');
  scrivi(12, 'fmt ');
  intestazione.setUint32(16, 16, true);
  intestazione.setUint16(20, 1, true);
  intestazione.setUint16(22, 1, true);
  intestazione.setUint32(24, FREQUENZA, true);
  intestazione.setUint32(28, FREQUENZA * 2, true);
  intestazione.setUint16(32, 2, true);
  intestazione.setUint16(34, 16, true);
  scrivi(36, 'data');
  intestazione.setUint32(40, campioni.byteLength, true);
  return new Blob([intestazione, campioni], { type: 'application/octet-stream' });
}

// Restituisce la durata in secondi e i pezzi da trascrivere, senza quelli di solo silenzio.
export async function preparaRegistrazione(file) {
  const campioni = monoSedici(await decodifica(file));
  const pezzi = [];
  for (let inizio = 0; inizio < campioni.length;) {
    const fine = puntoDiTaglio(campioni, inizio);
    if (!silenzioso(campioni, inizio, fine)) pezzi.push(campioni.subarray(inizio, fine));
    inizio = fine;
  }
  return { durata: campioni.length / FREQUENZA, pezzi };
}
