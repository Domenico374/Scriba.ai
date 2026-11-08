# Scriba

**Dalla registrazione o dagli appunti al verbale in Word e PDF.**

Scriba trasforma una riunione in un verbale formale, pronto da firmare e condividere.
Si carica la registrazione, la trascrizione o una bozza: Scriba la riordina per argomenti, mette in evidenza decisioni e compiti e restituisce un documento impaginato in Word e in PDF.

Pensato per comitati, associazioni, assemblee e gruppi di lavoro.

## Cosa fa

- **Trascrive le registrazioni**: MP3, M4A, WAV, video MP4 e altri formati, anche di riunioni lunghe. La trascrizione si può rileggere e correggere prima di generare il verbale.
- **Legge documenti e appunti**: Word (.docx), PDF, testo (.txt) o testo incollato.
- **Scrive il verbale**: partecipanti, ordine del giorno, discussione per punti, riquadri con le decisioni, tabella delle azioni con responsabili e scadenze, prossimo incontro.
- **Non inventa**: quando qualcosa non si capisce sceglie l'ipotesi più prudente e la segnala nei **punti da controllare**, da verificare prima di diffondere il verbale.
- **Si adatta a chi lo usa**:
  - *Verbale*: verbale formale in italiano istituzionale;
  - *Riunione generica*: per associazioni, aziende, condomini e gruppi di lavoro;
  - *I miei modelli*: istruzioni proprie salvate con un nome, ad esempio "Assemblea di condominio".
- **Accesso riservato**: la pagina funziona solo con un codice di accesso. Registrazioni e documenti non vengono salvati sul sito.

## Come si usa

1. Si apre la pagina e si inserisce il codice di accesso.
2. Si sceglie il tipo di verbale.
3. Se si vuole, si compilano i dati della riunione (organizzazione, data, partecipanti, redattore): aiutano a ridurre gli errori.
4. Si carica la registrazione, il documento o il testo.
5. Si scaricano il Word e il PDF e si controllano i punti segnalati.

---

## Per chi gestisce il sito

### Pubblicazione su Vercel

Il progetto Vercel collegato a questo repository pubblica il sito a ogni modifica del ramo `main`.
In Settings > Environment Variables servono:

- `ANTHROPIC_API_KEY`: la chiave di Claude (console.anthropic.com), con un limite di spesa mensile.
- `CODICE_ACCESSO`: il codice da dare a chi usa la pagina. Senza questa variabile la pagina rifiuta tutti.
- `OPENAI_API_KEY`: la chiave OpenAI (platform.openai.com), solo per le registrazioni, anche lì con un limite di spesa. Senza questa chiave il resto funziona, ma la trascrizione no.
- `MODELLO` (facoltativa): il modello Claude. Se manca si usa `claude-opus-5-5`; per spendere meno, `claude-sonnet-5-5`.
- `MODELLO_TRASCRIZIONE` (facoltativa): se manca si usa `gpt-4o-transcribe` (circa 0,36 USD per ora di audio); `gpt-4o-mini-transcribe` costa la metà.

Dopo aver cambiato le variabili serve un nuovo Deploy. Non scrivere mai le chiavi in un file del repository.

### Dove cambiare le cose

- `lib/modelli.js`: i tipi di verbale e le loro regole di redazione. Per aggiungere un tipo fisso si aggiunge una voce.
- `lib/claude.js`: la struttura dei dati del verbale e la chiamata a Claude.
- `lib/verbale-docx.js` e `lib/verbale-pdf.js`: impaginazione del Word e del PDF. Se cambi lo stile, aggiorna entrambi i file.
- `public/index.html`: la pagina.
- `public/audio.js`: preparazione della registrazione nel browser (16 kHz mono, pezzi di circa due minuti tagliati nei silenzi).
- `api/genera.js`: controllo del codice, lettura del documento e creazione di Word e PDF.
- `api/trascrivi.js`: trascrizione di un pezzo di registrazione con OpenAI.
- `api/modelli.js`: elenco dei tipi di verbale per la pagina.

### Limiti

- La registrazione viene preparata nel browser: per riunioni oltre le due ore conviene usare un computer, dal telefono potrebbe mancare la memoria.
- I modelli personalizzati restano solo nel browser di chi li crea.
- Documenti fino a 3 MB, registrazioni fino a 500 MB.

Scriba è la nuova versione di MemoAI e riunisce MemoAI e Generatore verbali.
