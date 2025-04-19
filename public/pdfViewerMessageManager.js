console.log("[pdfViewerMessageManager.js] Script caricato.");

//const fileInput = document.getElementById('fileInput');
const pdfViewer = document.getElementById('pdfViewer');
let currentFileURL = null; // Variabile per tenere traccia dell'URL Blob corrente

// Listener per ricevere messaggi dall'iframe
window.addEventListener('message', (event) => {
  // Verifica che il messaggio provenga dall'iframe che ci aspettiamo
  if (event.source !== pdfViewer.contentWindow) {
    return; // Ignora messaggi da altre fonti
  }

  // IMPORTANTE: Verifica l'origine per sicurezza!
  // Sostituisci con l'origine attesa, es. 'http://localhost:xxxx' o il tuo dominio
  // const expectedOrigin = 'http://...';
  // if (event.origin !== expectedOrigin) {
  //     console.warn('Messaggio ignorato da origine non attesa:', event.origin);
  //     return;
  // }

  const messageType = event.data?.type;
  if ((messageType === 'pdfProcessed' || messageType === 'pdfLoadError') && currentFileURL) {
    if (messageType === 'pdfProcessed') {
      console.log('[Host Page] Iframe ha processato il PDF. Revoco URL:', currentFileURL);
    } else {
      console.warn('[Host Page] Iframe ha riportato un errore nel caricamento. Revoco URL:', currentFileURL, 'Errore:', event.data.error);
    }
    URL.revokeObjectURL(currentFileURL);
    currentFileURL = null; // Resetta la variabile dopo la revoca
  } else {
    // console.log('[Host Page] Ricevuto messaggio da iframe:', event.data);
  }
});

/*
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    // Se c'è un URL precedente ancora in attesa di revoca, revocarlo prima.
    if (currentFileURL) {
      console.warn("[Host Page] Revoco URL precedente non confermato:", currentFileURL);
      URL.revokeObjectURL(currentFileURL);
      currentFileURL = null;
    }

    currentFileURL = URL.createObjectURL(file); // Salva il nuovo URL nella variabile
    console.log('File PDF selezionato:', file.name);
    console.log('URL Blob creato:', currentFileURL);

    const sendMessage = () => {
        pdfViewer.contentWindow.postMessage({ type: 'loadPDF', fileURL: currentFileURL }, '*');
        console.log('Messaggio postMessage inviato all\'iframe con URL:', currentFileURL);
    };

    // Controlla se l'iframe ha già un contentWindow (potrebbe non averlo se non è ancora caricato)
    if (pdfViewer.contentWindow && pdfViewer.contentWindow.location.href !== 'about:blank') {
        sendMessage();
    } else {
        // Se l'iframe non è pronto, aspetta l'evento onload
        console.log("Iframe non ancora pronto, attendo onload...");
        pdfViewer.onload = () => {
            console.log("Iframe caricato, invio messaggio postMessage...");
            sendMessage();
            // Rimuovi l'handler per evitare chiamate multiple
            pdfViewer.onload = null;
        };
        // Se l'iframe non aveva src o era about:blank, assicurati che carichi viewer.html
        if (pdfViewer.src === 'about:blank' || !pdfViewer.src) {
          pdfViewer.src = './web/viewer.html';
        }
    }

  } else {
    alert('Per favore seleziona un file PDF valido.');
  }
}); 

*/