import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { renderFileExplorer } from './uiManager.js';

// Module-level variables
export let projectStructure = [];          // List of project names
export let explorerTree = { Projects: {} }; // UI representation
export let currentProject = null;          // Active project
export let mainTexFile = "main.tex";       // Default main file
let fileStructure = {};                    // Private project files store

// Simplified project creation
export async function createProjectInFirestore(projectName) {
    const projectRef = doc(db, "projects", projectName);
    
    const projectData = {
        name: projectName,
        createdAt: new Date().toISOString(),
        fileStructure: {
            [mainTexFile]: "\\documentclass{article}\n\\begin{document}\n\\end{document}"
        },
        mainTexFile
    };

    await setDoc(projectRef, projectData);
    console.log(`Project '${projectName}' created`);
}

// Cleaner project loading
export async function loadProjectsFromFirestore() {
    try {
        const [projects, uiState] = await Promise.all([
            getDocs(collection(db, "projects")),
            getDoc(doc(db, "global", "uiState"))
        ]);

        // Reset state
        projectStructure = [];
        explorerTree = { Projects: {} };
        fileStructure = {};
        
        // Process projects
        projects.forEach(doc => {
            const project = doc.data();
            projectStructure.push(project.name);
            explorerTree.Projects[project.name] = {};
            fileStructure[project.name] = project.fileStructure || {};
        });

        // Set current project
        if (!currentProject && projectStructure.length > 0) {
            currentProject = projectStructure[0];
            mainTexFile = projects.docs[0].data().mainTexFile || "main.tex";
        }

        return uiState.exists() ? uiState.data() : {};
    } catch (error) {
        console.error("Error loading projects:", error);
        throw error;
    }
}

// Simplified project persistence
export async function persistCurrentProjectToFirestore(uiState = {}) {
    if (!currentProject) return;

    try {
        await Promise.all([
            // Save project data
            setDoc(doc(db, "projects", currentProject), {
                name: currentProject,
                fileStructure: fileStructure[currentProject],
                uiState,
                lastModified: new Date().toISOString(),
                mainTexFile
            }, { merge: true }),

            // Save global state
            setDoc(doc(db, "global", "uiState"), {
                currentProject,
                lastModified: new Date().toISOString()
            }, { merge: true })
        ]);
    } catch (error) {
        console.error("Error persisting project:", error);
        throw error;
    }
}

// Simple getter for current project files
export function getCurrentProjectFiles() {
    return currentProject ? fileStructure[currentProject] : null;
}