# CantiereSmart — Rapportini Giornalieri di Cantiere
### Impresa Vittorini Emidio Costruzioni S.r.l. — L'Aquila

> **Applicazione Web Progressiva (PWA) Mobile Offline-First** per la compilazione rapida, certificata e professionale dei rapportini giornalieri di cantiere, con esportazione a doppia copia: **PDF fedele al template istituzionale** e **Word (.docx) completamente modificabile**.

---

## Indice dei Contenuti
1. [Caratteristiche Principali](#caratteristiche-principali)
2. [Come Avviare l'App](#come-avviare-lapp)
   - [Avvio in Locale (PC / Mac)](#avvio-in-locale-pc--mac)
   - [Distribuzione su Server o Rete Aziendale (LAN / Wi-Fi)](#distribuzione-su-server-o-rete-aziendale-lan--wi-fi)
3. [Guida all'Installazione su Smartphone](#guida-allinstallazione-su-smartphone)
   - [Installazione su iPhone (iOS Safari)](#installazione-su-iphone-ios-safari)
   - [Installazione su Android (Google Chrome)](#installazione-su-android-google-chrome)
4. [Guida all'Uso Rapido dei 9 Box](#guida-alluso-rapido-dei-9-box)
   - [La Logica della Spunta Verde](#la-logica-della-spunta-verde)
   - [Compilazione in meno di 2 Minuti](#compilazione-in-meno-di-2-minuti)
   - [Dettaglio dei 9 Box Operativi](#dettaglio-dei-9-box-operativi)
   - [Dettatura Vocale da Smartphone](#dettatura-vocale-da-smartphone)
   - [Scatto e Compressione Foto da Fotocamera](#scatto-e-compressione-foto-da-fotocamera)
5. [Gestione dei Promemoria (11:55 e 16:55)](#gestione-dei-promemoria-1155-e-1655)
6. [Download, Condivisione e Modifica File](#download-condivisione-e-modifica-file)
   - [Esportazione PDF Istituzionale](#esportazione-pdf-istituzionale)
   - [Esportazione Word (.docx) Modificabile](#esportazione-word-docx-modificabile)
   - [Invio Diretto su WhatsApp ed Email](#invio-diretto-su-whatsapp-ed-email)
7. [Menu Sandwich, Rubrica e Backup](#menu-sandwich-rubrica-e-backup)
8. [Verifica e Test E2E Automatizzati](#verifica-e-test-e2e-automatizzati)

---

## Caratteristiche Principali

- 🏗️ **100% Offline-First (Zero CDN Esterne)**: Funziona in pieno cantiere montano o sotterraneo senza connessione internet né segnale cellulare. Tutti i fogli di stile, font, icone vettoriali e librerie (jsPDF, fflate, docx) sono inclusi localmente nel Service Worker.
- ⏱️ **Compilazione Flash (< 2 Minuti)**: Interfaccia suddivisa in 9 box operativi ad alta visibilità, ottimizzata per touch target generosi (minimo 48-52px) utilizzabili anche con guanti da lavoro.
- 🟢 **Spunta Verde Reattiva**: Feedback visivo immediato con contatore `0/9` ➔ `✓ 9/9 completati` e bordo verde smeraldo su ogni sezione compilata o confermata.
- ⚡ **Tasti Rapidi "Nessuno / N.A."**: Per cantieri con attività parziali, un tocco sul tasto dedicato convalida istantaneamente il box senza digitazione.
- 🔔 **Promemoria Automatici di Cantiere**: Notifiche preconfigurate alle ore **11:55** (pausa pranzo) e **16:55** (fine turno) dal Lunedì al Venerdì.
- 📄 **Esportazione Doppia**:
  - **PDF Ufficiale Vittorini**: Rigorosamente conforme alla geometria del `Template.pdf` (1 pagina per 0-4 foto, 2 pagine per 5-8 foto, doppia cornice blu `#4A86E8` / `#C9DAF8`, testata con logo e footer d'impresa).
  - **Word DOCX Modificabile**: Documento standard OpenXML compatibile con Microsoft Word e Office 365 per smartphone o PC desktop.
- 🏷️ **Nomenclatura Rigorosa Automatica**: I file generati vengono nominati secondo lo standard: `YYYY-MM-DD_NomeCantiere.pdf` e `YYYY-MM-DD_NomeCantiere.docx`.

---

## Come Avviare l'App

L'applicazione è composta da file statici moderni (HTML5, CSS3, ES6) e non richiede server backend o database esterni; necessita solo di essere servita tramite protocollo `http://` o `https://` per abilitare il Service Worker PWA.

### Avvio in Locale (PC / Mac)

Dalla cartella `cantieresmart`, avviare un server HTTP locale con uno dei seguenti comandi:

#### Opzione A: Con Node.js (Consigliata)
```bash
# Avvio immediato con npx serve
npx serve . -p 8080
```
oppure con `http-server`:
```bash
npx http-server -p 8080 -c-1
```

#### Opzione B: Con Python 3
```bash
python -m http.server 8080
```

Aprire il browser su: `http://localhost:8080`

---

### Distribuzione su Server o Rete Aziendale (LAN / Wi-Fi)

Per consentire ai geometri e assistenti di cantiere di collegarsi direttamente dal proprio smartphone in cantiere o in ufficio:

1. **Indirizzo IP Locale**: Individuare l'indirizzo IP del computer server sulla rete (es. `192.168.1.150`).
2. **Accesso da Smartphone**: Collegare il telefono alla stessa rete Wi-Fi e digitare nel browser:
   ```
   http://192.168.1.150:8080
   ```
3. **Distribuzione Web Aziendale (HTTPS)**: Copiare l'intero contenuto della cartella `cantieresmart` su qualsiasi hosting web o server interno (Nginx, Apache, IIS, Netlify, Vercel, Cloudflare Pages, S3). Il Service Worker e le notifiche push richiedono HTTPS in produzione (su `localhost` funzionano nativamente anche in HTTP).

---

## Guida all'Installazione su Smartphone

Trasforma il sito web in una vera e propria **Applicazione Autonoma a Schermo Intero** con icona ufficiale Vittorini, senza le barre del browser.

### Installazione su iPhone (iOS Safari)

> [!IMPORTANT]
> Su iPhone, l'installazione PWA deve essere eseguita esclusivamente tramite il browser **Safari**.

1. **Apri Safari** e naviga all'indirizzo dell'app (es. `https://rapportini.vittorinicostruzioni.it` o `http://192.168.1.xxx:8080`).
2. Tocca l'icona **"Condividi"** nella barra inferiore di Safari (il quadrato con la freccia rivolta verso l'alto `⬆️`).
3. Scorri il foglio delle azioni verso il basso e seleziona **"Aggiungi alla schermata Home"** (icona con il segno `➕`).
4. Conferma o modifica il nome in **"Rapportini"** e tocca **"Aggiungi"** in alto a destra.
5. Sulla schermata Home del tuo iPhone comparirà l'icona con il logo Vittorini: toccala per avviare l'app a pieno schermo, senza barra degli indirizzi o pulsanti del browser. L'app funziona anche in **modalità aereo**!

---

### Installazione su Android (Google Chrome)

1. **Apri Google Chrome** e collegati all'indirizzo dell'applicazione.
2. In basso comparirà automaticamente il banner **"Aggiungi Rapportini a schermata Home"** o **"Installa app"**.
3. Se il banner non compare, tocca i **tre puntini verticali `⋮`** in alto a destra.
4. Tocca **"Installa applicazione"** o **"Aggiungi a schermata Home"**.
5. Conferma toccando **"Installa"**.
6. L'app viene installata tra le tue applicazioni Android, accessibile dal drawer delle app e dalla schermata principale.

---

## Guida all'Uso Rapido dei 9 Box

L'applicazione guida l'operatore attraverso **9 sezioni logiche** dotate di rilevamento dello stato.

### La Logica della Spunta Verde

- **Badge Giallo "Da compilare"**: Indica che il box attende informazioni o la conferma di assenza attività.
- **Badge Verde "✓ Completato" + Bordo Smeraldo**: Si attiva non appena il box contiene i dati minimi necessari o è stato confermato con il tasto rapido.
- **Header Progressivo**: In alto a destra il contatore aggiorna in tempo reale l'avanzamento da `0 / 9 completati` fino al traguardo `✓ 9 / 9 completati`.
- **Barra Azioni Inferiore**: Quando tutti i 9 box sono verdi, il banner inferiore mostra `✓ Tutti i 9 box completati` e i pulsanti **"Scarica PDF"** e **"Scarica Word (.docx)"** sono immediatamente pronti per la condivisione.

---

### Compilazione in meno di 2 Minuti

Per una compilazione fulminea a fine giornata:
1. Seleziona il cantiere (i campi Località e Commessa si autocompilano).
2. Tocca il meteo (`SERENO`, `NUVOLOSO`, `PIOGGIA` o `NEVE`).
3. Dettate a voce le lavorazioni principali.
4. Tocca i chip con i nomi degli operai presenti.
5. Se non ci sono subappalti, noleggi o materiali arrivati, tocca semplicemente i pulsanti **"Nessun subappaltatore"**, **"Nessun noleggio"**, **"Nessun materiale oggi"** e **"Nessuna nota"**.
6. Scatta 2 o 3 foto dal vivo.
7. Tocca **"Scarica PDF"** o **"Scarica Word"** e inoltra su WhatsApp!

---

### Dettaglio dei 9 Box Operativi

| N° | Box | Contenuto e Comportamento | Tasto Rapido |
|:---:|:---|:---|:---:|
| **1** | **Data & Cantiere** | Data del giorno (preimpostata odierna), nome cantiere con autocompletamento intelligente da rubrica Vittorini. Selezionando un cantiere noto, Località e Rif. Commessa si autocompilano. Scrivendo un nome nuovo, l'app lo memorizza automaticamente per i giorni successivi. | — |
| **2** | **Meteo & Clima** | 4 pulsanti one-tap ad alto contrasto (`SERENO`, `NUVOLOSO`, `PIOGGIA`, `NEVE`) e stepper touch per la temperatura (predefinita `22°C`, regolabile con i tasti `+` e `−`). | — |
| **3** | **Lavorazioni Eseguite** | Descrizione delle lavorazioni svolte nel corso della giornata lavorativa. | **"Nessuna attività oggi"** |
| **4** | **Personale Vittorini** | Chip touch con i nominativi del personale d'impresa (Marco Rossi, Giuseppe Esposito, ecc.). Un tocco seleziona/deseleziona l'operaio. Include campo ricerca per aggiungere al volo operai non in elenco e contatore automatico dei presenti. | **"0 Operai Vittorini"** |
| **5** | **Subappaltatori** | Registrazione delle ditte terze in cantiere: nome ditta (con suggerimenti da rubrica), numero di operai e tipo di lavorazione. Calcolo automatico della somma di operai subappalto e del personale totale di cantiere. | **"Nessun subappaltatore"** |
| **6** | **Noleggi & Mezzi** | Selezione rapida dei macchinari e attrezzature a nolo (Escavatore 50q, Piattaforma aerea, Gru, ecc.) o inserimento manuale. | **"Nessun noleggio"** |
| **7** | **Forniture & Materiali** | Quantità e tipologia dei materiali consegnati in cantiere (calcestruzzo m³, ferro kg, malta sacchi, ecc.). | **"Nessun materiale oggi"** |
| **8** | **Note Generali & D.L.** | Comunicazioni della Direzione Lavori, visite ispettive, ordini di servizio, verifiche di sicurezza POS o prelievo provini di calcestruzzo. | **"Nessuna nota"** |
| **9** | **Foto di Cantiere** | Da 0 a 8 foto ad alta definizione. Scatto diretto da fotocamera o caricamento da galleria con compressione ottica automatica. | **"Nessuna foto oggi"** |

---

### Dettatura Vocale da Smartphone

> [!TIP]
> Nei box **3. Lavorazioni Eseguite** e **8. Note Generali & D.L.** non è necessario digitare sulla tastiera con le dita impolverate:
> 1. Tocca l'area di testo.
> 2. Sulla tastiera dello smartphone (iOS o Android), tocca l'icona del **Microfono** `🎙️`.
> 3. Parla con voce naturale: *"Oggi abbiamo completato l'armatura della trave rovescia e gettato 18 metri cubi di calcestruzzo. Visita della Direzione Lavori alle ore undici senza rilievi."*
> 4. Il testo verrà trascritto all'istante con punteggiatura e massima accuratezza.

---

### Scatto e Compressione Foto da Fotocamera

- Toccare **"+ Scatta / Aggiungi Foto"** apre direttamente la fotocamera posteriore dello smartphone (`capture="environment"`).
- L'app effettua la **compressione istantanea tramite HTML5 Canvas**: le immagini vengono ridimensionate a max 1280px con qualità JPEG ottimizzata, riducendo le dimensioni da 8-12 MB a circa 250-400 KB ciascuna.
- Questo garantisce:
  - Generazione istantanea del PDF e del file Word senza blocchi di memoria.
  - File finali leggeri, ideali per essere inviati su **WhatsApp o per Email anche con connessione dati lenta**.
- Limite massimo: **8 foto per rapportino**, visualizzate in anteprima con numerazione progressiva `#1..#8` e pulsante di rimozione immediata.

---

## Gestione dei Promemoria (11:55 e 16:55)

Per evitare dimenticanze a fine turno, l'applicazione integra un sistema di notifiche push locali schedulate:

- **1° Promemoria (Pranzo)**: ore **11:55** — Invita a segnare i presenti della mattinata e i materiali arrivati.
- **2° Promemoria (Fine Turno)**: ore **16:55** — Ricorda di allegare le foto di giornata e chiudere il rapportino.
- **Giorni Attivi di Default**: Lunedì, Martedì, Mercoledì, Giovedì e Venerdì (esclusi Sabato e Domenica).

### Personalizzazione dal Menu Laterale
1. Tocca l'icona del menu a sandwich `☰` in alto a sinistra.
2. Nella scheda **"Promemoria"**:
   - Puoi attivare o disattivare le notifiche con lo switch principale.
   - Puoi modificare liberamente gli orari dei due promemoria.
   - Puoi selezionare o deselezionare i giorni della settimana con un tocco sui chip `Lun`, `Mar`, `Mer`, `Gio`, `Ven`, `Sab`, `Dom`.
   - Tocca **"🔔 Invia Notifica di Test Subito"** per verificare all'istante la ricezione sul tuo telefono.

---

## Download, Condivisione e Modifica File

I pulsanti di esportazione si trovano nella **barra fissa inferiore**, sempre a portata di pollice.

### Esportazione PDF Istituzionale
- Genera un documento PDF ad alta definizione identico al layout approvato della Direzione Vittorini.
- **Geometria Dinamica Intelligente**:
  - **1 Pagina Esatta**: Se il rapportino contiene da 0 a 4 foto, tutto il documento (testata, meteo, lavorazioni, personale, note e le 4 foto in griglia 2x2) rientra armoniosamente in una singola pagina A4.
  - **2 Pagine Esatte**: Se sono caricate da 5 a 8 foto, la prima pagina ospita i dati di cantiere e le prime 4 foto, mentre la seconda pagina ospita le foto da 5 a 8 in grande formato, con testata e piè di pagina coordinati.

### Esportazione Word (.docx) Modificabile
- Genera un documento Microsoft Word OpenXML (.docx) formattato con i colori ufficiali dell'impresa (blu navy `#1A5694`), tabelle strutturate per il personale e immagini incorporate nella cartella `word/media/`.
- **Modificabilità Totale**:
  - Può essere aperto e modificato su smartphone con Microsoft Word Mobile, Google Documenti o WPS Office.
  - Può essere aperto in ufficio su PC con Microsoft Word 2016/2019/2021/365 per integrare computi metrici, note legali o allegati contrattuali.

### Invio Diretto su WhatsApp ed Email
1. Dopo aver toccato **"Scarica PDF"** o **"Scarica Word (.docx)"**, il browser/smartphone salva il file e apre il foglio di condivisione di sistema.
2. Seleziona **WhatsApp** per inviare il file direttamente al gruppo di cantiere o al Direttore Tecnico.
3. Seleziona **Mail / Gmail** per allegarlo alla posta ordinaria o PEC aziendale.

---

## Menu Sandwich, Rubrica e Backup

Toccando il pulsante `☰` in alto a sinistra si accede al pannello laterale suddiviso in 4 sezioni:

1. **Promemoria**: Configurazione degli avvisi giornalieri.
2. **Rubrica & Anagrafiche**:
   - **Cantieri**: Visualizza l'elenco dei cantieri memorizzati. Puoi aggiungere un nuovo cantiere con Località e Commessa o cancellare i cantieri chiusi.
   - **Personale**: Gestione operai interni per averli subito pronti nei chip touch.
   - **Subappalti & Noleggi**: Anagrafica delle ditte e dei fornitori di noleggio abituali.
3. **Registro Storico**:
   - Consulta tutti i rapportini salvati nella memoria locale dello smartphone.
   - Tocca un rapportino passato per riaprirlo, visualizzarlo o rigenerare una nuova copia PDF/Word.
4. **Backup & Sincronizzazione**:
   - **Esporta Archivio (JSON)**: Scarica una copia di backup completa di tutti i cantieri, operai e rapportini per metterla al sicuro o trasferirla su un nuovo telefono.
   - **Ripristina da Backup (JSON)**: Carica un file di backup precedente.
   - **Dati Vittorini Predefiniti**: Ripristina in qualsiasi momento l'elenco iniziale aziendale.

---

## Verifica e Test E2E Automatizzati

Il progetto include una suite di collaudo automatizzata end-to-end eseguibile da terminale tramite Node.js.

### Esecuzione Test Suite Completa
Dalla cartella del progetto:
```bash
# Esegue la suite completa del Task 7 (E2E, Mobile UX, PDF, Word e Service Worker)
node test_task7.js
```

### Esecuzione Singoli Moduli
```bash
node test_task2.js   # Verifica Store, Rubrica e Autocompletamento
node test_task3.js   # Verifica i 9 Box a Spunta Verde e Compressione Foto
node test_task4.js   # Verifica Menu Sandwich, Promemoria 11:55/16:55 e Storico
node test_task5.js   # Verifica Motore PDF (Geometria A4, 1 e 2 pagine)
node test_task6.js   # Verifica Motore Word .docx (OpenXML e relazioni media)
node test_task7.js   # Collaudo finale End-to-End complessivo
```

**Tutti i 101 test unitari ed E2E sono certificati con esito 100% positivo.**

---

### Riferimenti Aziendali
**Impresa Costruzioni Edili e Stradali**  
**Vittorini Emidio Costruzioni S.r.l.**  
*Sede Legale ed Operativa: L'Aquila (AQ)*  
*Applicazione ad uso esclusivo del personale tecnico e di cantiere.*
