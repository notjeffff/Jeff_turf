function handleLogin() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const error = document.getElementById('loginError');

  if (!email || !pass) {
    error.textContent = "Please fill all fields.";
    return;
  }

  // Mock user data
  const userData = {
    name: "Rahul Sharma",
    email: email,
    phone: "9876543210",
    joinedDate: "Jan 2026"
  };

  localStorage.setItem('currentUser', JSON.stringify(userData));
  window.location.href = 'user-dashboard.html';
}