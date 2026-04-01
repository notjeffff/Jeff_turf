const storedApiHost = localStorage.getItem('apiHost');
const API_HOST = !storedApiHost || storedApiHost === 'http://127.0.0.1:5000'
    ? 'http://127.0.0.1:5001'
    : storedApiHost;
if (storedApiHost !== API_HOST) localStorage.setItem('apiHost', API_HOST);
const BASE_URL = `${API_HOST}/api`;

let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let communityPosts = [];
let activePostId = null;
let activePaymentIntent = null;

window.onload = async () => {
    updateAuthUI();
    await fetchCommunityData();
};

function updateAuthUI() {
    const authAction = document.getElementById('userAuthActions');
    if (!authAction) return;

    if (currentUser) {
        authAction.innerHTML = `<button style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; border:none; cursor:pointer;" onclick="window.location.href='user-dashboard.html'">Hi, ${currentUser.name.split(' ')[0]}</button>`;
    } else {
        authAction.innerHTML = `<button style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; border:none; cursor:pointer;" onclick="window.location.href='login.html'">Login</button>`;
    }
}

async function fetchJsonOrThrow(path, options) {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

async function fetchCommunityData() {
    try {
        communityPosts = await fetchJsonOrThrow('/community');
        renderLobby();
        renderWars();
        renderTournaments();
    } catch (err) {
        console.error('Failed to fetch from MongoDB:', err);
        showToast(err.message || 'Database connection error', 'error');
    }
}

function switchCommTab(tabId, buttonEl) {
    document.querySelectorAll('.comm-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabId}Section`).style.display = 'block';
    if (buttonEl) buttonEl.classList.add('active');
}

function getPostById(id) {
    return communityPosts.find(post => post._id === id);
}

function getAcceptedRequest(post) {
    return (post.requests || []).find(entry => entry.status === 'Accepted');
}

function getLiveRequestCount(post) {
    return (post.requests || []).filter(entry => entry.status !== 'Rejected').length;
}

function formatEventMeta(post) {
    const parts = [];
    if (post.eventDate) parts.push(post.eventDate);
    if (post.eventTime) parts.push(post.eventTime);
    if (post.turf) parts.push(post.turf);
    return parts.join(' • ') || 'Details will be announced';
}

function renderLobby() {
    const grid = document.getElementById('lobbyGrid');
    const solos = communityPosts.filter(p => p.postType === 'solo');
    if (!grid) return;

    if (solos.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);">No team openings yet. Be the first captain to post one.</p>`;
        return;
    }

    grid.innerHTML = solos.map(post => {
        const isOwner = currentUser && currentUser.email === post.createdBy;
        const pendingCount = (post.requests || []).filter(r => r.status === 'Pending').length;
        const acceptedCount = (post.requests || []).filter(r => r.status === 'Accepted').length;

        return `
        <div class="comm-card">
            <h3 style="margin-top:10px;">${post.teamName} needs players</h3>
            <p class="meta">📍 ${post.turf || 'Turf TBA'}</p>
            <div class="details" style="display:flex; justify-content:space-between; margin: 15px 0; gap:10px; flex-wrap:wrap;">
                <span style="font-weight:bold;">👤 ${post.spots} spots left</span>
                <span style="color:var(--primary); font-weight:bold;">💰 ₹${post.fare || 0}/pp</span>
                <span style="color:var(--text-muted);">Accepted: ${acceptedCount}</span>
            </div>
            <div style="display:flex; gap:10px;">
                ${isOwner
                    ? `<button class="btn-sm" style="flex:1; background:#1e293b; color:white; border:1px solid #444;" onclick="openManageModal('${post._id}')">Manage (${pendingCount})</button>`
                    : `<button class="btn-join" style="flex:1;" onclick="openJoinModal('${post._id}')" ${post.spots === 0 ? 'disabled' : ''}>${post.spots === 0 ? 'Team Full' : 'Join Team'}</button>`
                }
            </div>
        </div>
    `;
    }).join('');
}

function openJoinModal(id) {
    if (!currentUser) return alert('You must be logged in to join a team.');
    const post = getPostById(id);
    if (!post) return;
    if ((post.requests || []).some(r => r.email === currentUser.email)) {
        return alert('You already sent a request to this team.');
    }

    activePostId = id;
    document.getElementById('joinContext').innerText = `Requesting to join ${post.teamName}.`;
    document.getElementById('playerName').value = currentUser.name;
    document.getElementById('playerPhone').value = currentUser.phone || '';
    document.getElementById('joinPlayerModal').style.display = 'flex';
}

function closeJoinModal() {
    document.getElementById('joinPlayerModal').style.display = 'none';
}

async function submitJoinRequest() {
    const post = getPostById(activePostId);
    const phone = document.getElementById('playerPhone').value.trim();
    if (!post) return;

    try {
        await fetchJsonOrThrow(`/community/${activePostId}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentUser.name,
                email: currentUser.email,
                phone,
                status: 'Pending'
            })
        });

        showToast('Request sent to the captain.');
        closeJoinModal();
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Failed to send request.', 'error');
    }
}

function renderWars() {
    const grid = document.getElementById('warsGrid');
    const wars = communityPosts.filter(p => p.postType === 'team');
    if (!grid) return;

    if (wars.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);">No turf wars open right now.</p>`;
        return;
    }

    grid.innerHTML = wars.map(war => {
        const isOpen = war.status === 'Open';
        const isOwner = currentUser && currentUser.email === war.createdBy;
        const acceptedRequest = getAcceptedRequest(war);
        const challengerName = acceptedRequest ? (acceptedRequest.teamName || acceptedRequest.name) : 'Unknown Team';

        return `
        <div class="comm-card" style="border: 1px solid ${isOpen ? 'rgba(255,255,255,0.05)' : '#ef4444'};">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <span class="status-tag" style="background:rgba(239, 68, 68, 0.1); color:#ef4444; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold;">TURF WAR</span>
                <span style="font-size:12px; color:${isOpen ? '#10b981' : '#ef4444'}; font-weight:bold;">${isOpen ? 'Looking for Opponent' : 'Match Locked'}</span>
            </div>
            <h3 style="margin-top:10px; ${!isOpen ? 'color:#ef4444;' : ''}">${isOpen ? `${war.teamName} is challenging!` : `${war.teamName} VS ${challengerName}`}</h3>
            <p class="meta">📍 ${war.turf || 'Turf TBA'}</p>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-top:10px;">${formatEventMeta(war)}</p>
            <p style="color:white; font-weight:600;">Total stake: ₹${war.fare || 0}</p>
            ${isOpen && !isOwner
                ? `<button class="btn-join" style="width:100%; margin-top:15px; background:#ef4444; border:none;" onclick="openTurfWarModal('${war._id}')">Pay Share & Accept</button>`
                : `<button class="btn-join" style="width:100%; margin-top:15px; background:#1e293b; color:#94a3b8; border:1px solid #334155;" disabled>${isOpen ? (isOwner ? 'Waiting for an opponent' : 'Unavailable') : 'Match Scheduled'}</button>`
            }
        </div>
    `;
    }).join('');
}

function openTurfWarModal(id) {
    if (!currentUser) return alert('You must be logged in to accept challenges.');
    const war = getPostById(id);
    if (!war) return;
    if (war.createdBy === currentUser.email) return alert('You cannot accept your own challenge.');

    activePostId = id;
    activePaymentIntent = null;

    const totalCost = Number(war.fare || 0);
    const splitCost = Math.max(1, Math.ceil(totalCost / 2));

    document.getElementById('warHostName').innerText = war.teamName;
    document.getElementById('warTotalCost').innerText = `₹${totalCost}`;
    document.getElementById('warSplitCost').innerText = `₹${splitCost}`;
    document.getElementById('warChallengerName').value = '';
    document.getElementById('warTxnId').value = '';
    document.getElementById('turfWarModal').style.display = 'flex';
}

async function startWarPayment() {
    const war = getPostById(activePostId);
    if (!war) return;

    try {
        const amount = Math.max(1, Math.ceil(Number(war.fare || 0) / 2));
        activePaymentIntent = await fetchJsonOrThrow('/payments/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                purpose: `Turf War ${war.teamName}`,
                reference: `WAR-${war._id}-${Date.now()}`
            })
        });

        window.location.href = activePaymentIntent.upiUrl;
        showToast('UPI app opened. Complete the payment and paste the transaction ID here.');
    } catch (err) {
        showToast(err.message || 'Could not open UPI payment.', 'error');
    }
}

async function confirmTurfWar() {
    const war = getPostById(activePostId);
    const challengerName = document.getElementById('warChallengerName').value.trim();
    const upiTransactionId = document.getElementById('warTxnId').value.trim();
    if (!war) return;
    if (!challengerName) return alert('Enter your team name to accept the challenge.');
    if (!upiTransactionId) return alert('Enter the UPI transaction ID after paying your share.');

    try {
        await fetchJsonOrThrow(`/community/${activePostId}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentUser.name,
                teamName: challengerName,
                email: currentUser.email,
                phone: currentUser.phone || '',
                status: 'Accepted',
                paymentStatus: 'Paid',
                paymentAmount: Math.max(1, Math.ceil(Number(war.fare || 0) / 2)),
                upiTransactionId
            })
        });

        await fetchJsonOrThrow(`/community/${activePostId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Matched' })
        });

        showToast('Challenge locked in successfully.');
        document.getElementById('turfWarModal').style.display = 'none';
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Failed to lock in the match.', 'error');
    }
}

function openPostModal(type) {
    if (!currentUser) return alert('You must be logged in to post.');
    document.getElementById('postType').value = type;
    document.getElementById('modalTitle').innerText = type === 'solo' ? 'Post Individual Opening' : 'Issue Turf War Challenge';
    document.getElementById('soloFields').style.display = type === 'solo' ? 'block' : 'none';
    document.getElementById('teamFields').style.display = type === 'team' ? 'block' : 'none';
    document.getElementById('commModal').style.display = 'flex';
}

function closeCommModal() {
    document.getElementById('commModal').style.display = 'none';
}

async function handlePostSubmit() {
    const type = document.getElementById('postType').value;
    const teamName = document.getElementById('commName').value.trim();
    if (!teamName) return alert('Team name is required.');

    const newPost = {
        postType: type,
        sport: document.getElementById('commSport').value,
        teamName,
        turf: document.getElementById('commTurf').value.trim(),
        spots: Number(document.getElementById('commSpots').value || 0),
        fare: Number(document.getElementById('commFare').value || 0),
        eventDate: document.getElementById('commDate').value,
        eventTime: document.getElementById('commTime').value,
        createdBy: currentUser.email
    };

    try {
        await fetchJsonOrThrow('/community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPost)
        });

        closeCommModal();
        showToast('Community post created successfully.');
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Failed to post to server.', 'error');
    }
}

function renderTournaments() {
    const grid = document.getElementById('tournamentGrid');
    const tournaments = communityPosts.filter(post => post.postType === 'tournament');
    if (!grid) return;

    if (tournaments.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);">No tournaments are live right now.</p>`;
        return;
    }

    grid.innerHTML = tournaments.map(post => {
        const joinedTeams = getLiveRequestCount(post);
        const hasJoined = (post.requests || []).some(entry => entry.email === (currentUser && currentUser.email));
        const isFull = post.maxTeams > 0 && joinedTeams >= post.maxTeams;
        const isOwner = currentUser && currentUser.email === post.createdBy;

        return `
        <div class="comm-card" style="border:1px solid rgba(253, 224, 71, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div>
                    <span class="status-tag" style="background:rgba(253, 224, 71, 0.12); color:#fde047;">TOURNAMENT</span>
                    <h3 style="margin:12px 0 6px;">${post.teamName}</h3>
                </div>
                <span style="color:${isFull ? '#ef4444' : '#10b981'}; font-weight:700; font-size:0.8rem;">${isFull ? 'Full' : (post.status || 'Open')}</span>
            </div>
            <p class="meta">${formatEventMeta(post)}</p>
            <div class="details" style="display:grid; gap:10px; margin:16px 0;">
                <div style="display:flex; justify-content:space-between;"><span>Entry Fee</span><strong>₹${post.fare || 0}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>Prize Pool</span><strong>${post.prizePool || post.turf || 'TBA'}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>Teams Joined</span><strong>${joinedTeams}${post.maxTeams ? ` / ${post.maxTeams}` : ''}</strong></div>
            </div>
            ${isOwner
                ? `<button class="btn-sm" style="width:100%; background:#1e293b; color:white; border:1px solid #444;" onclick="openManageModal('${post._id}')">View Teams (${joinedTeams})</button>`
                : `<button class="btn-join" style="width:100%; ${hasJoined ? 'background:#1e293b; color:#94a3b8; border:1px solid #334155;' : 'background:#fde047; color:#000; border:none;'}" onclick="openTournamentModal('${post._id}')" ${hasJoined || isFull ? 'disabled' : ''}>${hasJoined ? 'Already Registered' : (isFull ? 'Registration Closed' : 'Pay & Register')}</button>`
            }
        </div>
        `;
    }).join('');
}

function openTournamentModal(id) {
    if (!currentUser) return alert('You must be logged in to register for a tournament.');
    const post = getPostById(id);
    if (!post) return;
    if ((post.requests || []).some(entry => entry.email === currentUser.email)) {
        return alert('You already registered for this tournament.');
    }

    activePostId = id;
    activePaymentIntent = null;
    document.getElementById('tourneyNameDisplay').innerText = post.teamName;
    document.getElementById('tourneyFeeDisplay').innerText = `Entry Fee: ₹${post.fare || 0}`;
    document.getElementById('tourneyTeamName').value = '';
    document.getElementById('tourneyPhone').value = currentUser.phone || '';
    document.getElementById('tourneyTxnId').value = '';
    document.getElementById('tournamentModal').style.display = 'flex';
}

async function startTournamentPayment() {
    const post = getPostById(activePostId);
    if (!post) return;

    try {
        activePaymentIntent = await fetchJsonOrThrow('/payments/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: Number(post.fare || 0),
                purpose: `Tournament ${post.teamName}`,
                reference: `TRN-${post._id}-${Date.now()}`
            })
        });

        window.location.href = activePaymentIntent.upiUrl;
        showToast('UPI app opened. Complete the payment and paste the transaction ID to finish registration.');
    } catch (err) {
        showToast(err.message || 'Could not open UPI payment.', 'error');
    }
}

async function confirmTourneyRegistration() {
    const post = getPostById(activePostId);
    const teamName = document.getElementById('tourneyTeamName').value.trim();
    const phone = document.getElementById('tourneyPhone').value.trim();
    const upiTransactionId = document.getElementById('tourneyTxnId').value.trim();
    if (!post) return;
    if (!teamName || !phone) return alert('Enter your team name and captain phone number.');
    if (!upiTransactionId) return alert('Enter the UPI transaction ID after paying the fee.');

    try {
        await fetchJsonOrThrow(`/community/${activePostId}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentUser.name,
                teamName,
                email: currentUser.email,
                phone,
                status: 'Pending',
                paymentStatus: 'Paid',
                paymentAmount: Number(post.fare || 0),
                upiTransactionId
            })
        });

        document.getElementById('tournamentModal').style.display = 'none';
        showToast('Tournament registration submitted successfully.');
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Registration failed.', 'error');
    }
}

function openManageModal(postId) {
    const post = getPostById(postId);
    if (!post) return;
    activePostId = postId;

    const container = document.getElementById('requestsListContainer');
    const requests = post.requests || [];

    if (requests.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px 0;">No requests yet.</p>`;
    } else {
        container.innerHTML = requests.map(request => `
            <div class="request-item">
                <div>
                    <div style="font-weight:700; color:white;">${request.teamName || request.name || 'Unknown Applicant'}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${request.email || 'No email'}${request.phone ? ` • ${request.phone}` : ''}</div>
                    <div style="font-size:0.8rem; color:${request.status === 'Accepted' ? '#10b981' : request.status === 'Rejected' ? '#ef4444' : '#fde047'}; margin-top:6px;">${request.status}</div>
                    ${request.upiTransactionId ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">UPI Ref: ${request.upiTransactionId}</div>` : ''}
                </div>
                ${post.postType === 'tournament'
                    ? `<div style="font-size:0.8rem; color:var(--text-muted); text-align:right;">₹${request.paymentAmount || post.fare || 0}<br>${request.paymentStatus || 'Pending'}</div>`
                    : `<div style="display:flex; gap:8px;">
                        <button class="btn-sm" style="background:#10b981; color:white;" onclick="updateRequestStatus('${post._id}', '${request._id}', 'Accepted')">Accept</button>
                        <button class="btn-sm" style="background:#ef4444; color:white;" onclick="updateRequestStatus('${post._id}', '${request._id}', 'Rejected')">Reject</button>
                    </div>`
                }
            </div>
        `).join('');
    }

    document.getElementById('manageRequestsModal').style.display = 'flex';
}

function closeManageModal() {
    document.getElementById('manageRequestsModal').style.display = 'none';
}

async function updateRequestStatus(postId, requestId, status) {
    try {
        await fetchJsonOrThrow(`/community/${postId}/request/${requestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        showToast(`Request ${status.toLowerCase()}.`);
        await fetchCommunityData();
        openManageModal(postId);
    } catch (err) {
        showToast(err.message || 'Could not update request.', 'error');
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
