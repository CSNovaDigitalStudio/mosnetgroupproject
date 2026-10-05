const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');

navToggle?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

const quoteForm = document.getElementById('quoteForm');
quoteForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('name').value.trim();
  const service = document.getElementById('service').value;
  const location = document.getElementById('location').value.trim();
  const message = document.getElementById('message').value.trim();

  const text = [
    `Hi MOSNET GROUP, my name is ${name}.`,
    `I need a quote for: ${service}.`,
    `Project location: ${location}.`,
    message ? `Project details: ${message}` : '',
    `I can also send photos of the work if needed.`
  ].filter(Boolean).join('\n');

  window.open(`https://wa.me/27731621954?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
