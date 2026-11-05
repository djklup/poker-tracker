export function initAuth(onAuthStateChangedCallback) {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) {
    loginBtn.onclick = async () => {
      const fb = window.FirebaseServices;
      if (!fb || !fb.auth || !fb.googleProvider) {
        alert("Firebase services are still loading. Please wait a second and try again.");
        return;
      }

      try {
        loginBtn.textContent = "Signing in...";
        loginBtn.disabled = true;
        await fb.signInWithPopup(fb.auth, fb.googleProvider);
      } catch (err) {
        console.error("Auth Error Details:", err);
        alert("Login Error: " + err.message);
        loginBtn.textContent = "Sign in with Google";
        loginBtn.disabled = false;
      }
    };
  }

  logoutBtn.onclick = () => {
    const fb = window.FirebaseServices;
    if (fb) fb.signOut(fb.auth);
  };

  const fb = window.FirebaseServices;
  if (fb && fb.auth) {
    fb.onAuthStateChanged(fb.auth, (user) => {
      onAuthStateChangedCallback(user);
    });
  }
}
