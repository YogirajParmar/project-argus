function scrollToDownload() {
  document.getElementById('download').scrollIntoView({
    behavior: 'smooth',
  });
}

const WORKER_BASE_URL = 'https://license-server.docalert.workers.dev';
const CREATE_ORDER_URL = `${WORKER_BASE_URL}/payment/create-order`;
const VERIFY_PAYMENT_URL = `${WORKER_BASE_URL}/payment/verify`;

// Add smooth scrolling to all internal links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
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

    if (!userEmail || !userEmail.includes('@')) {
      alert('Please enter a valid email address before proceeding.');
      return;
    }

    hideModal();
    const originalBtnText = buyBtn.innerHTML;
    buyBtn.innerHTML = 'Processing...';
    buyBtn.disabled = true;

    try {
      // 1. First create an order via your Worker
      const orderRes = await fetch(CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
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

            showSuccessMessage(downloadUrl);
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

  function showSuccessMessage(downloadUrl) {
    buyBtn.innerHTML = '✅ Payment verified! Your download is ready.';
    buyBtn.disabled = true;
    if (downloadLink) {
      downloadLink.href = downloadUrl;
      downloadLink.removeAttribute('aria-disabled');
      downloadLink.textContent = 'Download your app';
    }
    if (downloadSection) {
      downloadSection.style.display = 'flex';
    }
  }
}
