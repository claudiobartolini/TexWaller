//import { gunzip } from 'pako' // Importa la funzione gunzip dalla libreria paco
import { parseSyncTex } from "./lib/synctexParser.js"; // Importa la funzione parseSyncTex
//import {PDFViewer as pdfjsViewer} from 'pdfjs-dist/web/pdf_viewer.js' // Importa PDFViewer da pdfjs-dist

export async function handleReverseSyncTeX(pdfSyncObject, pos, page) {
    try {
        
        //console.log("pos[0]: ", pos[0]);
        //console.log("pos[1]: ", pos[1]);
        //console.log("page: ", page);
        // Trova il blocco corrispondente alla posizione fornita
        const pageBlocks = pdfSyncObject.pages[page]?.blocks || [];
        const matchingBlock = pageBlocks.find(
            (block) =>
                pos[0] >= block.left &&
                pos[0] <= block.left + (block.width || 0) &&
                pos[1] >= block.bottom &&
                pos[1] <= block.bottom + block.height
        );

        if (!matchingBlock) {
            console.error("Nessun blocco trovato per la posizione specificata.");
            /*
                  ws.send(JSON.stringify({
                      type: 'error',
                      message: 'Nessun blocco trovato',
                      details: 'La posizione specificata non corrisponde a nessun blocco nel file SyncTeX.'
                  }))
                  */
            return;
        }

        // Verifica che il file e il percorso siano definiti
        if (!matchingBlock.file || !matchingBlock.file.path) {
            console.error("Il file o il percorso non è definito nel blocco corrispondente.");
            return;
        }

        // Costruisci la risposta con il file sorgente e la riga
        const sourceFilePath = matchingBlock.file.path;
        const lineNumber = matchingBlock.line;

        return {
            sourceFilePath,
            lineNumber,
        };

        /*
            ws.send(JSON.stringify({
                type: 'reverse_synctex_response',
                sourceFilePath,
                lineNumber
            }))
            */
    } catch (error) {
        console.error("Errore durante la gestione di reverse_synctex:", error);
        /*
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Errore durante la gestione di reverse_synctex',
                details: error.message
            }))
            */
    }
} 