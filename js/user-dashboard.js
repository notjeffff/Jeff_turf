/* =========================================
   USER DASHBOARD - LIVE MONGODB LINK
   ========================================= */
const storedApiHost = localStorage.getItem('apiHost');
const API_HOST = !storedApiHost || storedApiHost === 'http://127.0.0.1:5000'
    ? 'http://127.0.0.1:5001'
    : storedApiHost;
if (storedApiHost !== API_HOST) localStorage.setItem('apiHost', API_HOST);
const BASE_URL = `${API_HOST}/api`;

async function fetchJsonOrThrow(path) {
    const response = await fetch(`${BASE_URL}${path}`);
    const rawText = await response.text();

    let data;
    try {
        data = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
        throw new Error(`Invalid JSON response from ${path}.`);
    }

    if (!response.ok) {
        const msg = data && data.error ? data.error : `Request failed with status ${response.status}`;
        throw new Error(msg);
    }

    return data;
}

async function init() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    // Security Guard: Kick them to login if not authenticated
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Personalize UI
    document.getElementById('welcomeName').innerHTML = `Welcome back, <span>${user.name.split(' ')[0]}</span>`;

    // Fetch live data from MongoDB
    await fetchAndRenderBookings(user.email);
    await fetchAndRenderTeams(user.email); 
}

/* =========================================
   1. FETCH BOOKINGS
   ========================================= */
async function fetchAndRenderBookings(userEmail) {
    const tableBody = document.getElementById('userBookingTable');
    
    try {
        const allBookings = await fetchJsonOrThrow('/bookings');
        
        // FILTER: Keep only bookings that belong to this exact user
        const myBookings = allBookings.filter(b => b.userEmail === userEmail);
        
        document.getElementById('countBookings').innerText = myBookings.length;

        if (myBookings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">No bookings yet. Ready for a match?</td></tr>`;
            return;
        }

        tableBody.innerHTML = myBookings.map(b => {
            const turfName = b.turfId && b.turfId.name ? b.turfId.name : "TurfArena Partner";
            const price = b.turfId && b.turfId.basePrice ? b.turfId.basePrice : 1000;
            
            return `
                <tr>
                    <td><strong>${turfName}</strong></td>
                    <td>${b.slots.map(formatHour).join(', ')}</td>
                    <td>₹${b.slots.length * price}</td>
                    <td><span class="status-tag tag-${b.status.toLowerCase()}">${b.status}</span></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to fetch user bookings:", err);
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#ef4444;">${err.message || 'Could not load bookings from server.'}</td></tr>`;
    }
}

function formatHour(h) {
    const hourNum = parseInt(h, 10);
    if (isNaN(hourNum)) return h;
    const fmt = (x) => `${x % 12 || 12}:00 ${x < 12 ? "AM" : "PM"}`;
    return `${fmt(hourNum)}`;
}

/* =========================================
   2. FETCH REAL TEAM REQUESTS 
   ========================================= */
async function fetchAndRenderTeams(userEmail) {
    const container = document.getElementById('userTeamsList');
    
    try {
        const allPosts = await fetchJsonOrThrow('/community');

        // Find all posts where this user's email is inside the "requests" array
        let myTeams = [];
        allPosts.forEach(post => {
            const userRequest = (post.requests || []).find(req => req.email === userEmail);
            if (userRequest) {
                myTeams.push({
                    name: post.teamName || "TurfArena Team",
                    sport: post.sport || "Multi-sport",
                    status: userRequest.status // 'Pending' or 'Accepted'
                });
            }
        });

        document.getElementById('countTeams').innerText = myTeams.length;

        if (myTeams.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">You haven't requested to join any teams yet.</p>`;
            return;
        }

        container.innerHTML = myTeams.map(t => {
            const badgeClass = t.status === 'Accepted' || t.status === 'Confirmed' ? 'confirmed' : 'pending';
            return `
            <div class="team-item" style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-weight:700;">${t.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${t.sport}</div>
                </div>
                <span class="status-tag tag-${badgeClass}">${t.status}</span>
            </div>
        `}).join('');

    } catch (err) {
        console.error("Failed to fetch teams:", err);
        container.innerHTML = `<p style="color:#ef4444; text-align:center;">${err.message || 'Could not load teams.'}</p>`;
    }
}

function logout() {
    if(confirm("Ready to sign out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

window.addEventListener('DOMContentLoaded', init);
