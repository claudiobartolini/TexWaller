import { getEditors } from "./editorManager.js";
import { ensurePDFJSReady, renderPDFPage, showPDFInIframe } from "./pdfjsManager.js";

// Module-level variables and constants
const paths_list = Array.from(document.head.getElementsByTagName("link"))
  .filter((link) => link.rel === "busytex")
  .map((link) => [link.id, link.href]);

const texlive_data_packages_js = paths_list
  .filter(([id, href]) => id.startsWith("texlive_"))
  .map(([id, href]) => href);

const paths = { ...Object.fromEntries(paths_list), texlive_data_packages_js };
const texmf_local = ["./texmf", "./.texmf"];

let texEditor = null;
let bibEditor = null;
let worker = null;
let compileButton = null;
let spinnerElement = null;
let workerCheckbox = null;
let preloadCheckbox = null;
let verboseSelect = null;
let driverSelect = null;
let bibtexCheckbox = null;
let autoCheckbox = null;
let previewElement = null;
let elapsedElement = null;
let ubuntuPackageCheckboxes = null;

// Initialize all UI elements first
document.addEventListener("DOMContentLoaded", async () => {
  // Wait for editors to be initialized
  const checkEditors = setInterval(() => {
    const editors = getEditors();
    if (editors.texEditor && editors.bibEditor) {
      clearInterval(checkEditors);
      texEditor = editors.texEditor;
      bibEditor = editors.bibEditor;

      // Initialize UI elements
      compileButton = document.getElementById("compile-button");
      spinnerElement = document.getElementById("spinner");
      workerCheckbox = document.getElementById("worker");
      preloadCheckbox = document.getElementById("preload");
      verboseSelect = document.getElementById("verbose");
      driverSelect = document.getElementById("tex_driver");
      bibtexCheckbox = document.getElementById("bibtex");
      autoCheckbox = document.getElementById("checked_texlive_auto");
      previewElement = document.getElementById("preview");
      elapsedElement = document.getElementById("elapsed");
      ubuntuPackageCheckboxes = {
        recommended: document.getElementById(
          "checked_texlive_ubuntu_recommended"
        ),
        extra: document.getElementById("checked_texlive_ubuntu_extra"),
        science: document.getElementById("checked_texlive_ubuntu_science"),
      };

      if (!compileButton || !texEditor || !bibEditor) {
        console.error("Required elements or editors not initialized!");
        return;
      }

      // Add click listener only after everything is initialized
      compileButton.addEventListener("click", onclick_);
    }
  }, 100);
});

// Export the necessary functions
export async function onclick_() {
  if (!compileButton) {
    console.error("Compile button not initialized!");
    return;
  }

  if (compileButton.classList.contains("compiling")) {
    // Handle stop compilation
    terminate();
    compileButton.classList.remove("compiling");
    compileButton.innerText = "Compile";
    if (spinnerElement) {
      spinnerElement.style.display = "none";
    }
    return;
  }

  // Clear monaco editor decorations
  // Rimuovi tutte le decorazioni dal texEditor
  if (texEditor) {
    // Se hai salvato gli ID delle decorazioni quando le hai create (approccio raccomandato)
    let decorationIds = [/* array degli ID delle decorazioni */];
    decorationIds = texEditor.deltaDecorations(decorationIds, []);

    // Se non hai salvato gli ID e devi rimuovere tutte le decorazioni
    // puoi creare un nuovo array vuoto per le decorazioni
    if (!decorationIds || decorationIds.length === 0) {
      // Ottieni tutti gli ID dalle vecchie decorazioni dal model
      const model = texEditor.getModel();
      if (model && model.getAllDecorations) {
        const allDecorations = model.getAllDecorations();
        decorationIds = allDecorations.map(d => d.id);
      } else {
        decorationIds = [];
      }

      // Rimuovi tutte le decorazioni
      decorationIds = texEditor.deltaDecorations(decorationIds, []);
    }
  }
  
  if (bibEditor) {
    // Se hai salvato gli ID delle decorazioni quando le hai create (approccio raccomandato)
    let decorationIds = [/* array degli ID delle decorazioni */];
    decorationIds = bibEditor.deltaDecorations(decorationIds, []);

    // Se non hai salvato gli ID e devi rimuovere tutte le decorazioni
    // puoi creare un nuovo array vuoto per le decorazioni
    if (!decorationIds || decorationIds.length === 0) {
      // Ottieni tutti gli ID dalle vecchie decorazioni dal model
      const model = bibEditor.getModel();
      if (model && model.getAllDecorations) {
        const allDecorations = model.getAllDecorations();
        decorationIds = allDecorations.map(d => d.id);
      } else {
        decorationIds = [];
      }

      // Rimuovi tutte le decorazioni
      decorationIds = bibEditor.deltaDecorations(decorationIds, []);
    }
  }

  /*
  // Clear the support pane
  const supportPane = document.getElementById("supportpane");
  if (supportPane) {
    supportPane.style.display = "none"; // Hide the support pane
  }
  */
  // Clear the error and warning tabs
  const errorsTab = document.getElementById("errors");
  const warningsTab = document.getElementById("warnings");
  if (errorsTab) {
    errorsTab.innerHTML = ""; // Clear the content of the errors tab
  }
  if (warningsTab) {
    warningsTab.innerHTML = ""; // Clear the content of the warnings tab
  }
  // Clear the info tab
  const infoTab = document.getElementById("info");
  if (infoTab) {
    infoTab.innerHTML = ""; // Clear the content of the info tab
  }
  // Clear the typesetting tab
  const typesettingTab = document.getElementById("typesetting");
  if (typesettingTab) {
    typesettingTab.innerHTML = ""; // Clear the content of the typesetting tab
  }


  // Start compilation
  compileButton.classList.add("compiling");
  compileButton.innerText = "Stop compilation";

  if (spinnerElement) {
    spinnerElement.style.display = "block";
  }

  const use_worker = workerCheckbox.checked;
  const use_preload = preloadCheckbox.checked;
  const use_verbose = verboseSelect.value;
  const use_driver = driverSelect.value;
  const use_bibtex = bibtexCheckbox.checked;
  const use_auto = autoCheckbox.checked;

  let data_packages_js = null;
  if (!use_auto) {
    data_packages_js = [];
    for (const [key, checkbox] of Object.entries(ubuntuPackageCheckboxes)) {
      if (checkbox.checked)
        data_packages_js.push(
          texlive_data_packages_js.find((path) => path.includes(key))
        );
    }
  }

  let tic = performance.now();
  const reload = worker == null;
  if (use_worker) {
    if (reload) worker = new Worker(paths.busytex_worker_js);
  } else if (reload) {
    worker = {
      async postMessage({
        files,
        main_tex_path,
        bibtex,
        preload,
        verbose,
        busytex_js,
        busytex_wasm,
        texmf_local,
        preload_data_packages_js,
        data_packages_js,
      }) {
        if (busytex_wasm && busytex_js && preload_data_packages_js) {
          this.pipeline = new Promise((resolve, reject) => {
            let script = document.createElement("script");
            script.src = busytex_pipeline_js;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          }).then((_) =>
            Promise.resolve(
              new BusytexPipeline(
                busytex_js,
                busytex_wasm,
                data_packages_js,
                preload_data_packages_js,
                texmf_local,
                (msg) => this.onmessage({ data: { log: msg } }),
                preload,
                BusytexPipeline.ScriptLoaderDefault
              )
            )
          );
        } else if (files && this.pipeline) {
          const pipeline = await this.pipeline;
          const { pdf: pdf, exit_code: exit_code, logs: logs } = await self.pipeline.compile(
            files,
            main_tex_path,
            bibtex,
            verbose,
            driver,
            data_packages_js
          );
          console.log('EXIT CODE:', exit_code);
          console.log('LOGS:', logs.join("\n"));
          if (exit_code != 2)
            this.onmessage({ data: { pdf } });
          else {
            bibEditor.setValue(logs.join("\n"));
            terminate();
          }
        }
      },
      terminate() {
        this.onmessage({ data: { log: "Terminating dummy worker" } });
      },
    };
  }

  worker.onmessage = async ({ data: { pdf, log, exit_code, logs, print } }) => {
    if (pdf) {
      const pdfBlob = new Blob([pdf], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      ensurePDFJSReady()
        .then(() => {
          console.log("PDF.js is ready, rendering PDF");

          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          loadingTask.promise
            .then((pdfDoc) => {
              renderPDFPage(pdfDoc, 1); // Renderizza la prima pagina
            })
            .catch((error) => {
              console.error("Error rendering PDF:", error);
            });
        })
        .catch((error) => {
          console.error("Failed to initialize PDF.js:", error);
          showPDFInIframe(pdfUrl); // Usa l'iframe come fallback
        });

      elapsedElement.innerText =
        ((performance.now() - tic) / 1000).toFixed(2) + " sec";
      if (spinnerElement) {
        spinnerElement.style.display = "none"; // Nascondi lo spinner
      }
      compileButton.classList.remove("compiling");
      compileButton.innerText = "Compile";
      console.log("Compilation successful");
    }

    if (print) {
      console.log(print);
    }

    if (log) {
      //console.error(log);
      // DO NOTHING
    }

    if (exit_code != 0 && exit_code !== undefined) {
      terminate();
      const pdflatex_log_index = logs.length === 2 ? 0 : logs.length - 1;
      const log = logs[pdflatex_log_index].log;
      bibEditor.setValue(log);
    }
  };

  if (reload)
    worker.postMessage({
      ...paths,
      texmf_local: texmf_local,
      preload_data_packages_js: paths.texlive_data_packages_js.slice(0, 1),
      data_packages_js: paths.texlive_data_packages_js,
    });

  tic = performance.now();
  const tex = texEditor.getValue();
  const bib = bibEditor.getValue();
  const files = [
    { path: "example.tex", contents: tex },
    { path: "example.bib", contents: bib },
  ];
  worker.postMessage({
    files: files,
    main_tex_path: "example.tex",
    verbose: use_verbose,
    bibtex: use_bibtex,
    driver: use_driver,
    data_packages_js: data_packages_js,
  });
}

export function terminate() {
  if (worker !== null) worker.terminate();
  worker = null;
  compileButton.classList.remove("compiling");
  compileButton.innerText = "Compile";
  if (spinnerElement) {
    spinnerElement.style.display = "none";
  }
}

/*
// Function to ensure PDF.js is ready to use
function ensurePDFJSReady() {
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

// Function to render a specific page of a PDF document
function renderPDFPage(pdfDoc, pageNumber) {
  try {
    console.log(`Rendering PDF page ${pageNumber}`);
    
    // Get the specified page
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
      
      // Set scale for better resolution
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions to match the viewport
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render the PDF page to the canvas
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

// Function to show PDF in iframe as fallback
function showPDFInIframe(pdfUrl) {
  try {
    console.log("Falling back to iframe PDF viewer");
    
    const previewContainer = document.getElementById("preview-container");
    if (!previewContainer) {
      console.error("Preview container not found");
      return;
    }
    
    // Clear the container
    previewContainer.innerHTML = "";
    
    // Create an iframe to display the PDF
    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    
    // Add the iframe to the container
    previewContainer.appendChild(iframe);
    console.log("PDF iframe added to container");
  } catch (error) {
    console.error("Error in showPDFInIframe:", error);
  }
}
*/
export function analyzeLatexLog(log) {
  return new Promise((resolve, reject) => {
    require(['lib/latex-log-parser'], function (LatexParser) {
      try {
        // Parser options
        const options = {
          ignoreDuplicates: true, // Ignore duplicate messages
        };

        // Analyze the LaTeX log
        const result = LatexParser.parse(log, options);

        // Show the result
        console.log("QUESTO E' IL RISULTATO DEL PARSER");
        console.log('Errors:', result.errors);
        console.log('Warnings:', result.warnings);
        console.log('Typesetting issues:', result.typesetting);
        console.log('All messages:', result.all);

        // Resolve the Promise with the result
        resolve(result);
      } catch (error) {
        console.error('Error analyzing LaTeX log:', error);
        reject(error); // Reject the Promise with the error
      }
    });
  });
}
