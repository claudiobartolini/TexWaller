// Configura il worker di PDF.js
export function configurePDFJS(workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

// Funzione per assicurarsi che PDF.js sia pronto
export function ensurePDFJSReady() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 5;
    const interval = 500; // Millisecondi tra i tentativi

    const checkPDFJS = () => {
      attempts++;
      if (typeof pdfjsLib !== "undefined") {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error("PDF.js is not available after 5 attempts"));
      } else {
        setTimeout(checkPDFJS, interval);
      }
    };

    checkPDFJS();
  });
}

// Funzione per renderizzare una pagina specifica di un documento PDF
export function renderPDFPage(pdfDoc, pageNumber) {
  try {
    console.log(`Rendering PDF page ${pageNumber}`);
    
    // Ottieni la pagina specificata
    pdfDoc.getPage(pageNumber).then(page => {
      const canvas = document.getElementById("pdf-canvas");
      if (!canvas) {
        console.error("Canvas element not found");
        return;
      }
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Could not get canvas context");
        return;
      }
      
      // Imposta la scala per una migliore risoluzione
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      // Imposta le dimensioni del canvas in base al viewport
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Renderizza la pagina PDF sul canvas
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      page.render(renderContext).promise.then(() => {
        console.log("Page rendered successfully");
      }).catch(error => {
        console.error("Error rendering page:", error);
      });
    }).catch(error => {
      console.error(`Error getting page ${pageNumber}:`, error);
    });
  } catch (error) {
    console.error("Error in renderPDFPage:", error);
  }
}

// Funzione per mostrare il PDF in un iframe come fallback
export function showPDFInIframe(pdfUrl) {
  try {
    console.log("Falling back to iframe PDF viewer");
    
    const previewContainer = document.getElementById("preview-container");
    if (!previewContainer) {
      console.error("Preview container not found");
      return;
    }
    
    // Svuota il contenitore
    previewContainer.innerHTML = "";
    
    // Crea un iframe per visualizzare il PDF
    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    
    // Aggiungi l'iframe al contenitore
    previewContainer.appendChild(iframe);
    console.log("PDF iframe added to container");
  } catch (error) {
    console.error("Error in showPDFInIframe:", error);
  }
}