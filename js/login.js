/* =========================================
   1. AUTH STATE & TOGGLE LOGIC
   ========================================= */
let isLoginMode = true;

/**
 * Switches the UI between Login and Registration
 */
function toggleAuth() {
    isLoginMode = !isLoginMode;
    
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const regFields = document.getElementById('registerFields');
    const submitBtn = document.getElementById('submitBtn');
    const toggleText = document.getElementById('toggleText');

    // Reset form errors if any
    document.getElementById('authForm').reset();

    if (isLoginMode) {
        title.textContent = "Welcome Back";
        subtitle.textContent = "Login to manage your team and bookings.";
        regFields.style.display = 'none';
        submitBtn.textContent = "Login to Arena";
        toggleText.innerHTML = `Don't have an account? <a href="#" onclick="toggleAuth()">Create one</a>`;
    } else {
        title.textContent = "Join the Arena";
        subtitle.textContent = "Create an account to start hosting teams.";
        regFields.style.display = 'block';
        submitBtn.textContent = "Create My Account";
        toggleText.innerHTML = `Already have an account? <a href="#" onclick="toggleAuth()">Login here</a>`;
    }
}

/* =========================================
   2. FORM SUBMISSION (MOCK DATABASE)
   ========================================= */
document.getElementById('authForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('userEmail').value.trim();
    const pass = document.getElementById('userPass').value.trim();

    if (isLoginMode) {
        // --- LOGIN LOGIC ---
        // We look for the user in localStorage (Our temporary Browser DB)
        const savedUser = JSON.parse(localStorage.getItem(`user_${email}`));
        
        if (savedUser && savedUser.pass === pass) {
            // SUCCESS: Save "Session" and Redirect
            localStorage.setItem('currentUser', JSON.stringify({
                name: savedUser.name,
                email: savedUser.email,
                phone: savedUser.phone,
                role: 'user' // Default role
            }));

            alert(`🔥 Welcome back, ${savedUser.name}! Loading your dashboard...`);
            window.location.href = 'community.html';
        } else {
            alert("❌ Invalid email or password. Please try again.");
        }
    } else {
        // --- REGISTRATION LOGIC ---
        const name = document.getElementById('userName').value.trim();
        const phone = document.getElementById('userPhone').value.trim();

        if (!name || !phone || !email || !pass) {
            alert("Please fill all fields!");
            return;
        }

        // Save new user to localStorage
        const newUser = { name, email, phone, pass };
        localStorage.setItem(`user_${email}`, JSON.stringify(newUser));
        
        alert("✅ Account created successfully! You can now login.");
        toggleAuth(); // Flip back to login screen
    }
});

/* =========================================
   3. UTILS & AUTO-LOGOUT
   ========================================= */
// If a user hits this page while already logged in, we could redirect them
window.onload = () => {
    const session = localStorage.getItem('currentUser');
    if (session) {
        console.log("User already logged in as:", JSON.parse(session).name);
    }
};