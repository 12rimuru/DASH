window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get QR code and secret from main process
        if (window.api && typeof window.api.get2FASetup === 'function') {
            const { qrDataUrl, secret, shown } = await window.api.get2FASetup();
            const qrEl = document.getElementById('qr-code');
            const keyEl = document.getElementById('manual-key');
            if (qrEl) {
                if (qrDataUrl) {
                    qrEl.src = qrDataUrl;
                    qrEl.style.display = 'block';
                } else {
                    qrEl.style.display = 'none';
                }
            }
            if (keyEl) {
                if (secret) {
                    keyEl.textContent = secret;
                    keyEl.style.display = 'block';
                } else {
                    keyEl.style.display = 'none';
                }
            }
        }
    } catch (e) {
        // Silent fail in preview/non-electron environments
        console.error('2FA setup error:', e);
    }

    // Focus and move between code boxes
    const boxes = Array.from({ length: 6 }, (_, i) => document.getElementById(`code-${i}`));
    boxes[0].focus();
    boxes.forEach((box, idx) => {
        box.addEventListener('input', (e) => {
            const val = box.value.replace(/[^0-9]/g, '');
            box.value = val;
            if (val && idx < 5) boxes[idx + 1].focus();
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                boxes[idx - 1].focus();
            }
        });
    });

    document.getElementById('verify-btn').addEventListener('click', async () => {
        const code = boxes.map(b => b.value).join('');
        if (!/^[0-9]{6}$/.test(code)) {
            showError('Please enter a valid 6-digit code');
            return;
        }
        if (!window.api || typeof window.api.verify2FA !== 'function') {
            showError('Verification is only available in the desktop app.');
            return;
        }
        const result = await window.api.verify2FA(code);
        if (result.success) {
            window.api.send2FASuccess();
        } else {
            showError('Invalid code. Please try again.');
            boxes.forEach(b => b.value = '');
            boxes[0].focus();
        }
    });

    function showError(msg) {
        document.getElementById('error-msg').textContent = msg;
    }
});