document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.gl-alpha-link').forEach(link => {
    link.addEventListener('click', (e) => {
      document.querySelectorAll('.gl-alpha-link').forEach(l => l.style.color = '');
      link.style.color = 'var(--gl-gold)';
    });
  });
});
