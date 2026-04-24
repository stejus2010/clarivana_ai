document.addEventListener("DOMContentLoaded", () => {
  const navBtns = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      pages.forEach(p => p.classList.remove("active"));
      const target = btn.getAttribute("data-target");
      document.getElementById(target).classList.add("active");
    });
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    alert("Redirecting to login...");
    // simulate redirect
  });

  document.getElementById("edit-btn").addEventListener("click", () => {
    alert("Edit profile coming soon!");
  });
});
