document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dg-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dg-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
