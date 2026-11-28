function toggleMobileMenu() {
  document.querySelector('.nav').classList.toggle('mobile-open');
}
function closeMobileMenu() {
  document.querySelector('.nav').classList.remove('mobile-open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav')) closeMobileMenu();
});
