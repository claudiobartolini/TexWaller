import * as pdfjsLib from 'pdfjs-dist';
import * as pdfjsViewer from 'pdfjs-dist/web/pdf_viewer';

// Imposta il worker di PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Funzione per verificare l'inizializzazione di PDF.js
export function checkPDFJS() {
    if (!pdfjsLib || !pdfjsLib.getDocument) {
        throw new Error('PDF.js non è stato caricato correttamente.');
    }
}

// Modifica della funzione renderPDF per gestire errori di inizializzazione
export function renderPDF(pdfUrl, containerId) {
    try {
        checkPDFJS(); // Verifica l'inizializzazione di PDF.js
        const container = document.getElementById(containerId);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        loadingTask.promise.then(pdf => {
            pdf.getPage(1).then(page => {
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                container.appendChild(canvas);

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };
                page.render(renderContext);
            });
        }).catch(error => {
            console.error('Errore durante il caricamento del PDF:', error);
        });
    } catch (error) {
        console.error('Errore durante l\'inizializzazione di PDF.js:', error);
    }
}
