function toggleMobileMenu() {
  document.querySelector('.nav').classList.toggle('mobile-open');
  closeDropdown();
}
function closeMobileMenu() {
  document.querySelector('.nav').classList.remove('mobile-open');
}
function toggleDropdown(e) {
  e.stopPropagation();
  document.getElementById('wr-dropdown').classList.toggle('open');
}
function closeDropdown() {
  const d = document.getElementById('wr-dropdown');
  if (d) d.classList.remove('open');
}
document.addEventListener('click', e => {
  closeDropdown();
  if (!e.target.closest('.nav')) closeMobileMenu();
});
