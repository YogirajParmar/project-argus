function scrollToDownload() {
  document.getElementById('download').scrollIntoView({
    behavior: 'smooth',
  });
}

// Add smooth scrolling to all internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
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

if (buyBtn && emailModal) {
  buyBtn.onclick = function () {
    emailModal.style.display = 'flex';
    setTimeout(() => emailModal.classList.add('active'), 10);
  };

  function hideModal() {
    emailModal.classList.remove('active');
    setTimeout(() => emailModal.style.display = 'none', 300);
  }

  closeModal.onclick = hideModal;
  emailModal.onclick = function(e) {
    if(e.target === emailModal) hideModal();
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
      const orderRes = await fetch('http://localhost:8787/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });
      const order = await orderRes.json();
      console.log(order);

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
        handler: function (response) {
          showSuccessMessage();
        },
        modal: {
          ondismiss: function() {
            buyBtn.innerHTML = originalBtnText;
            buyBtn.disabled = false;
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch(err) {
      console.error(err);
      alert('Error initiating payment.');
      buyBtn.innerHTML = originalBtnText;
      buyBtn.disabled = false;
    }
  };

  function showSuccessMessage() {
    buyBtn.innerHTML = '✅ Payment successful! Check your email for the license key.';
    buyBtn.disabled = true;
    document.getElementById('download').style.display = 'flex';
  }
}