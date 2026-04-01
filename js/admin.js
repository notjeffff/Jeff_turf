// Check if admin is logged in
if (!localStorage.getItem('adminLoggedIn')) {
  window.location.href = 'admin-login.html';
}

// Load data from localStorage (shared with index.html)
let turfData = JSON.parse(localStorage.getItem('turfData')) || {};
let bookings = JSON.parse(localStorage.getItem('bookings')) || {};
let blocked = JSON.parse(localStorage.getItem('blocked')) || {};

// Save to localStorage on changes
function saveData() {
  try {
    localStorage.setItem('turfData', JSON.stringify(turfData));
    localStorage.setItem('bookings', JSON.stringify(bookings));
    localStorage.setItem('blocked', JSON.stringify(blocked));
    console.log("Data saved successfully");
  } catch (e) {
    console.error("Save failed:", e);
    alert("Save error: Storage full? Clear cache and try smaller images.");
  }
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  document.getElementById(sectionId).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  event.target.classList.add('active');
  if (sectionId === 'dashboard') loadDashboard();
  if (sectionId === 'manage-turfs') loadTurfs();
  if (sectionId === 'manage-slots') loadSlotManagement();
}

// Global variables to store chart instances so we can update them safely
let revenueChartInstance = null;
let popularityChartInstance = null;

function loadDashboard() {
  // 1. Calculate Stats
  document.getElementById('totalTurfs').textContent = Object.keys(turfData).length;
  document.getElementById('totalBookings').textContent = Object.values(bookings).reduce((a, b) => a + (b || []).length, 0);
  const revenue = Object.entries(bookings).reduce((a, [id, slots]) => a + ((slots || []).length * (turfData[id]?.basePrice || 1000)), 0);
  document.getElementById('revenue').textContent = `₹${revenue}`;
  
  // 2. Mock Recent Bookings
  const recentList = document.getElementById('recentBookings');
  recentList.innerHTML = `
    <li style="padding:8px; border-bottom:1px solid rgba(148,163,184,0.2); display:flex; justify-content:space-between;">
      <span>GreenLine - 6-7 PM</span><span style="color: #10b981;">₹1200</span>
    </li>
    <li style="padding:8px; border-bottom:1px solid rgba(148,163,184,0.2); display:flex; justify-content:space-between;">
      <span>Boundary - 7-8 PM</span><span style="color: #10b981;">₹800</span>
    </li>
  `;

  // 3. Render Charts
  renderCharts();
}

function renderCharts() {
  // Chart styling colors to match your dark theme
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#9ca3af',
    plugins: { legend: { labels: { color: '#9ca3af' } } }
  };

  // --- REVENUE LINE CHART ---
  const revCtx = document.getElementById('revenueChart').getContext('2d');
  if (revenueChartInstance) revenueChartInstance.destroy(); // Destroy old chart before drawing new one

  // Mock data for the last 7 days
  const mockRevenueData = [4500, 3200, 5000, 2800, 6400, 8200, parseInt(document.getElementById('revenue').textContent.replace('₹', '')) || 0];
  
  revenueChartInstance = new Chart(revCtx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
      datasets: [{
        label: 'Revenue (₹)',
        data: mockRevenueData,
        borderColor: '#0080FF',
        backgroundColor: 'rgba(0, 128, 255, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4 // Makes the line smooth/curved
      }]
    },
    options: {
      ...chartOptions,
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
      }
    }
  });

  // --- POPULARITY DOUGHNUT CHART ---
  const popCtx = document.getElementById('popularityChart').getContext('2d');
  if (popularityChartInstance) popularityChartInstance.destroy();

  // Extract real booking counts from your localStorage data
  const turfNames = [];
  const turfBookingCounts = [];
  Object.entries(turfData).forEach(([id, turf]) => {
    turfNames.push(turf.name);
    turfBookingCounts.push((bookings[id] || []).length);
  });

  popularityChartInstance = new Chart(popCtx, {
    type: 'doughnut',
    data: {
      labels: turfNames.length > 0 ? turfNames : ['No Data'],
      datasets: [{
        data: turfBookingCounts.length > 0 ? turfBookingCounts : [1],
        backgroundColor: ['#006FCD', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      ...chartOptions,
      cutout: '70%' 
    }
  });
}

function loadSlotManagement() {
  const select = document.getElementById('slotTurfSelect');
  select.innerHTML = '<option value="">Select Turf</option>';
  Object.entries(turfData).forEach(([id, turf]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = turf.name;
    select.appendChild(option);
  });
}

function loadSlotsForTurf() {
  const turfId = document.getElementById('slotTurfSelect').value;
  if (!turfId) return;
  const management = document.getElementById('slotManagement');
  management.innerHTML = '';
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const blockedSlots = blocked[turfId] || [];
  hours.forEach(h => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = h.toString().padStart(2, '0') + ':00';
    const isBlocked = blockedSlots.includes(h);
    if (isBlocked) btn.classList.add('blocked');
    btn.onclick = () => toggleBlock(turfId, h, btn);
    management.appendChild(btn);
  });
}

function toggleBlock(turfId, hour, btn) {
  if (!blocked[turfId]) blocked[turfId] = [];
  const index = blocked[turfId].indexOf(hour);
  if (index > -1) {
    blocked[turfId].splice(index, 1);
    btn.classList.remove('blocked');
  } else {
    blocked[turfId].push(hour);
    btn.classList.add('blocked');
  }
  saveData();
}

function logout() {
  localStorage.removeItem('adminLoggedIn');
  window.location.href = 'index.html';
}

// Manage Turfs
function loadTurfs() {
  const list = document.getElementById('turfList');
  list.innerHTML = '';
  Object.entries(turfData).forEach(([id, turf]) => {
    const item = document.createElement('div');
    item.className = 'turf-item';
    item.innerHTML = `
      <div class="turf-info">
        <h4>${turf.name}</h4>
        <p style="color:var(--muted); font-size:12px;">${turf.meta} | ₹${turf.basePrice}/hr</p>
        ${turf.image ? '<p style="color:#60A5FA; font-size:10px;">Image uploaded</p>' : ''}
        ${turf.panoramaUrl ? '<p style="color:#3B82F6; font-size:10px;">360° Panorama uploaded</p>' : ''}
      </div>
      <div class="turf-actions">
        <button class="btn btn-primary" onclick="editTurf(${id})" style="padding:6px 12px; font-size:12px;">Edit</button>
        <button class="btn btn-danger" onclick="deleteTurf(${id})" style="padding:6px 12px; font-size:12px;">Delete</button>
      </div>
    `;
    list.appendChild(item);
  });
}

let editingTurfId = null;
function openAddTurfForm() {
  editingTurfId = null;
  document.getElementById('formTitle').textContent = 'Add Turf';
  document.getElementById('turfForm').reset();
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('panoramaPreview').style.display = 'none';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('turfFormModal').style.display = 'flex';
}

function editTurf(id) {
  editingTurfId = id;
  const turf = turfData[id];
  document.getElementById('formTitle').textContent = 'Edit Turf';
  document.getElementById('turfName').value = turf.name;
  document.getElementById('turfLocation').value = turf.meta.split(' • ')[0] || '';
  document.getElementById('turfMeta').value = turf.meta.split(' • ')[1] || '';
  document.getElementById('turfPrice').value = turf.basePrice;
  if (turf.image) {
    document.getElementById('imagePreview').src = turf.image;
    document.getElementById('imagePreview').style.display = 'block';
  } else {
    document.getElementById('imagePreview').style.display = 'none';
  }
  if (turf.panoramaUrl) {
    document.getElementById('panoramaPreview').src = turf.panoramaUrl;
    document.getElementById('panoramaPreview').style.display = 'block';
  } else {
    document.getElementById('panoramaPreview').style.display = 'none';
  }
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('turfFormModal').style.display = 'flex';
}

function closeTurfForm() {
  document.getElementById('turfFormModal').style.display = 'none';
}

function fileToBase64(file, maxSizeMB = 2, compress = false) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`File too large (>${maxSizeMB}MB). File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`));
      return;
    }

    if (!compress) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

document.getElementById('turfImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('imagePreview');
  if (file) {
    fileToBase64(file, 2, true).then((data) => {
      preview.src = data;
      preview.style.display = 'block';
    }).catch((err) => {
      console.error('Image preview error:', err);
      preview.style.display = 'none';
      alert(err.message || 'Image too large. Use <2MB files.');
    });
  } else {
    preview.style.display = 'none';
  }
});

document.getElementById('turfPanorama').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('panoramaPreview');
  if (file) {
    fileToBase64(file, 10, true).then((data) => {
      preview.src = data;
      preview.style.display = 'block';
    }).catch((err) => {
      console.error('Panorama preview error:', err);
      preview.style.display = 'none';
      alert(err.message || 'Panorama too large. Use <10MB files.');
    });
  } else {
    preview.style.display = 'none';
  }
});

document.getElementById('turfForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = 'Saving...';
  statusEl.style.color = 'var(--accent)';

  const name = document.getElementById('turfName').value.trim();
  const location = document.getElementById('turfLocation').value.trim();
  const meta = document.getElementById('turfMeta').value.trim();
  const price = parseInt(document.getElementById('turfPrice').value);
  if (!name || !location || !meta || !price) {
    statusEl.textContent = 'Missing fields.';
    statusEl.style.color = 'var(--danger)';
    return;
  }

  const turfMeta = `${location} • ${meta}`;
  const imageInput = document.getElementById('turfImage');
  const panoramaInput = document.getElementById('turfPanorama');
  let imageData = null;
  let panoramaData = null;

  try {
    if (imageInput.files[0]) {
      imageData = await fileToBase64(imageInput.files[0], 2, true);
    }
    if (panoramaInput.files[0]) {
      panoramaData = await fileToBase64(panoramaInput.files[0], 10, true);
    }

    if (editingTurfId) {
      turfData[editingTurfId] = { 
        name, 
        meta: turfMeta, 
        basePrice: price, 
        image: imageData || turfData[editingTurfId].image, 
        panoramaUrl: panoramaData || turfData[editingTurfId].panoramaUrl 
      };
    } else {
      const newId = (Math.max(...Object.keys(turfData).map(Number), 0) + 1).toString();
      turfData[newId] = { 
        name, 
        meta: turfMeta, 
        basePrice: price, 
        image: imageData, 
        panoramaUrl: panoramaData 
      };
      bookings[newId] = [];
      blocked[newId] = [];
    }
    saveData();
    loadTurfs();
    closeTurfForm();
    statusEl.textContent = 'Saved successfully!';
    statusEl.style.color = 'var(--success)';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch (err) {
    console.error('Upload error:', err);
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.style.color = 'var(--danger)';
  }
});

function deleteTurf(id) {
  if (confirm('Delete this turf?')) {
    delete turfData[id];
    delete bookings[id];
    delete blocked[id];
    saveData();
    loadTurfs();
  }
}

// Init
loadDashboard();
loadTurfs();
loadSlotManagement();