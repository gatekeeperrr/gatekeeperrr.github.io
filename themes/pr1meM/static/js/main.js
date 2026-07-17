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
function toggleWikiNav(e) {
  if (e) e.stopPropagation();
  const el = document.querySelector('.wiki-nav');
  if (el) el.classList.toggle('mobile-open');
}
function closeWikiNav() {
  const el = document.querySelector('.wiki-nav');
  if (el) el.classList.remove('mobile-open');
}
document.addEventListener('click', e => {
  closeDropdown();
  if (!e.target.closest('.nav')) closeMobileMenu();
  if (!e.target.closest('.wiki-nav')) closeWikiNav();
});
