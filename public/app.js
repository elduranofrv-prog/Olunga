const form = document.querySelector('#payment-form');
const status = document.querySelector('#status');
const button = form.querySelector('button');

function show(message, kind = '') {
  status.textContent = message;
  status.className = `status ${kind}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  button.disabled = true;
  show('Sending M-Pesa prompt…');
  try {
    const response = await fetch('/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: form.phoneNumber.value, amount: form.amount.value })
    });
    const data = await response.json();
    if (!response.ok) {
      const fieldError = data.fields ? Object.values(data.fields).join(' ') : data.error;
      throw new Error(fieldError || 'Payment could not be initiated.');
    }
    show(data.customerMessage || data.message || 'Prompt sent. Check your phone.', 'success');
  } catch (error) {
    show(error.message || 'Network error. Please try again.', 'error');
  } finally {
    button.disabled = false;
  }
});
