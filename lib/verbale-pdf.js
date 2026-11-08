// Costruisce il PDF del verbale dagli stessi dati del Word e con gli stessi valori di stile.
// Le misure sono in punti: quelle del Word in twip diventano punti dividendo per 20.
// Il carattere è Caladea, che ha le stesse metriche di Cambria.
// Ente, organo, apertura, ordine del giorno e chiusura vuoti vengono omessi, come nel Word.
import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { intestazione } from './verbale-docx.js';

const BLU = '#1B2A41';
const GRIGIO = '#4A4A4A';
const TESTO = '#222222';
const TENUE = '#7F7F7F';
const FILETTO = '#BFBFBF';
const FONDO = '#F4F4F4';

const PAGINA_ALTEZZA = 841.89;
const MARGINE = 56.7;
const LARGHEZZA = 481.9;
const FONDO_PAGINA = PAGINA_ALTEZZA - MARGINE;
const INTERLINEA_TESTO = 1.35;
const INTERLINEA_TABELLA = 1.27;
const INTERLINEA_SINGOLA = 1.17;
const RAPPORTO_MAIUSCOLETTO = 0.8;
const RISALITA = 0.9;

const leggiFont = (nome) => readFileSync(new URL(`./fonts/Caladea-${nome}.ttf`, import.meta.url));
const FONT_DI = (bold, italics) => (bold ? (italics ? 'BoldItalic' : 'Bold') : italics ? 'Italic' : 'Regular');

// Spezza il testo in parole fatte di segmenti, perché una parola può cambiare stile a metà.
function parole(testo, stile) {
  const out = [];
  let corrente = null;
  for (const parte of testo.split(/(\*\*.+?\*\*)/).filter(Boolean)) {
    const grassetto = parte.startsWith('**') && parte.endsWith('**');
    const contenuto = grassetto ? parte.slice(2, -2) : parte;
    for (const pezzo of contenuto.split(/(\s+)/).filter(Boolean)) {
      if (/^\s+$/.test(pezzo)) {
        corrente = null;
        continue;
      }
      if (!corrente) out.push((corrente = []));
      corrente.push(...segmenti(pezzo, grassetto ? { ...stile, bold: true } : stile));
    }
  }
  return out;
}

function segmenti(parola, stile) {
  if (!stile.smallCaps) return [{ t: parola, stile }];
  return parola
    .split(/(\p{Ll}+)/u)
    .filter(Boolean)
    .map((pezzo) => (/\p{Ll}/u.test(pezzo)
      ? { t: pezzo.toUpperCase(), stile: { ...stile, size: stile.size * RAPPORTO_MAIUSCOLETTO } }
      : { t: pezzo, stile }));
}

export async function creaPdf(v) {
  const regolare = leggiFont('Regular');
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    font: regolare,
    margin: 0,
    info: { Title: v.sottotitolo },
  });
  for (const nome of ['Regular', 'Bold', 'Italic', 'BoldItalic']) {
    doc.registerFont(nome, nome === 'Regular' ? regolare : leggiFont(nome));
  }
  const pezzi = [];
  doc.on('data', (pezzo) => pezzi.push(pezzo));
  const fine = new Promise((ok) => doc.on('end', () => ok(Buffer.concat(pezzi))));

  let y = MARGINE;

  const applica = ({ bold, italics, size, color }) =>
    doc.font(FONT_DI(bold, italics)).fontSize(size).fillColor(color ?? TESTO);
  const misura = (segmento) =>
    applica(segmento.stile).widthOfString(segmento.t, { characterSpacing: segmento.stile.spaziatura ?? 0 });
  const larghezzaParola = (parola) => parola.reduce((somma, s) => somma + misura(s), 0);

  // Va a capo a misura di colonna e restituisce le righe.
  function componi(testo, stile, larghezza) {
    const spazio = applica(stile).widthOfString(' ');
    const righe = [];
    let riga = { parole: [], piena: 0 };
    for (const parola of parole(testo, stile)) {
      const w = larghezzaParola(parola);
      const conSpazio = riga.parole.length ? riga.piena + spazio + w : w;
      if (riga.parole.length && conSpazio > larghezza) {
        righe.push(riga);
        riga = { parole: [{ parola, w }], piena: w };
      } else {
        riga.parole.push({ parola, w });
        riga.piena = conSpazio;
      }
    }
    if (riga.parole.length) righe.push(riga);
    return { righe, spazio };
  }

  function disegnaRiga(riga, x, yRiga, larghezza, spazio, allineamento) {
    const vuoti = riga.parole.length - 1;
    const extra = allineamento === 'giustificato' && vuoti ? (larghezza - riga.piena) / vuoti : 0;
    let cursore = allineamento === 'destra' ? x + larghezza - riga.piena
      : allineamento === 'centro' ? x + (larghezza - riga.piena) / 2 : x;
    const alto = Math.max(...riga.parole.flatMap(({ parola }) => parola.map((s) => s.stile.size)));
    for (const { parola, w } of riga.parole) {
      let xParola = cursore;
      for (const s of parola) {
        const wSegmento = misura(s);
        applica(s.stile);
        // I segmenti più piccoli si appoggiano sulla stessa linea di base di quelli grandi.
        const base = yRiga + (alto - s.stile.size) * RISALITA;
        doc.text(s.t, xParola, base, { lineBreak: false, characterSpacing: s.stile.spaziatura ?? 0 });
        xParola += wSegmento;
      }
      cursore += w + spazio + extra;
    }
  }

  function nuovaPagina() {
    doc.addPage();
    y = MARGINE;
  }
  const assicura = (altezza) => {
    if (y + altezza > FONDO_PAGINA) nuovaPagina();
  };

  function paragrafo(testo, stile, { x = MARGINE, larghezza = LARGHEZZA, allineamento = 'sinistra', interlinea = INTERLINEA_TESTO, tieni = 0 } = {}) {
    const { righe, spazio } = componi(testo, stile, larghezza);
    const passo = stile.size * interlinea;
    assicura(passo + tieni);
    righe.forEach((riga, i) => {
      assicura(passo);
      const ultima = i === righe.length - 1;
      disegnaRiga(riga, x, y, larghezza, spazio, ultima && allineamento === 'giustificato' ? 'sinistra' : allineamento);
      y += passo;
    });
  }

  function altezzaTesto(testo, stile, larghezza, interlinea) {
    return componi(testo, stile, larghezza).righe.length * stile.size * interlinea;
  }

  const riga = (x1, x2, yLinea, colore, spessore) =>
    doc.moveTo(x1, yLinea).lineTo(x2, yLinea).lineWidth(spessore).strokeColor(colore).stroke();

  const STILE_TITOLO_RIQUADRO = { bold: true, smallCaps: true, color: BLU, spaziatura: 0.5, size: 10 };

  function riquadro(titolo, voci, stileVoce, marcatore) {
    const x = MARGINE + 11;
    const larghezza = LARGHEZZA - 22;
    const rientro = 21;
    const passo = stileVoce.size * INTERLINEA_TESTO;
    const altezzaVoci = voci.map((v) => altezzaTesto(v, stileVoce, larghezza - rientro, INTERLINEA_TESTO) + 3.5);
    const totale = 7 + 15 + altezzaVoci.reduce((a, b) => a + b, 0) + 5;
    if (totale <= FONDO_PAGINA - MARGINE) assicura(totale);
    else assicura(7 + 15 + passo * 2);

    riga(MARGINE, MARGINE + LARGHEZZA, y, BLU, 0.75);
    y += 7;
    paragrafo(titolo, STILE_TITOLO_RIQUADRO, { x, larghezza, interlinea: INTERLINEA_SINGOLA });
    y += 4;
    voci.forEach((voce, i) => {
      assicura(passo);
      const { righe, spazio } = componi(voce, stileVoce, larghezza - rientro);
      applica({ ...stileVoce, color: BLU });
      doc.text(marcatore(i), x + rientro - 14, y, { lineBreak: false });
      righe.forEach((r, j) => {
        assicura(passo);
        const allineamento = stileVoce.giustifica && j < righe.length - 1 ? 'giustificato' : 'sinistra';
        disegnaRiga(r, x + rientro, y, larghezza - rientro, spazio, allineamento);
        y += passo;
      });
      y += 3.5;
    });
    y += 5;
    riga(MARGINE, MARGINE + LARGHEZZA, y, BLU, 0.75);
  }

  function elenco(voci) {
    const stile = { size: 11, color: TESTO };
    const passo = stile.size * INTERLINEA_TESTO;
    const x = MARGINE + 21;
    const larghezza = LARGHEZZA - 21;
    for (const voce of voci) {
      const { righe, spazio } = componi(voce, stile, larghezza);
      assicura(passo);
      applica({ ...stile, color: BLU });
      doc.text('–', MARGINE + 7, y, { lineBreak: false });
      righe.forEach((r, i) => {
        assicura(passo);
        disegnaRiga(r, x, y, larghezza, spazio, i < righe.length - 1 ? 'giustificato' : 'sinistra');
        y += passo;
      });
      y += 3.5;
    }
  }

  function tabellaInfo(righe) {
    const colonna = 130;
    const stileEtichetta = { bold: true, color: BLU, size: 10.5 };
    const stileValore = { color: TESTO, size: 10.5 };
    for (const { etichetta, valore } of righe) {
      const larghezzaValore = LARGHEZZA - colonna - 16;
      const altezza = Math.max(
        altezzaTesto(etichetta, stileEtichetta, colonna - 14, INTERLINEA_SINGOLA),
        altezzaTesto(valore, stileValore, larghezzaValore, INTERLINEA_SINGOLA),
      ) + 9;
      doc.rect(MARGINE, y, colonna, altezza).fill(FONDO);
      const inizio = y;
      y = inizio + 4.5;
      paragrafo(etichetta, stileEtichetta, { x: MARGINE + 8, larghezza: colonna - 14, interlinea: INTERLINEA_SINGOLA });
      y = inizio + 4.5;
      paragrafo(valore, stileValore, { x: MARGINE + colonna + 10, larghezza: larghezzaValore, interlinea: INTERLINEA_SINGOLA });
      y = inizio + altezza;
      riga(MARGINE, MARGINE + LARGHEZZA, y, FILETTO, 0.5);
    }
  }

  function larghezzeColonne(n) {
    if (n === 3) return [62.5, 150, 269.4];
    return Array.from({ length: n }, () => LARGHEZZA / n);
  }

  function tabellaDati(intestazioni, righe) {
    const colonne = larghezzeColonne(intestazioni.length);
    const interne = colonne.map((c) => c - 12);
    const stileIntestazione = { bold: true, color: BLU, size: 10 };
    const stileCella = (i) => ({ bold: i === 0, color: TESTO, size: 10 });

    const disegnaRiga_ = (celle, stileDi, fondo) => {
      const altezza = Math.max(...celle.map((c, i) => altezzaTesto(c, stileDi(i), interne[i], INTERLINEA_TABELLA))) + 9;
      const inizio = y;
      if (fondo) doc.rect(MARGINE, inizio, LARGHEZZA, altezza).fill(FONDO);
      let x = MARGINE;
      celle.forEach((cella, i) => {
        y = inizio + 4;
        paragrafo(cella, stileDi(i), { x: x + 6, larghezza: interne[i], interlinea: INTERLINEA_TABELLA });
        x += colonne[i];
      });
      y = inizio + altezza;
      riga(MARGINE, MARGINE + LARGHEZZA, y, FILETTO, 0.5);
    };
    const altezzaRiga = (celle, stileDi) =>
      Math.max(...celle.map((c, i) => altezzaTesto(c, stileDi(i), interne[i], INTERLINEA_TABELLA))) + 9;
    const intestazione = () => disegnaRiga_(intestazioni, () => stileIntestazione, true);

    assicura(altezzaRiga(intestazioni, () => stileIntestazione) + 30);
    intestazione();
    for (const dati of righe) {
      const celle = intestazioni.map((_, i) => dati[i] ?? '');
      if (y + altezzaRiga(celle, stileCella) > FONDO_PAGINA) {
        nuovaPagina();
        intestazione();
      }
      disegnaRiga_(celle, stileCella, false);
    }
  }

  function sezione(numero, { titolo, blocchi }) {
    y += 16;
    const stile = { bold: true, smallCaps: true, color: BLU, spaziatura: 0.5, size: 12 };
    paragrafo(`${numero}.  ${titolo}`, stile, { interlinea: INTERLINEA_SINGOLA, tieni: 45 });
    y += 4;
    riga(MARGINE, MARGINE + LARGHEZZA, y, FILETTO, 0.5);
    y += 7;
    let precedente = null;
    for (const blocco of blocchi) {
      switch (blocco.tipo) {
        case 'sottotitolo':
          y += 8;
          paragrafo(blocco.testo, { bold: true, italics: true, color: BLU, size: 11 }, { tieni: 20 });
          y += 4;
          break;
        case 'paragrafo':
        case 'nota':
          if (precedente === 'riquadro') y += 6;
          paragrafo(
            blocco.testo,
            blocco.tipo === 'nota' ? { italics: true, color: GRIGIO, size: 11 } : { color: TESTO, size: 11 },
            { allineamento: 'giustificato' },
          );
          y += 6;
          break;
        case 'elenco':
          elenco(blocco.voci);
          break;
        case 'riquadro':
          y += 3;
          riquadro(blocco.titolo, blocco.voci, { color: TESTO, size: 11, giustifica: true }, () => '–');
          y += 3;
          break;
        case 'tabella':
          tabellaDati(blocco.intestazioni, blocco.righe);
          y += 6;
          break;
        default:
          throw new Error(`Blocco sconosciuto: ${blocco.tipo}`);
      }
      precedente = blocco.tipo;
    }
  }

  function firma() {
    const x = MARGINE + 280;
    const larghezza = LARGHEZZA - 280;
    const opzioni = { x, larghezza, interlinea: INTERLINEA_SINGOLA };
    paragrafo(v.firma.ruolo, { italics: true, color: GRIGIO, size: 10.5 }, opzioni);
    y += 3;
    paragrafo(v.firma.nome, { bold: true, color: BLU, size: 11 }, opzioni);
    y += 28;
    riga(x, x + larghezza, y, GRIGIO, 0.5);
    y += 4;
    paragrafo('(firma)', { italics: true, color: TENUE, size: 8.5 }, opzioni);
    if (v.firma.perConto || v.ente) y += 12;
    for (const testo of [v.firma.perConto, v.ente].filter(Boolean)) paragrafo(testo, { color: GRIGIO, size: 9.5 }, opzioni);
  }

  function intestazioniPagine() {
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i += 1) {
      doc.switchToPage(i);
      const destra = (testo, stile, yTesto) => {
        applica(stile);
        doc.text(testo, MARGINE + LARGHEZZA - doc.widthOfString(testo), yTesto, { lineBreak: false });
      };
      destra(intestazione(v), { italics: true, color: TENUE, size: 8.5 }, 35.4);
      const yPiede = PAGINA_ALTEZZA - 35.4 - 10;
      riga(MARGINE, MARGINE + LARGHEZZA, yPiede - 6, FILETTO, 0.5);
      applica({ color: TENUE, size: 8.5 });
      if (v.ente) doc.text(v.ente, MARGINE, yPiede, { lineBreak: false });
      destra(`Pag. ${i + 1} di ${count}`, { color: TENUE, size: 8.5 }, yPiede);
    }
  }

  // Intestazione del verbale
  if (v.ente) {
    paragrafo(v.ente, { smallCaps: true, color: GRIGIO, spaziatura: 1, size: 11 }, { allineamento: 'centro', interlinea: INTERLINEA_SINGOLA });
    y += 4;
  }
  paragrafo(v.sottotitolo, { italics: true, color: GRIGIO, size: 11.5 }, { allineamento: 'centro', interlinea: INTERLINEA_SINGOLA });
  y += 10;
  riga(MARGINE, MARGINE + LARGHEZZA, y, BLU, 0.75);
  riga(MARGINE, MARGINE + LARGHEZZA, y + 2, BLU, 0.75);
  y += 16;

  tabellaInfo(v.informazioni);
  y += 17;
  if (v.apertura) {
    paragrafo(v.apertura, { italics: true, color: GRIGIO, size: 11 }, { allineamento: 'giustificato' });
    y += 10;
  }
  if (v.ordineDelGiorno.voci.length) {
    riquadro(v.ordineDelGiorno.titolo, v.ordineDelGiorno.voci, { color: TESTO, size: 10.5 }, (i) => `${i + 1}.`);
  }

  v.sezioni.forEach((s, i) => sezione(i + 1, s));

  y += 5;
  const altezzaChiusura = altezzaTesto(v.chiusura, { italics: true, color: GRIGIO, size: 11 }, LARGHEZZA, INTERLINEA_TESTO);
  assicura(altezzaChiusura + 140);
  if (v.chiusura) {
    paragrafo(v.chiusura, { italics: true, color: GRIGIO, size: 11 }, { allineamento: 'giustificato' });
    y += 18;
  } else {
    y += 24;
  }
  firma();

  intestazioniPagine();
  doc.end();
  return fine;
}
