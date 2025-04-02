// Configure the PDF.js worker
export function configurePDFJS(workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

// Ensure PDF.js is ready
export function ensurePDFJSReady() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 5;
    const interval = 500;

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

// Update the toolbar creation function with simple Unicode symbols
export function setupPDFToolbar() {
  // Create toolbar if it doesn't exist
  let toolbar = document.querySelector('.pdftoolbar');
  if (!toolbar) {
    const previewContainer = document.getElementById("preview-container");
    if (!previewContainer) return;
    
    toolbar = document.createElement('div');
    toolbar.className = 'pdftoolbar';
    
    // Use Unicode symbols directly as text content
    toolbar.innerHTML = `
      <button class="btn" data-action="zoomIn" title="Zoom In">+</button>
      <button class="btn" data-action="zoomOut" title="Zoom Out">−</button>
      <span class="zoom-value">100%</span>
      <button class="btn" data-action="prev" title="Previous Page">◄</button>
      <span class="page-info">1/1</span>
      <button class="btn" data-action="next" title="Next Page">►</button>
      <button class="btn" data-action="fit" title="Fit to Width">↔</button>
    `;
    
    previewContainer.insertBefore(toolbar, previewContainer.firstChild);
  }
  
  setupToolbarActions(toolbar);
}

// Set up toolbar button actions
function setupToolbarActions(toolbar) {
  const zoomInBtn = toolbar.querySelector('[data-action="zoomIn"]');
  const zoomOutBtn = toolbar.querySelector('[data-action="zoomOut"]');
  const prevBtn = toolbar.querySelector('[data-action="prev"]');
  const nextBtn = toolbar.querySelector('[data-action="next"]');
  const fitBtn = toolbar.querySelector('[data-action="fit"]');
  const zoomValue = toolbar.querySelector('.zoom-value');
  const pageInfo = toolbar.querySelector('.page-info');
  
  let currentScale = 1.5;
  let currentPage = 1;
  let totalPages = 1;
  
  // Add safety checks for all button click handlers
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (!window.currentPDFDoc) return;
      
      currentScale += 0.25;
      if (currentScale > 3) currentScale = 3;
      if (zoomValue) zoomValue.textContent = Math.round(currentScale * 100) + '%';
      
      try {
        renderPDFPage(window.currentPDFDoc, currentPage, currentScale);
      } catch (error) {
        console.error("Error handling zoom in:", error);
      }
    });
  }
  
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (!window.currentPDFDoc) return;
      
      currentScale -= 0.25;
      if (currentScale < 0.5) currentScale = 0.5;
      if (zoomValue) zoomValue.textContent = Math.round(currentScale * 100) + '%';
      
      try {
        renderPDFPage(window.currentPDFDoc, currentPage, currentScale);
      } catch (error) {
        console.error("Error handling zoom out:", error);
      }
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (!window.currentPDFDoc) return;
      
      if (currentPage > 1) {
        currentPage--;
        if (pageInfo) pageInfo.textContent = `${currentPage}/${totalPages}`;
        
        try {
          renderPDFPage(window.currentPDFDoc, currentPage, currentScale);
        } catch (error) {
          console.error("Error handling previous page:", error);
        }
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!window.currentPDFDoc) return;
      
      if (currentPage < totalPages) {
        currentPage++;
        if (pageInfo) pageInfo.textContent = `${currentPage}/${totalPages}`;
        
        try {
          renderPDFPage(window.currentPDFDoc, currentPage, currentScale);
        } catch (error) {
          console.error("Error handling next page:", error);
        }
      }
    });
  }
  
  if (fitBtn) {
    fitBtn.addEventListener('click', () => {
      if (!window.currentPDFDoc) return;
      
      try {
        // Use a specific fit value instead of 'fit' string
        const canvas = document.getElementById("pdf-canvas");
        if (canvas) {
          const container = canvas.parentElement;
          const containerWidth = container.clientWidth - 40;
          const page = window.currentPDFDoc.getPage(currentPage);
          if (page) {
            const viewport = page.getViewport({ scale: 1 });
            const scaleFactor = containerWidth / viewport.width;
            currentScale = scaleFactor;
            if (zoomValue) zoomValue.textContent = Math.round(currentScale * 100) + '%';
            renderPDFPage(window.currentPDFDoc, currentPage, currentScale);
          }
        }
      } catch (error) {
        console.error("Error handling fit:", error);
      }
    });
  }
}

// Render a specific PDF page with scale control
export function renderPDFPage(pdfDoc, pageNumber, scale = 1.5) {
  try {
    console.log(`Rendering PDF page ${pageNumber} at scale ${scale}`);
    
    // Store reference to current PDF document
    window.currentPDFDoc = pdfDoc;
    
    // Get total pages and update UI
    const pageInfo = document.querySelector('.page-info');
    if (pageInfo) {
      pageInfo.textContent = `${pageNumber}/${pdfDoc.numPages}`;
    }
    
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
      
      // Handle 'fit' scale
      let viewport;
      if (scale === 'fit') {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth - 40; // Add some padding
        const originalViewport = page.getViewport({ scale: 1 });
        const scaleFactor = containerWidth / originalViewport.width;
        viewport = page.getViewport({ scale: scaleFactor });
      } else {
        viewport = page.getViewport({ scale });
      }
      
      // Set the canvas dimensions based on viewport
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render the PDF page on the canvas
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

// Show PDF in iframe as fallback
export function showPDFInIframe(pdfUrl) {
  try {
    console.log("Falling back to iframe PDF viewer");
    
    const previewContainer = document.getElementById("preview-container");
    if (!previewContainer) {
      console.error("Preview container not found");
      return;
    }
    
    // Clear container
    previewContainer.innerHTML = "";
    
    // Create iframe for PDF viewing
    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    
    // Add iframe to container
    previewContainer.appendChild(iframe);
    console.log("PDF iframe added to container");
  } catch (error) {
    console.error("Error in showPDFInIframe:", error);
  }
}

// Initialize all PDF viewer components
export function initPDFViewer() {
  document.addEventListener('DOMContentLoaded', function() {
    setupPDFToolbar();
  });
}

// Add this to your main JS file
document.addEventListener('DOMContentLoaded', function() {
    // Create a test element to check if codicon font loaded
    const testEl = document.createElement('div');
    testEl.style.fontFamily = 'codicon';
    testEl.style.visibility = 'hidden';
    testEl.style.position = 'absolute';
    testEl.textContent = '\uea9d'; // codicon-zoom-in
    document.body.appendChild(testEl);
    
    // Check if font loaded correctly
    setTimeout(() => {
        const fontLoaded = testEl.offsetWidth > 0;
        console.log('Codicon font loaded:', fontLoaded);
        if (!fontLoaded) {
            // Fallback to direct loading
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/vscode-codicons@0.0.31/dist/codicon.css';
            document.head.appendChild(link);
            console.log('Added fallback codicon CSS');
        }
        document.body.removeChild(testEl);
    }, 500);
});