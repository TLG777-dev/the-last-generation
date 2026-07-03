document.addEventListener('DOMContentLoaded', () => {

  /* ── Scroll-reveal for feast cards ── */
  const cards = document.querySelectorAll('.hf-feast-inner');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  cards.forEach(card => observer.observe(card));

  /* ── Parallax hero background ── */
  const hero = document.getElementById('hf-hero');
  const heroBg = hero?.querySelector('.hf-hero-bg');
  let ticking = false;

  if (heroBg) {
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          const heroHeight = hero.offsetHeight;
          if (scrolled < heroHeight) {
            const progress = scrolled / heroHeight;
            heroBg.style.transform = `translateY(${progress * 30}px)`;
            heroBg.style.opacity = 1 - progress * 0.6;
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

});
