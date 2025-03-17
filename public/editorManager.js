import { 
    mainTexFile,
    getCurrentProjectFiles,
} from './projectManager.js';
import { collection, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { db } from './firebase-config.js';

let texEditor, bibEditor;
let currentFile = null;  // Initialize as null and set after editors are ready
let autoSaveTimeout;
let isOffline = false;
let lastSavedContent = { tex: '', bib: '' };

export function getEditors() {
    return { texEditor, bibEditor };
}

export function initializeEditor() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.21.2/min/vs' }});
    require(['vs/editor/editor.main'], async function() {
        try {
            // Initialize default content
            const defaultTexContent = "\\documentclass{article}\n\\begin{document}\n\\end{document}";
            const defaultBibContent = "@article{example,\n  author = {Author},\n  title = {Title},\n  year = {2024}\n}";

            // Fetch content from Firebase
            const { texContent, bibContent } = await fetchEditorContent();

            // Register LaTeX language
            monaco.languages.register({ id: 'latex' });
            monaco.languages.setMonarchTokensProvider('latex', {
                tokenizer: {
                    root: [
                        [/\\[a-zA-Z]+/, 'keyword'],
                        [/%.*/, 'comment'],
                        [/\{[^}]*\}/, 'string'],
                        [/\[[^\]]*\]/, 'string'],
                        [/\$[^$]*\$/, 'string'],
                    ]
                }
            });

            // Create editors with fetched content or defaults
            texEditor = monaco.editor.create(document.getElementById('tex-editor'), {
                value: texContent || defaultTexContent,
                language: 'latex',
                theme: 'vs-dark',
                wordWrap: 'on',
                automaticLayout: true
            });

            bibEditor = monaco.editor.create(document.getElementById('bib-editor'), {
                value: bibContent || defaultBibContent,
                language: 'bibtex',
                theme: 'vs-dark',
                wordWrap: 'on',
                automaticLayout: true
            });

            // Set current file after editors are initialized
            currentFile = mainTexFile;

            // Set up event listeners
            texEditor.onDidChangeModelContent(() => {
                if (currentFile.endsWith(".tex")) {
                    const currentProjectFiles = getCurrentProjectFiles();
                    if (currentProjectFiles) {
                        currentProjectFiles[currentFile] = texEditor.getValue();
                        startAutoSaveDebounced();
                    }
                }
            });

            bibEditor.onDidChangeModelContent(() => {
                if (currentFile.endsWith(".bib")) {
                    const currentProjectFiles = getCurrentProjectFiles();
                    if (currentProjectFiles) {
                        currentProjectFiles[currentFile] = bibEditor.getValue();
                        startAutoSaveDebounced();
                    }
                }
            });

            // Handle container z-index
            const editorContainer = document.getElementById('editor-container');
            const previewContainer = document.getElementById('preview-container');

            editorContainer.addEventListener('mouseenter', () => {
                editorContainer.style.zIndex = '2';
                previewContainer.style.zIndex = '1';
            });

            previewContainer.addEventListener('mouseenter', () => {
                previewContainer.style.zIndex = '2';
                editorContainer.style.zIndex = '1';
            });

            // Set initial focus
            texEditor.focus();

        } catch (error) {
            console.error("Error initializing editors:", error);
            throw error;
        }
    });
}

async function fetchEditorContent() {
    try {
        const editRef = doc(collection(db, "editors"), "default");
        const editSnap = await getDoc(editRef);

        if (editSnap.exists()) {
            const data = editSnap.data();
            lastSavedContent = {
                tex: data.tex || '',
                bib: data.bib || ''
            };
            
            return {
                texContent: data.tex ? decodeURIComponent(escape(atob(data.tex))) : "",
                bibContent: data.bib ? decodeURIComponent(escape(atob(data.bib))) : ""
            };
        }
        return { texContent: "", bibContent: "" };
    } catch (error) {
        console.error("Failed to fetch content:", error);
        isOffline = true;
        return { texContent: "", bibContent: "" };
    }
}

async function saveEditorContent() {
    if (!texEditor || !bibEditor || isOffline) {
        return;
    }

    try {
        const newTexContent = btoa(unescape(encodeURIComponent(texEditor.getValue())));
        const newBibContent = btoa(unescape(encodeURIComponent(bibEditor.getValue())));

        // Only save if content has changed
        if (newTexContent === lastSavedContent.tex && newBibContent === lastSavedContent.bib) {
            return;
        }

        await setDoc(doc(db, "editors", "default"), {
            tex: newTexContent,
            bib: newBibContent,
            lastModified: new Date().toISOString()
        });

        lastSavedContent = {
            tex: newTexContent,
            bib: newBibContent
        };

        console.log("Editors content saved successfully!");
    } catch (error) {
        console.error("Error saving editors content:", error);
        isOffline = true;
    }
}

// Auto-save function (waits 30 seconds after last change)
function startAutoSave() {
    clearTimeout(autoSaveTimeout); // Prevent multiple saves
    autoSaveTimeout = setTimeout(saveEditorContent, 5000); // Auto-save after 5 seconds
}

// Debouncing function for auto-save (waits for user to stop typing)
function startAutoSaveDebounced() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        startAutoSave();  // Call the actual auto-save function after a delay
    }, 500);  // Adjust delay (500ms = waits for user to stop typing)
}