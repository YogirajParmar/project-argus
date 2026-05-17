function scrollToDownload() {
  document.getElementById('download').scrollIntoView({
    behavior: 'smooth',
  });
}

const WORKER_BASE_URL = 'https://license-server.docalert.workers.dev';
const CREATE_ORDER_URL = `${WORKER_BASE_URL}/payment/create-order`;
const VERIFY_PAYMENT_URL = `${WORKER_BASE_URL}/payment/verify`;
// const FILE_SECRET = 'docalert-license-bundle-v1';

// Add smooth scrolling to all internal links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');

    if (href === '#') {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      return;
    }

    if (href && href.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }
  });
});

// Razorpay Payment Modal Logic
const emailModal = document.getElementById('email-modal-overlay');
const buyBtn = document.getElementById('buy-btn');
const closeModal = document.getElementById('close-modal');
const proceedBtn = document.getElementById('modal-proceed-btn');
const downloadSection = document.getElementById('download');
const downloadLink = document.getElementById('download-link');
const licenseLink = document.getElementById('license-link');
// Device-bound purchase flow is temporarily disabled.
// const machineFileInput = document.getElementById('modal-machine-file');

if (buyBtn && emailModal) {
  buyBtn.onclick = function () {
    emailModal.style.display = 'flex';
    setTimeout(() => emailModal.classList.add('active'), 10);
  };

  function hideModal() {
    emailModal.classList.remove('active');
    setTimeout(() => (emailModal.style.display = 'none'), 300);
  }

  closeModal.onclick = hideModal;
  emailModal.onclick = function (e) {
    if (e.target === emailModal) hideModal();
  };

  proceedBtn.onclick = async function () {
    const userEmail = document.getElementById('modal-user-email').value;
    // const machineFile = machineFileInput?.files?.[0];

    if (!userEmail || !userEmail.includes('@')) {
      alert('Please enter a valid email address before proceeding.');
      return;
    }

    // Device-bound purchase flow is temporarily disabled.
    // if (!machineFile) {
    //   alert('Please upload your machine request file before proceeding.');
    //   return;
    // }

    hideModal();
    const originalBtnText = buyBtn.innerHTML;
    buyBtn.innerHTML = 'Processing...';
    buyBtn.disabled = true;

    try {
      // Device-bound purchase flow is temporarily disabled.
      // const machineRequest = await parseOpaqueLicenseFile(machineFile, 'docalert-machine-request');
      // const deviceFingerprint = machineRequest?.device_fingerprint;
      // if (!deviceFingerprint) {
      //   throw new Error('The uploaded machine request file is invalid.');
      // }

      // 1. First create an order via your Worker
      const orderRes = await fetch(CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          // device_fingerprint: deviceFingerprint,
        }),
      });
      if (!orderRes.ok) {
        throw new Error('Failed to create payment order.');
      }

      const order = await orderRes.json();

      // Your Razorpay Key ID
      const RAZORPAY_KEY_ID = 'rzp_test_SheV7H6NILPxE6';

      // 2. Open Razorpay popup
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'DocAlert',
        description: '1 Year License',
        order_id: order.id,
        prefill: { email: userEmail },
        handler: async function (response) {
          try {
            buyBtn.innerHTML = 'Verifying payment...';

            const verifyRes = await fetch(VERIFY_PAYMENT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                // device_fingerprint: deviceFingerprint,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              throw new Error('Payment verification failed.');
            }

            const verifyData = await verifyRes.json();
            const downloadUrl =
              verifyData.downloadUrl ||
              (verifyData.downloadToken
                ? `${WORKER_BASE_URL}/download?token=${encodeURIComponent(verifyData.downloadToken)}`
                : null);

            if (!verifyData.ok || !downloadUrl) {
              throw new Error('Download link could not be generated.');
            }

            showSuccessMessage(downloadUrl, verifyData.licenseFile);
          } catch (verificationError) {
            console.error(verificationError);
            alert(
              'Payment was received, but download verification failed. Please contact support.',
            );
            buyBtn.innerHTML = originalBtnText;
            buyBtn.disabled = false;
          }
        },
        modal: {
          ondismiss: function () {
            buyBtn.innerHTML = originalBtnText;
            buyBtn.disabled = false;
          },
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('Error initiating payment.');
      buyBtn.innerHTML = originalBtnText;
      buyBtn.disabled = false;
    }
  };

  function showSuccessMessage(downloadUrl, licenseFile) {
    buyBtn.innerHTML = '✅ Payment verified! Your download is ready.';
    buyBtn.disabled = true;
    if (downloadLink) {
      downloadLink.href = downloadUrl;
      downloadLink.removeAttribute('aria-disabled');
      downloadLink.textContent = 'Download your app';
    }
    if (licenseLink && licenseFile?.content) {
      const blob = new Blob([licenseFile.content], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      licenseLink.href = objectUrl;
      licenseLink.download = licenseFile.fileName || 'docalert.license';
      licenseLink.removeAttribute('aria-disabled');
      licenseLink.textContent = 'Download your license file';
    }
    if (downloadSection) {
      downloadSection.style.display = 'flex';
    }
  }
}

/*
async function parseOpaqueLicenseFile(file, expectedType) {
  const content = await file.text();
  const envelope = JSON.parse(content);

  if (envelope.type !== expectedType) {
    throw new Error('Unexpected file type.');
  }

  const decoded = base64ToBytes(envelope.payload);
  const iv = decoded.slice(0, 12);
  const tag = decoded.slice(12, 28);
  const ciphertext = decoded.slice(28);
  const combinedCiphertext = new Uint8Array(ciphertext.length + tag.length);
  combinedCiphertext.set(ciphertext, 0);
  combinedCiphertext.set(tag, ciphertext.length);

  const secretKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(FILE_SECRET));
  const key = await crypto.subtle.importKey('raw', secretKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    combinedCiphertext,
  );

  return JSON.parse(new TextDecoder().decode(plaintext));
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
*/
