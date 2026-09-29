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
  const message = document.getElementById('message').value.trim();

  const text = [
    `Hi MOSNET GROUP, my name is ${name}.`,
    `I need a quote for: ${service}.`,
    message ? `Details: ${message}` : ''
  ].filter(Boolean).join('\n');

  window.open(`https://wa.me/27731621954?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

document.getElementById('year').textContent = new Date().getFullYear();
