// Costruisce il Word del verbale a partire dai dati strutturati.
// Tutti i valori di stile sono ricavati dal verbale del 22 ottobre 2026.
// Ente, organo, apertura, ordine del giorno e chiusura vuoti vengono omessi.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const FONT = 'Cambria';
const BLU = '1B2A41';
const GRIGIO = '4A4A4A';
const TESTO = '222222';
const TENUE = '7F7F7F';
const FILETTO = 'BFBFBF';
const FONDO = 'F4F4F4';
const LARGHEZZA = 9638;

const NESSUNO = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const SENZA_BORDI_TABELLA = {
  top: NESSUNO, bottom: NESSUNO, left: NESSUNO, right: NESSUNO,
  insideHorizontal: NESSUNO, insideVertical: NESSUNO,
};
const BORDI_RIGA = {
  top: NESSUNO, left: NESSUNO, right: NESSUNO,
  bottom: { style: BorderStyle.SINGLE, size: 4, color: FILETTO },
};
const BORDI_RIQUADRO = {
  left: NESSUNO, right: NESSUNO,
  top: { style: BorderStyle.SINGLE, size: 6, color: BLU },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: BLU },
};

function run(text, opzioni = {}) {
  return new TextRun({ text, font: FONT, ...opzioni });
}

// Il testo può contenere **grassetto**: il resto segue lo stile di base.
function runs(testo, base) {
  return testo
    .split(/(\*\*.+?\*\*)/)
    .filter(Boolean)
    .map((parte) => {
      const grassetto = parte.startsWith('**') && parte.endsWith('**');
      return run(grassetto ? parte.slice(2, -2) : parte, grassetto ? { ...base, bold: true } : base);
    });
}

function spazio(after) {
  return new Paragraph({ spacing: { after } });
}

function titoloRiquadro(testo) {
  return new Paragraph({
    keepNext: true,
    spacing: { after: 80 },
    children: [run(testo, { bold: true, smallCaps: true, color: BLU, characterSpacing: 10, size: 20 })],
  });
}

function voceTrattino(testo) {
  return new Paragraph({
    style: 'ListParagraph',
    numbering: { reference: 'trattini', level: 0 },
    spacing: { after: 70, line: 276 },
    alignment: AlignmentType.BOTH,
    children: runs(testo, { color: TESTO, size: 22 }),
  });
}

function riquadro(contenuto) {
  return new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: [LARGHEZZA],
    borders: SENZA_BORDI_TABELLA,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: LARGHEZZA, type: WidthType.DXA },
            borders: BORDI_RIQUADRO,
            margins: { top: 140, left: 220, bottom: 100, right: 220 },
            children: contenuto,
          }),
        ],
      }),
    ],
  });
}

function ordineDelGiorno(titolo, voci) {
  return riquadro([
    titoloRiquadro(titolo),
    ...voci.map((voce) =>
      new Paragraph({
        style: 'ListParagraph',
        numbering: { reference: 'numeri', level: 0 },
        spacing: { after: 70, line: 276 },
        children: runs(voce, { color: TESTO, size: 21 }),
      }),
    ),
  ]);
}

function tabellaInfo(righe) {
  const colonne = [2600, LARGHEZZA - 2600];
  return new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: colonne,
    borders: SENZA_BORDI_TABELLA,
    rows: righe.map(({ etichetta, valore }) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: colonne[0], type: WidthType.DXA },
            borders: BORDI_RIGA,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: FONDO },
            margins: { top: 90, left: 160, bottom: 90, right: 120 },
            children: [new Paragraph({ children: [run(etichetta, { bold: true, color: BLU, size: 21 })] })],
          }),
          new TableCell({
            width: { size: colonne[1], type: WidthType.DXA },
            borders: BORDI_RIGA,
            margins: { top: 90, left: 200, bottom: 90, right: 120 },
            children: [new Paragraph({ children: [run(valore, { color: TESTO, size: 21 })] })],
          }),
        ],
      }),
    ),
  });
}

function larghezzeColonne(n) {
  if (n === 3) return [1250, 3000, 5388];
  const base = Math.floor(LARGHEZZA / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? LARGHEZZA - base * (n - 1) : base));
}

function tabellaDati(intestazioni, righe) {
  const colonne = larghezzeColonne(intestazioni.length);
  const cella = (contenuto, i, opzioni, fondo) =>
    new TableCell({
      width: { size: colonne[i], type: WidthType.DXA },
      borders: BORDI_RIGA,
      ...(fondo ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: FONDO } } : {}),
      margins: { top: 80, left: 120, bottom: 80, right: 120 },
      children: [new Paragraph({ spacing: { after: 20, line: 260 }, children: runs(contenuto, opzioni) })],
    });
  return new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: colonne,
    borders: SENZA_BORDI_TABELLA,
    rows: [
      new TableRow({
        tableHeader: true,
        children: intestazioni.map((t, i) => cella(t, i, { bold: true, color: BLU, size: 20 }, true)),
      }),
      ...righe.map((riga) =>
        new TableRow({
          cantSplit: true,
          children: intestazioni.map((_, i) =>
            cella(riga[i] ?? '', i, { ...(i === 0 ? { bold: true } : {}), color: TESTO, size: 20 }, false),
          ),
        }),
      ),
    ],
  });
}

function sezione(numero, { titolo, blocchi }) {
  const out = [
    new Paragraph({
      keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: FILETTO, space: 4 } },
      spacing: { before: 320, after: 140 },
      children: [run(`${numero}.  ${titolo}`, { bold: true, smallCaps: true, color: BLU, characterSpacing: 10, size: 24 })],
    }),
  ];
  let precedente = null;
  for (const [i, blocco] of blocchi.entries()) {
    switch (blocco.tipo) {
      case 'sottotitolo':
        out.push(new Paragraph({
          keepNext: true,
          spacing: { before: 160, after: 80 },
          children: [run(blocco.testo, { bold: true, italics: true, color: BLU, size: 22 })],
        }));
        break;
      case 'paragrafo':
      case 'nota':
        out.push(new Paragraph({
          keepNext: blocchi[i + 1]?.tipo === 'tabella',
          spacing: { before: precedente === 'riquadro' ? 120 : 0, after: 120, line: 276 },
          alignment: AlignmentType.BOTH,
          children: runs(
            blocco.testo,
            blocco.tipo === 'nota' ? { italics: true, color: GRIGIO, size: 22 } : { color: TESTO, size: 22 },
          ),
        }));
        break;
      case 'elenco':
        out.push(...blocco.voci.map(voceTrattino));
        break;
      case 'riquadro':
        if (precedente !== 'tabella') out.push(spazio(60));
        out.push(riquadro([titoloRiquadro(blocco.titolo), ...blocco.voci.map(voceTrattino)]));
        break;
      case 'tabella':
        out.push(tabellaDati(blocco.intestazioni, blocco.righe), spazio(60));
        break;
      default:
        throw new Error(`Blocco sconosciuto: ${blocco.tipo}`);
    }
    precedente = blocco.tipo;
  }
  return out;
}

function firma({ ente, firma: { ruolo, nome, perConto } }) {
  const riga = (opzioni, testo, stile) =>
    new Paragraph({ keepNext: true, indent: { left: 5600 }, ...opzioni, children: [run(testo, stile)] });
  return [
    riga({ spacing: { after: 60 } }, ruolo, { italics: true, color: GRIGIO, size: 21 }),
    riga({ spacing: { after: 560 } }, nome, { bold: true, color: BLU, size: 22 }),
    riga(
      { spacing: { after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRIGIO, space: 4 } } },
      '(firma)',
      { italics: true, color: TENUE, size: 17 },
    ),
    ...[perConto, ente].filter(Boolean).map((testo, i, righe) =>
      riga({ spacing: { before: i === 0 ? 200 : 0, after: 0 }, keepNext: i < righe.length - 1 }, testo, { color: GRIGIO, size: 19 })),
  ];
}

export const intestazione = (v) => (v.organo ? `${v.organo} – Verbale riunione` : 'Verbale riunione');

export async function creaVerbale(v) {
  const piccolo = { font: FONT, color: TENUE, size: 17 };
  const documento = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [{ id: 'ListParagraph', name: 'List Paragraph', basedOn: 'Normal', quickFormat: true }],
    },
    numbering: {
      config: [
        {
          reference: 'trattini',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 280 } }, run: { color: BLU } },
          }],
        },
        {
          reference: 'numeri',
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 320 } }, run: { color: BLU } },
          }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 708, footer: 708 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [run(intestazione(v), { italics: true, color: TENUE, size: 17 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: FILETTO, space: 6 } },
            tabStops: [{ type: TabStopType.RIGHT, position: LARGHEZZA }],
            children: [
              new TextRun({ text: v.ente, ...piccolo }),
              new TextRun({ ...piccolo, children: [new Tab(), 'Pag. ', PageNumber.CURRENT, ' di ', PageNumber.TOTAL_PAGES] }),
            ],
          })],
        }),
      },
      children: [
        ...(v.ente ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [run(v.ente, { smallCaps: true, color: GRIGIO, characterSpacing: 20, size: 22 })],
        })] : []),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: BLU, space: 10 } },
          spacing: { after: 280 },
          children: [run(v.sottotitolo, { italics: true, color: GRIGIO, size: 23 })],
        }),
        tabellaInfo(v.informazioni),
        spazio(200),
        ...(v.apertura ? [new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { before: 0, after: 200, line: 276 },
          children: runs(v.apertura, { italics: true, color: GRIGIO, size: 22 }),
        })] : []),
        ...(v.ordineDelGiorno.voci.length ? [ordineDelGiorno(v.ordineDelGiorno.titolo, v.ordineDelGiorno.voci)] : []),
        ...v.sezioni.flatMap((s, i) => sezione(i + 1, s)),
        spazio(100),
        new Paragraph({
          keepNext: true,
          alignment: AlignmentType.BOTH,
          spacing: { before: 0, after: 360, line: 276 },
          children: runs(v.chiusura, { italics: true, color: GRIGIO, size: 22 }),
        }),
        ...firma(v),
      ],
    }],
  });
  return Packer.toBuffer(documento);
}
