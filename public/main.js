import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { loadProjectAndWorkbenchFromFirestore, } from './projectManager.js';
import { initializeEditor } from './editorManager.js';
import { renderFileExplorer, setupContextMenuHandlers } from './uiManager.js';
import { onclick_, terminate } from './compileManager.js';  // Add this import

// Load projects and initialize UI
async function initApp() {
    try {
        const uiState = await loadProjectAndWorkbenchFromFirestore();
        initializeEditor();
        renderFileExplorer(document.getElementById('file-tree'), uiState);
        setupContextMenuHandlers();
            } catch (error) {
        console.error("Error initializing app:", error);
    }
}

// Start the application
initApp();