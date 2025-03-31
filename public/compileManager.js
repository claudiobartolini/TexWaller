import { getEditors } from "./editorManager.js";
import { ensurePDFJSReady, renderPDFPage, showPDFInIframe, configurePDFJS } from "./pdfjsManager.js";

// Configura il worker di PDF.js
configurePDFJS("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js");

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

const COMPILATION_TIMEOUT_MS = 30000;  // 30 seconds
let compilationTimeout = null;

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
        clearTimeout(compilationTimeout);  // Clear timeout when stopping manually
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
    compileButton.classList.add('compiling');
    compileButton.innerText = "Stop compilation";
    
    if (spinnerElement) {
        spinnerElement.style.display = 'block';
    }

    // Set compilation timeout
    compilationTimeout = setTimeout(() => {
        console.error('Compilation timeout after 30 seconds');
        terminate();
        compileButton.classList.remove('compiling');
        compileButton.innerText = "Compile";
        if (spinnerElement) {
            spinnerElement.style.display = 'none';
        }
        alert('Compilation timed out after 15 seconds');
    }, COMPILATION_TIMEOUT_MS);

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

    worker.onmessage = ({ data : {pdf, log, print} }) =>
    {
        if(pdf)
        {
            clearTimeout(compilationTimeout);  // Clear timeout on successful compilation
            previewElement.src = URL.createObjectURL(new Blob([pdf], {type: 'application/pdf'}));
            elapsedElement.innerText = ((performance.now() - tic) / 1000).toFixed(2) + ' sec';
            if (spinnerElement) {
                spinnerElement.style.display = 'none';   // Hide spinner
            }
            compileButton.classList.remove('compiling');
            compileButton.innerText = "Compile";
            console.log('Compilation successful');
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
      //bibEditor.setValue(log);

      try {
        const result = await analyzeLatexLog(log);
        if (result) {
          // Rendi visibile il supportpane
          const supportPane = document.getElementById("supportpane");
          supportPane.style.display = "block"; // Cambia il display a block
          // Ottieni l'istanza del Monaco Editor
          const editor = monaco.editor.getModels()[0]; // Assumendo che ci sia un solo modello caricato
          let decorations = []; // Array per tenere traccia delle decorazioni attive
          // Popola il tab "Errors" e aggiungi decorazioni rosse
          const errorsTab = document.getElementById("errors");

          const errorDecorations = result.errors.map((error) => {

            const errorItem = document.createElement("div");
            errorItem.className = "item"; // Usa la classe CSS per gli item
            if (error.line === null)
              errorItem.textContent = `Error in file ${error.file}: ${error.message}`;
            else
              errorItem.textContent = `Error in file ${error.file} at line ${error.line}: ${error.message}`;
            errorsTab.appendChild(errorItem);
            // Aggiungi un listener per spostare il cursore
            if (error.line != null) {
              errorItem.addEventListener("click", () => {
                if (texEditor) {
                  texEditor.setPosition({ lineNumber: error.line, column: 1 }); // Sposta il cursore
                  texEditor.revealLineInCenter(error.line); // Centra la riga nell'editor
                } else {
                  console.error("Monaco Editor non inizializzato!");
                }
              });
              // Aggiungi decorazione per l'errore
              return {
                range: new monaco.Range(error.line, 1, error.line, 1),
                options: {
                  isWholeLine: true,
                  className: "error-line", // Classe CSS per lo stile
                  overviewRuler: {
                    color: "rgba(255, 0, 0, 0.8)", // Colore rosso per la preview
                    position: monaco.editor.OverviewRulerLane.Full, // Posizione nella preview
                  },
                },
              };
            }
          });

          // Popola il tab "Warnings" e aggiungi decorazioni gialle
          const warningsTab = document.getElementById("warnings");
          warningsTab.innerHTML = ""; // Svuota il contenuto precedente
          const warningDecorations = result.warnings.map((warning) => {
            const warningItem = document.createElement("div");
            warningItem.className = "item"; // Usa la classe CSS per gli item
            warningItem.textContent = `Warning in file ${warning.file} at line ${warning.line}: ${warning.message}`;
            warningsTab.appendChild(warningItem);
            // Aggiungi un listener per spostare il cursore
            warningItem.addEventListener("click", () => {
              if (texEditor) {
                texEditor.setPosition({ lineNumber: warning.line, column: 1 }); // Sposta il cursore
                texEditor.revealLineInCenter(warning.line); // Centra la riga nell'editor
              } else {
                console.error("Monaco Editor non inizializzato!");
              }
            });

            // Aggiungi decorazione per il warning
            return {
              range: new monaco.Range(warning.line, 1, warning.line, 1),
              options: {
                isWholeLine: true,
                className: "warning-line", // Classe CSS per lo stile
                overviewRuler: {
                  color: "rgba(255, 255, 0, 0.8)", // Colore giallo per la preview
                  position: monaco.editor.OverviewRulerLane.Full, // Posizione nella preview
                },
              },
            };
          });

          // Applica le decorazioni al Monaco Editor
          decorations = texEditor.deltaDecorations(decorations, [...errorDecorations, ...warningDecorations]);

          // Popola il tab "Typesetting" con il contenuto di typesetting
          const typesettingTab = document.getElementById("typesetting");
          typesettingTab.innerHTML = ""; // Svuota il contenuto precedente
          result.typesetting.forEach((issue) => {
            const typesettingItem = document.createElement("div");
            typesettingItem.className = "item"; // Usa la classe CSS per gli item
            typesettingItem.textContent = `Typesetting issue: ${issue.message}`;
            typesettingTab.appendChild(typesettingItem);
          });

          // Popola il tab "Info" con il contenuto del log formattato in HTML
          /*
          * TODO: Il tab info deve essere popolato con il log anche quando non c'è errore?
          */
          const infoTab = document.getElementById("info");
          infoTab.innerHTML = ""; // Svuota il contenuto precedente
          const formattedLog = log
            .split("\n")
            .map((line) => `${line}<br>`) // Formatta ogni riga del log come un paragrafo
            .join("");
          infoTab.innerHTML = formattedLog;

          console.log("Support pane updated with LaTeX log results.");
        }
      } catch (error) {
        console.error("Error analyzing LaTeX log:", error);
      }
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
    if (compilationTimeout) {
        clearTimeout(compilationTimeout);
        compilationTimeout = null;
    }
    if (worker !== null) worker.terminate();
    worker = null;
}