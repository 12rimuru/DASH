function showCustomDialog({ title, message, onConfirm, onCancel }) {
  // Remove existing dialog if any
  const existingDialog = document.querySelector('.dialog-overlay');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Create dialog elements
  const dialogOverlay = document.createElement('div');
  dialogOverlay.className = 'dialog-overlay';

  const dialogBox = document.createElement('div');
  dialogBox.className = 'dialog-box';

  const dialogTitle = document.createElement('div');
  dialogTitle.className = 'dialog-title';
  dialogTitle.textContent = title;

  const dialogMessage = document.createElement('div');
  dialogMessage.className = 'dialog-message';
  dialogMessage.textContent = message;

  const dialogButtons = document.createElement('div');
  dialogButtons.className = 'dialog-buttons';

  const confirmButton = document.createElement('button');
  confirmButton.className = 'dialog-btn dialog-btn-confirm';
  confirmButton.textContent = 'OK';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'dialog-btn dialog-btn-cancel';
  cancelButton.textContent = 'Cancel';

  // Append elements
  dialogButtons.appendChild(confirmButton);
  dialogButtons.appendChild(cancelButton);
  dialogBox.appendChild(dialogTitle);
  dialogBox.appendChild(dialogMessage);
  dialogBox.appendChild(dialogButtons);
  dialogOverlay.appendChild(dialogBox);
  document.body.appendChild(dialogOverlay);

  // Show dialog with animation
  setTimeout(() => {
    dialogOverlay.classList.add('active');
  }, 10);

  // Event listeners
  confirmButton.addEventListener('click', () => {
    if (onConfirm) {
      onConfirm();
    }
    closeDialog(dialogOverlay);
  });

  cancelButton.addEventListener('click', () => {
    if (onCancel) {
      onCancel();
    }
    closeDialog(dialogOverlay);
  });

  function closeDialog(overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }
}