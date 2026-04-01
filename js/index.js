/* =========================================
   1. LIVE BACKEND API WRAPPER (MongoDB Linked)
   ========================================= */
const storedApiHost = localStorage.getItem('apiHost');
const API_HOST = !storedApiHost || storedApiHost === 'http://127.0.0.1:5000'
  ? 'http://127.0.0.1:5001'
  : storedApiHost;
if (storedApiHost !== API_HOST) localStorage.setItem('apiHost', API_HOST);
const BASE_URL = `${API_HOST}/api`;

const API = {
  // 1. READ: Fetch all turfs from MongoDB
  getTurfs: async () => {
    try {
        const response = await fetch(`${BASE_URL}/turfs`);
        const turfsArray = await response.json();
        
        let turfDict = {};
        turfsArray.forEach(turf => { 
            turfDict[turf._id] = {
                id: turf._id,
                name: turf.name,
                meta: turf.meta || `${turf.location || 'Chennai'} • ${(turf.sports || ['Multi-sport']).join(', ')}`,
                basePrice: turf.basePrice,
                panoramaUrl: turf.panoramaUrl || null
            }; 
        });
        return Object.keys(turfDict).length > 0 ? turfDict : defaultTurfData;
    } catch (err) {
        console.error("Backend not reachable. Falling back to defaults.", err);
        return defaultTurfData;
    }
  },

  // 2. READ: Fetch all bookings from MongoDB
  getBookings: async () => {
    try {
        const response = await fetch(`${BASE_URL}/bookings`);
        const bookingsArray = await response.json();
        
        let bookingDict = {};
        bookingsArray.forEach(b => {
            const tId = b.turfId && b.turfId._id ? b.turfId._id : b.turfId;
            if (!tId) return;
            if (!bookingDict[tId]) bookingDict[tId] = [];
            
            const numericSlots = (b.slots || []).map(s => parseInt(s, 10)).filter(Number.isInteger);
            bookingDict[tId].push(...numericSlots);
        });
        return bookingDict;
    } catch (err) {
        return defaultBookings;
    }
  },

  getBlocked: async () => { return JSON.parse(localStorage.getItem('blocked')) || defaultBlocked; },

  // 3. CREATE: Save a newly listed turf to MongoDB
  saveNewTurf: async (newTurf) => {
    try {
        const response = await fetch(`${BASE_URL}/turfs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTurf)
        });
        return await response.json();
    } catch (err) { console.error("Failed to save turf", err); }
  },

  // 4. CREATE: Save a new booking to MongoDB
  saveBooking: async (turfId, newSlots, bookingDate, upiTransactionId = '') => {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser')) || { name: "Guest", email: "guest@test.com" };
        const payload = {
            turfId: turfId,
            userName: user.name,
            userEmail: user.email,
            slots: newSlots.map(String),
            date: bookingDate,
            paymentMethod: 'UPI',
            paymentStatus: upiTransactionId ? 'Paid' : 'Pending',
            upiTransactionId
        };
        
        const response = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (err) { console.error("Failed to book slot", err); }
  }
};

/* =========================================
   2. DEFAULT DATA & STATE
   ========================================= */
const defaultTurfData = {
  "1": { name: "GreenLine Arena", meta: "Velachery • Football, Cricket", basePrice: 1200, panoramaUrl: "https://pannellum.org/images/alma.jpg" },
  "2": { name: "Boundary Line Turf", meta: "Tambaram • Cricket box", basePrice: 800, panoramaUrl: null },
  "3": { name: "SkyLine Sports Hub", meta: "OMR • Multi‑sport", basePrice: 1000, panoramaUrl: null }
};
const defaultBookings = { "1": [6, 7, 20], "2": [18, 19], "3": [5, 6, 21] };
const defaultBlocked = { "1": [3], "2": [2, 3], "3": [] };

let turfData = {};
let bookings = {};
let blocked = {};

const hours = Array.from({ length: 24 }, (_, i) => i);
const turfImages = {
  "1": ["aerial-view-grass-field-hockey.jpg", "hc-digital-9sOleIZAE54-unsplash.jpg"],
  "2": ["izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg", "nguy-n-hi-p-XHDRUHXcsl0-unsplash.jpg"],
  "3": ["thomas-park-fDmpxdV69eA-unsplash.jpg", "timothy-tan-PAe2UhGo-S4-unsplash.jpg"]
};

let currentTurfId = null;
let selectedSlots = [];
let panoramaViewer = null;
let panoramaVisible = false;
let activeBookingPaymentIntent = null;

/* =========================================
   3. INITIALIZATION
   ========================================= */
async function init() {
  trackVisits();
  updateUserAuthUI();
  loadWeather();

  // Show the starter turfs immediately so the home page never loads empty.
  turfData = { ...defaultTurfData };
  bookings = { ...defaultBookings };
  blocked = await API.getBlocked();
  renderTurfGrid();
  
  turfData = await API.getTurfs();
  bookings = await API.getBookings();
  
  if(!localStorage.getItem('turfData')) localStorage.setItem('turfData', JSON.stringify(defaultTurfData));

  renderTurfGrid();
  startAlternatingImages();

  const dateInput = document.getElementById("bookingDate");
  const today = new Date().toISOString().split("T")[0];
  if(dateInput) {
    dateInput.value = today;
    dateInput.min = today;
    dateInput.addEventListener("change", () => {
      document.getElementById("selectedDateText").textContent = dateInput.value === today ? "Today" : dateInput.value;
      renderSlots();
    });
  }
}

/* =========================================
   4. UI RENDERING (Grid)
   ========================================= */
function renderTurfGrid() {
  const grid = document.getElementById("turfGrid");
  if(!grid) return;
  grid.innerHTML = "";

  Object.entries(turfData).forEach(([id, turf]) => {
    const article = document.createElement("article");
    article.className = "turf-card";
    
    const imageUrl = turfImages[id] ? turfImages[id][0] : "https://images.unsplash.com/photo-1529900948632-58674ba19306?w=400";
    
    const metaString = turf.meta || "Chennai • Multi-sport";
    const location = metaString.split(" • ")[0] || "Chennai";
    const tag = metaString.split(" • ")[1] || "Multi-sport";

    article.innerHTML = `
      <div class="turf-image">
        <div class="turf-image-inner" id="turf-img-${id}" style="background-image: url('${imageUrl}');"></div>
        <span class="turf-tag">${tag}</span>
        <span class="turf-price-pill">₹${turf.basePrice} / hr</span>
      </div>
      <div class="turf-body">
        <div class="turf-title-row">
          <div>
            <div class="turf-name">${turf.name}</div>
            <div class="turf-location">${location}</div>
          </div>
          <button class="btn-sm" style="background:rgba(255,255,255,0.1); border:1px solid #444; color:white; padding:4px 8px; border-radius:4px; font-size:10px;" 
            onclick="event.stopPropagation(); openManageBookings('${id}')">Manage</button>
        </div>
      </div>
    `;

    article.addEventListener("click", () => openModal(id));
    grid.appendChild(article);
  });
}

function startAlternatingImages() {
  let imgIndex = 0;
  setInterval(() => {
    imgIndex = (imgIndex + 1) % 2;
    Object.keys(turfImages).forEach(id => {
      const imgEl = document.getElementById(`turf-img-${id}`);
      if (imgEl && turfImages[id]) imgEl.style.backgroundImage = `url('${turfImages[id][imgIndex]}')`;
    });
  }, 3000);
}

/* =========================================
   5. OWNER CRUD LOGIC 
   ========================================= */
function openTurfModal() {
    const modal = document.getElementById('turfModal');
    if(modal) modal.style.display = 'flex';
}

function closeOwnerModals() {
    if(document.getElementById('turfModal')) document.getElementById('turfModal').style.display = 'none';
    if(document.getElementById('manageBookingsModal')) document.getElementById('manageBookingsModal').style.display = 'none';
}

async function handleCreateTurf() {
    const name = document.getElementById('newTurfName').value;
    const loc = document.getElementById('newTurfLoc').value;
    const price = document.getElementById('newTurfPrice').value;

    if(!name || !loc) {
        showToast("Fill in the turf details, bro!", "error");
        return;
    }

    const newTurf = {
        name: name,
        meta: `${loc} • Football`,
        basePrice: parseInt(price),
        panoramaUrl: null
    };

    await API.saveNewTurf(newTurf);
    showToast(`🎉 ${name} listed successfully!`, "success");
    
    turfData = await API.getTurfs();
    renderTurfGrid();
    closeOwnerModals();
}

function openManageBookings(id) {
    currentTurfId = id;
    const log = JSON.parse(localStorage.getItem('bookingLog')) || [];
    const turfBookings = log.filter(entry => entry.turfId == id);
    const container = document.getElementById('bookingListContainer');
    const modal = document.getElementById('manageBookingsModal');
    
    if(!container || !modal) return;
    
    modal.style.display = 'flex';

    if(turfBookings.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">No bookings for this turf yet.</p>`;
        return;
    }

    container.innerHTML = turfBookings.map(b => `
        <div class="request-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05);">
            <div>
                <div style="font-weight:800; color:white;">${b.userName || 'Player'}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">Slots: ${b.slots.map(formatHour).join(', ')}</div>
            </div>
            <div>
                ${b.status === 'Pending' ? `
                    <button onclick="updateLogStatus('${b.id}', 'Confirmed')" class="btn-sm" style="background:var(--primary); color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;">Approve</button>
                ` : `<span style="color:#60A5FA; font-weight:bold;">Confirmed</span>`}
            </div>
        </div>
    `).join('');
}

function updateLogStatus(logId, status) {
    let log = JSON.parse(localStorage.getItem('bookingLog')) || [];
    const entry = log.find(e => String(e.id) === String(logId));
    if(entry) entry.status = status;
    localStorage.setItem('bookingLog', JSON.stringify(log));
    showToast(`Booking ${status}!`, "success");
    openManageBookings(currentTurfId);
}

/* =========================================
   6. BOOKING & PANORAMA LOGIC
   ========================================= */
function openModal(turfId) {
  currentTurfId = turfId;
  const turf = turfData[turfId];
  
  if(!turf) return console.error("Could not find turf data for ID:", turfId);

  document.getElementById("modalTurfName").textContent = turf.name;
  document.getElementById("modalTurfMeta").textContent = turf.meta || "Chennai • Multi-sport";
  
  selectedSlots = [];
  
  // FORCE HIDE THE "TEAM OPENINGS" UI JUNK
  const tabOpenings = document.getElementById('tabOpenings');
  const secOpenings = document.getElementById('openingsSection');
  const secBooking = document.getElementById('bookingSection');
  // Also hide the tab row if your HTML has it
  const tabContainer = document.querySelector('.modal-tabs');
  
  if (tabOpenings) tabOpenings.style.display = 'none';
  if (secOpenings) secOpenings.style.display = 'none';
  if (secBooking) secBooking.style.display = 'block';
  if (tabContainer) tabContainer.style.display = 'none'; // Makes it just a clean modal

  updateBookingSummary();
  renderSlots();
  
  const view360Btn = document.getElementById("view360Btn");
  if(view360Btn) view360Btn.style.display = turf.panoramaUrl ? "inline-block" : "none";
  
  document.getElementById("slotModalBackdrop").style.display = "flex";
  togglePanorama(false);
}

function closeModal() {
  document.getElementById("slotModalBackdrop").style.display = "none";
  if (panoramaViewer) { panoramaViewer.destroy(); panoramaViewer = null; }
}

function togglePanorama(show = !panoramaVisible) {
  panoramaVisible = show;
  const section = document.getElementById("panoramaSection");
  const btn = document.getElementById("view360Btn");
  
  if(!section) return;

  if (show) {
    section.style.display = "block";
    if(btn) btn.textContent = "Hide 360° Panorama";
    const turf = turfData[currentTurfId];
    if(turf && turf.panoramaUrl) {
        panoramaViewer = pannellum.viewer('panorama', { "type": "equirectangular", "panorama": turf.panoramaUrl, "autoLoad": true });
    }
  } else {
    section.style.display = "none";
    if(btn) btn.textContent = "View 360° Panorama";
    if (panoramaViewer) { panoramaViewer.destroy(); panoramaViewer = null; }
  }
}

function renderSlots() {
  const grid = document.getElementById("slotsGrid");
  if(!grid) return;
  grid.innerHTML = "";
  
  const bookedSlots = bookings[currentTurfId] || [];
  const blockedSlots = blocked[currentTurfId] || [];

  hours.forEach((h) => {
    const pill = document.createElement("button");
    pill.className = "slot-pill";
    pill.textContent = formatHour(h);
    pill.type = "button";
    
    if (blockedSlots.includes(h)) {
      pill.classList.add("blocked");
      pill.setAttribute("aria-label", `${formatHour(h)} blocked by admin`);
      pill.addEventListener("mouseenter", showSlotTooltip);
      pill.addEventListener("mousemove", moveSlotTooltip);
      pill.addEventListener("mouseleave", hideSlotTooltip);
    }
    else if (bookedSlots.includes(h)) {
      pill.classList.add("booked");
      pill.setAttribute("aria-label", `${formatHour(h)} already booked`);
    }
    else {
      pill.classList.add("free");
      pill.setAttribute("aria-label", `${formatHour(h)} available to book`);
      if (selectedSlots.includes(h)) pill.classList.add("selected");
      pill.addEventListener("click", () => toggleSlot(h));
    }
    grid.appendChild(pill);
  });
}

function showSlotTooltip(event) {
  const tooltip = document.getElementById("slotTooltip");
  if (!tooltip) return;
  tooltip.textContent = "Blocked by admin";
  tooltip.classList.add("visible");
  tooltip.setAttribute("aria-hidden", "false");
  moveSlotTooltip(event);
}

function moveSlotTooltip(event) {
  const tooltip = document.getElementById("slotTooltip");
  if (!tooltip) return;
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function hideSlotTooltip() {
  const tooltip = document.getElementById("slotTooltip");
  if (!tooltip) return;
  tooltip.classList.remove("visible");
  tooltip.setAttribute("aria-hidden", "true");
}

function formatHour(h) {
  const hourNum = parseInt(h, 10);
  if (isNaN(hourNum)) return "N/A";
  const fmt = (x) => `${x % 12 || 12}:00 ${x < 12 ? "AM" : "PM"}`;
  return `${fmt(hourNum)} – ${fmt((hourNum + 1) % 24)}`;
}

function toggleSlot(h) {
  const index = selectedSlots.indexOf(h);
  if (index >= 0) selectedSlots.splice(index, 1);
  else selectedSlots.push(h);
  renderSlots();
  updateBookingSummary();
}

function updateBookingSummary() {
  const count = selectedSlots.length;
  const countText = document.getElementById("slotCountText");
  const selectedText = document.getElementById("selectedSlotsText");
  const priceText = document.getElementById("totalPriceText");

  if(countText) countText.textContent = `${count} hr${count === 1 ? "" : "s"} selected`;
  
  if (count === 0) {
    if(selectedText) selectedText.textContent = "Select slots on the left.";
    if(priceText) priceText.textContent = "Total: ₹0";
  } else {
    if(selectedText) selectedText.textContent = `Selected: ${selectedSlots.map(formatHour).join(", ")}`;
    if(priceText) priceText.textContent = `Total: ₹${turfData[currentTurfId].basePrice * count}`;
  }
}

/* =========================================
   7. UPI PAYMENT & BOOKING CONFIRMATION
   ========================================= */
async function confirmBooking() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if(!user) {
      alert("Please login first to book a slot!");
      window.location.href = 'login.html';
      return;
  }

  if (selectedSlots.length === 0) return showToast("Select slots first!", "error");
  const amountInRupees = turfData[currentTurfId].basePrice * selectedSlots.length;
  const rzpModal = document.getElementById('mockRazorpayBackdrop');
  if (rzpModal) {
      document.getElementById('rzpAmount').innerText = `₹${amountInRupees}`;
      document.getElementById('bookingTxnId').value = '';
      activeBookingPaymentIntent = null;
      rzpModal.style.display = 'flex';
  }
}

function closeMockRazorpay() {
    const rzpModal = document.getElementById('mockRazorpayBackdrop');
    if (rzpModal) rzpModal.style.display = 'none';
}

async function fetchPaymentIntent(amount, purpose, reference) {
    const response = await fetch(`${BASE_URL}/payments/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, purpose, reference })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Could not create payment intent.');
    }
    return data;
}

async function startBookingUpiPayment() {
    if (!currentTurfId || selectedSlots.length === 0) {
        showToast("Select slots first!", "error");
        return;
    }

    const turfName = turfData[currentTurfId] ? turfData[currentTurfId].name : 'Turf Booking';
    const amountInRupees = turfData[currentTurfId].basePrice * selectedSlots.length;

    try {
        activeBookingPaymentIntent = await fetchPaymentIntent(
            amountInRupees,
            `${turfName} Booking`,
            `BOOK-${currentTurfId}-${Date.now()}`
        );
        window.location.href = activeBookingPaymentIntent.upiUrl;
        showToast("UPI app opened. Complete the payment and enter the transaction ID.");
    } catch (err) {
        showToast(err.message || "Could not open UPI app.", "error");
    }
}

async function processMockPayment() {
    const txnId = document.getElementById('bookingTxnId')?.value.trim();
    if (!txnId) {
        showToast("Enter the UPI transaction ID after paying.", "error");
        return;
    }
    closeMockRazorpay();
    await processSuccessfulBooking(txnId);
}

async function processSuccessfulBooking(txnId) {
  const bookingDate = document.getElementById("bookingDate")?.value || new Date().toISOString().split("T")[0];
  await API.saveBooking(currentTurfId, selectedSlots, bookingDate, txnId);
  showToast(`Success! Booking confirmed${txnId ? ` with UPI ref ${txnId}` : ""}.`, "success");
  setTimeout(() => { location.reload(); }, 1500);
}

/* =========================================
   8. UTILS & EXTERNAL APIs
   ========================================= */
async function loadWeather() {
  const weatherSpan = document.getElementById("weatherDisplay");
  try {
    const response = await fetch('https://wttr.in/Chennai?format=j1');
    const data = await response.json();
    const tempC = data.current_condition[0].temp_C;
    const cond = data.current_condition[0].weatherDesc[0].value;
    if(weatherSpan) weatherSpan.innerHTML = `🌤️ Chennai: ${tempC}°C, ${cond}`;
  } catch (e) { 
    if(weatherSpan) weatherSpan.style.display = "none"; 
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById("toastContainer");
  if(!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type} show`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3000);
}

function trackVisits() {
  let visits = parseInt(localStorage.getItem("visitCounter")) || 0;
  localStorage.setItem("visitCounter", ++visits);
  if(document.getElementById("visitCountDisplay")) {
      document.getElementById("visitCountDisplay").textContent = `Visits: ${visits}`;
  }
}

function updateUserAuthUI() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const container = document.getElementById('userAuthActions');
  if(!container) return;
  
  if (user) {
      container.innerHTML = `<a href="user-dashboard.html" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center;">Profile</a>`;
  } else {
      container.innerHTML = `<a href="login.html" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center;">Login</a>`;
  }
}

window.addEventListener("DOMContentLoaded", init);
