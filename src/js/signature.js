// Signature handling functionality for Electron Payroll

// Initialize signature pad when the employee modal is shown
function initSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  const clearButton = document.getElementById('clear-signature-btn');
  const deleteButton = document.getElementById('delete-signature-btn');
  
  if (!canvas) return;
  
  // Initialize signature pad
  const signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'rgb(255, 255, 255)',
    penColor: 'rgb(0, 0, 0)'
  });
  
  // Adjust canvas size
  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear(); // Clear the canvas
  }
  
  // Set initial size
  resizeCanvas();
  
  // Add event listener for window resize
  window.addEventListener('resize', resizeCanvas);
  
  // Clear signature button - only clears the canvas
  if (clearButton) {
    clearButton.addEventListener('click', function() {
      signaturePad.clear();
    });
  }
  
  // Delete signature button - clears canvas and removes saved signature
  if (deleteButton) {
    deleteButton.addEventListener('click', function() {
      deleteSignature(signaturePad);
    });
  }
  
  return signaturePad;
}

// Get signature data as base64 string
function getSignatureData(signaturePad) {
  if (!signaturePad || signaturePad.isEmpty()) {
    return null;
  }
  
  return signaturePad.toDataURL('image/png');
}

// Set signature data to canvas
function setSignatureData(signaturePad, signatureData) {
  if (!signaturePad || !signatureData) return;
  
  // Clear the pad first
  signaturePad.clear();
  
  // Create a new image
  const image = new Image();
  image.onload = function() {
    const canvas = signaturePad._canvas;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  };
  image.src = signatureData;
}

// Delete signature data and update UI
function deleteSignature(signaturePad) {
  if (!signaturePad) return;
  
  // Clear the signature pad
  signaturePad.clear();
  
  // Clear the hidden input field that stores signature data
  const signatureDataInput = document.getElementById('employee-signature-data');
  if (signatureDataInput) {
    signatureDataInput.value = '';
  }
  
  // Hide the signature preview
  const signaturePreview = document.getElementById('signature-preview');
  if (signaturePreview) {
    signaturePreview.src = '';
    signaturePreview.classList.remove('has-signature');
  }
  
  // Show notification that signature was deleted
  // The showNotification function is defined in app.js
  if (typeof window.showNotification === 'function') {
    window.showNotification('Signature deleted successfully', 'success');
  } else if (typeof $ !== 'undefined' && typeof $.notify === 'function') {
    $.notify({
      message: 'Signature deleted successfully'
    }, {
      type: 'success'
    });
  }
}

// Display signature in the salary slip
function displaySignatureInSalarySlip(salarySlipContent, signatureData, employeeName) {
  if (!salarySlipContent || !signatureData) return;

  // Find all payslip containers; if none, treat the content as a single container
  const containers = salarySlipContent.querySelectorAll('.payslip-container');
  const targets = containers.length ? Array.from(containers) : [salarySlipContent];

  targets.forEach(container => {
    // Support both footer class names
    const footer = container.querySelector('.payslip-footer') || container.querySelector('.salary-slip-footer');
    if (!footer) return;

    let signatureContainer = container.querySelector('.signature-container');
    if (!signatureContainer) {
      signatureContainer = document.createElement('div');
      signatureContainer.className = 'signature-container';
      footer.appendChild(signatureContainer);
    }

    // Set signature image and employee name
    signatureContainer.innerHTML = `
      <div class="signature-image">
        <img src="${signatureData}" alt="${employeeName}'s Signature">
      </div>
      <div class="signature-name">${employeeName}</div>
    `;
  });
}