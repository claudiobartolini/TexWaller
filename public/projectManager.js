import { collection, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { db } from './firebase-config.js';

// Add this line near the top after imports
const workbenchRef = collection(db, "workbench");

// Module-level variables
export let currentProjectTree = {};  // UI representation
export let workbench = [
    {
        "Project 1": {
            "file11.tex": "\\documentclass{article}\n\\begin{document}\nThis is file 11\n\\end{document}",
            "file12.tex": "\\documentclass{article}\n\\begin{document}\nThis is file 12\n\\end{document}"
        }
    },
    {
        "Project 2": {
            "file21.tex": "\\documentclass{article}\n\\begin{document}\nThis is file 21\n\\end{document}",
            "file22.tex": "\\documentclass{article}\n\\begin{document}\nThis is file 22\n\\end{document}"
        }
    }
];
export let expandedFolders = [];

export let currentProject = null;
export let mainTexFile = "main.tex";

export async function createProjectInFirestore(projectName) {
    // Validate project name
    if (!projectName?.trim() || Object.keys(workbench).includes(projectName)) {
        throw new Error('Invalid or duplicate project name');
    }

    workbench = { ...currentProjectTree, ...workbench };

    currentProject = {
        name: projectName,
        createdAt: new Date().toISOString(),
        fileStructure: {
            [mainTexFile]: "\\documentclass{article}\n\\begin{document}\n\\end{document}"
        },
        mainTexFile,
        uiState: {
            expandedFolders: ['Projects']
        }
    };
    currentProjectTree = currentProject.fileStructure;

    // save the new current project to Firestore, overwriting the existing "current" project
    const projectRef = doc(db, "projects", projectName);
    await setDoc(projectRef, currentProject);

    const workbenchRef = doc(db, "workbench", projectName);
    await setDoc(workbenchRef, workbench);
    
    return currentProject;
}

export async function loadProjectAndWorkbenchFromFirestore() {
    try {
        workbench = {};
        currentProjectTree = {};
        currentProject = null;

        let uiState = {}; // Default UI state

        // Load UI state from global collection
        const uiStateDoc = await getDoc(doc(db, "global", "uiState"));

        // Get saved UI state or create default
        if (uiStateDoc.exists()) {
            uiState = uiStateDoc.data();
            currentProject = uiState.currentProject || null;
            currentProjectTree = uiState.currentProject ? currentProject.currentProjectTree : {};
            workbench = uiState.workbench || {};
            expandedFolders = uiState.expandedFolders || [];
        } else {
            // Create default UI state if it doesn't exist
            uiState = {
                currentProject: null,
                expandedFolders: [],
                workbench: {},
                lastModified: new Date().toISOString()
            };
            await setDoc(doc(db, "global", "uiState"), uiState);
        }

        console.log("Loaded currentProject:", currentProject, "workbench:", workbench, "uiState:", uiState);

        return uiState;
    } catch (error) {
        console.error("Error loading projects:", error);
        throw error;
    }
}

// Save both file structure and UI state
export async function persistProjectAndWorkbenchToFirestore(uiState = {}) {
    try {
        // Save project data with full file content
        if (currentProject) {
            const projectRef = doc(db, "projects", currentProject);
            const projectData = {
                name: currentProject,
                fileStructure: currentProject.currentProjectTree,
                lastModified: new Date().toISOString(),
                mainTexFile: mainTexFile
            };
            
            console.log('Saving project data:', projectData);
            await setDoc(projectRef, projectData);
        }

        // Save global UI state with expanded folders
        const uiStateRef = doc(db, "global", "uiState");
        await setDoc(uiStateRef, {
            currentProject,
            expandedFolders: uiState.expandedFolders || [],
            lastModified: new Date().toISOString()
        }, { merge: true });

        // Save global UI state with project structure
        const globalRef = doc(db, "global", "uiState");
        await setDoc(globalRef, {
            currentProject,
            expandedFolders: uiState.expandedFolders || [],
            workbench,
            lastModified: new Date().toISOString()
        }, { merge: true });

    } catch (error) {
        console.error("Error saving structure:", error);
        throw error; // Propagate error for handling
    }
}

// Add getter for file structure
export function getCurrentProjectFiles() {
    return currentProject ? currentProject.currentProjectTree : null;
}

export async function switchProject(projectName) {
    if (!Object.keys(workbench).includes(projectName)) {
        console.error(`Project ${projectName} not found`);
        return;
    }

    currentProject = projectName;
    const projectRef = doc(db, "projects", projectName);
    const projectDoc = await getDoc(projectRef);
    
    if (projectDoc.exists()) {
        mainTexFile = projectDoc.data().mainTexFile || "main.tex";
        currentProjectTree = projectDoc.data().fileStructure;
    }

    // Update UI state in Firestore
    await setDoc(doc(db, "global", "uiState"), {
        currentProject: projectName,
        lastModified: new Date().toISOString()
    }, { merge: true });

    return getCurrentProjectFiles();
}