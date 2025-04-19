console.log("[iframeMessageListener.js] Script caricato.");

window.addEventListener("message", event => {
  // IMPORTANTE: Per sicurezza, verifica sempre l'origine del messaggio.
  // Sostituisci 'http://tuo-dominio-o-origine.com' con l'origine effettiva
  // da cui ti aspetti di ricevere messaggi (es. l'URL di index3.html).
  // Per sviluppo locale, potrebbe essere 'http://localhost:xxxx' o 'null' se apri il file direttamente.
  // const expectedOrigin = 'http://tuo-dominio-o-origine.com';
  // if (event.origin !== expectedOrigin) {
  //   console.warn(`[iframeMessageListener.js] Messaggio ignorato da origine non attesa: ${event.origin}`);
  //   return;
  // }

  // Controlla il tipo di messaggio e la presenza di fileURL
  if (event.data?.type === 'loadPDF' && event.data.fileURL) {
    console.log("[iframeMessageListener.js] Messaggio 'loadPDF' ricevuto:", event.data);
    const { fileURL } = event.data;

    // Verifica che l'URL sia una stringa e inizi con 'blob:' o 'data:'
    if (typeof fileURL === 'string' && (fileURL.startsWith('blob:') || fileURL.startsWith('data:'))) {
      // Assicurati che PDFViewerApplication sia disponibile
      // PDFViewerApplication è solitamente reso globale da viewer.mjs
      if (window.PDFViewerApplication) {
        console.log("[iframeMessageListener.js] Chiamata a PDFViewerApplication.open con URL:", fileURL);
        window.PDFViewerApplication.open({ url: fileURL })
          .then(() => {
            console.log("[iframeMessageListener.js] PDF da postMessage caricato con successo.");
            // Invia conferma al parent per revocare l'URL
            if (event.source) {
              event.source.postMessage({ type: 'pdfProcessed' }, event.origin); // Usa event.origin per sicurezza
              console.log("[iframeMessageListener.js] Messaggio 'pdfProcessed' inviato al parent.");
            }
          })
          .catch(err => {
            console.error("[iframeMessageListener.js] Errore durante PDFViewerApplication.open:", err);
            // Invia notifica di errore al parent, ma indica comunque di revocare l'URL
            if (event.source) {
              event.source.postMessage({ type: 'pdfLoadError', error: err.message }, event.origin);
              console.log("[iframeMessageListener.js] Messaggio 'pdfLoadError' inviato al parent.");
            }
          });
      } else {
        console.error("[iframeMessageListener.js] PDFViewerApplication non trovato sulla window.");
      }
    } else {
      console.error("[iframeMessageListener.js] fileURL non valido o non è una stringa blob/data:", fileURL);
    }
  } else {
    // Puoi aggiungere qui la gestione per altri tipi di messaggi se necessario
    // console.log("[iframeMessageListener.js] Messaggio ricevuto di tipo diverso o senza fileURL:", event.data);
  }
});

// --- NUOVA LOGICA PER GESTIRE I CLICK SULLE PAGINE ---

function setupPageClickListeners() {
    if (!window.PDFViewerApplication || !window.PDFViewerApplication.eventBus) {
        console.error("[iframeMessageListener.js] PDFViewerApplication o EventBus non disponibili per i listener di click.");
        return;
    }
    console.log("[iframeMessageListener.js] Impostazione dei listener di click per le pagine.");
    const eventBus = window.PDFViewerApplication.eventBus;

    eventBus.on('pagerendered', event => {
        // event.source è il PDFPageView
        // event.source.div è il div contenitore della pagina
        // event.pageNumber è il numero della pagina (1-based)
        const pageDiv = event.source.div;
        const pageNumber = event.pageNumber;
        const pageView = event.source;

        // Controlla se il listener è già stato aggiunto per evitare duplicati
        if (pageDiv && !pageDiv.dataset.clickListenerAdded) {
            console.log(`[iframeMessageListener.js] Aggiungo listener click alla pagina ${pageNumber}`);
            pageDiv.dataset.clickListenerAdded = 'true'; // Marca come aggiunto

            pageDiv.addEventListener('dblclick', (clickEvent) => {
                console.log(`[iframeMessageListener.js] Pagina ${pageNumber} cliccata (dblclick)!`);

                // 1. Ottenere coordinate del click relative al div della pagina (CSS Pixel)
                const rect = pageDiv.getBoundingClientRect();
                const cssX = clickEvent.clientX - rect.left;
                const cssY = clickEvent.clientY - rect.top;
                console.log(`[iframeMessageListener.js] Coordinate click (relative a div, CSS pixel): x=${cssX.toFixed(2)}, y=${cssY.toFixed(2)}`);

                // 2. Ottenere il viewport associato a questa vista di pagina
                const viewport = pageView.viewport;
                if (!viewport) {
                    console.error(`[iframeMessageListener.js] Viewport non disponibile per la pagina ${pageNumber}`);
                    return;
                }

                // 3. Convertire le coordinate CSS Pixel (relative al div) in coordinate PDF (punti)
                const pdfCoords = viewport.convertToPdfPoint(cssX, cssY);
                const pdfX = pdfCoords[0];
                const pdfY = pdfCoords[1];

                console.log(`[iframeMessageListener.js] Coordinate click (PDF points): Pagina ${pageNumber}, x=${pdfX.toFixed(2)}, y=${pdfY.toFixed(2)}`);

                // 4. Inviare messaggio alla pagina genitore
                // IMPORTANTE: Sostituire '*' con l'origine corretta in produzione per sicurezza!
                const targetOrigin = '*'; 
                window.parent.postMessage({
                    type: 'reverseSyncTeXRequest',
                    page: pageNumber,
                    pdfX: pdfX,
                    pdfY: pdfY
                }, targetOrigin);
                console.log(`[iframeMessageListener.js] Messaggio 'reverseSyncTeXRequest' inviato al parent con origine ${targetOrigin}.`);
            });

            // Aggiungi uno stile per indicare che la pagina è cliccabile (opzionale)
            pageDiv.style.cursor = 'pointer';
        }
    });

    // Potresti voler resettare lo stato 'data-click-listener-added' se il documento viene chiuso/cambiato
    // Ascoltando eventi come 'closed' o 'documentinit'
    eventBus.on('documentloaded', () => {
        console.log("[iframeMessageListener.js] Nuovo documento caricato, resetto gli stati dei listener click (se necessario)...");
        // Se le pagine vengono distrutte e ricreate correttamente, potremmo non aver bisogno di resettare manualmente.
        // Ma per sicurezza, potresti fare un querySelectorAll qui per rimuovere vecchi attributi se necessario.
    });
}

// Funzione per attendere che PDFViewerApplication sia inizializzato
function tryInitializePageClicks() {
    if (window.PDFViewerApplication && window.PDFViewerApplication.initializedPromise) {
        console.log("[iframeMessageListener.js] PDFViewerApplication trovato, attendo initializedPromise...");
        window.PDFViewerApplication.initializedPromise.then(setupPageClickListeners).catch(err => {
           console.error("[iframeMessageListener.js] Errore durante l'attesa di initializedPromise:", err);
        });
    } else {
        // Riprova dopo un breve ritardo se PDFViewerApplication non è ancora pronto
        // console.log("[iframeMessageListener.js] PDFViewerApplication non ancora pronto, riprovo l'impostazione dei listener di click...");
        setTimeout(tryInitializePageClicks, 150); // Riprova dopo 150ms
    }
}

// Avvia il controllo per l'inizializzazione
tryInitializePageClicks(); 