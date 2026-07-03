document.addEventListener('DOMContentLoaded', () => {

  /* ── Scroll-reveal for cards ── */
  const revealEls = document.querySelectorAll(
    '.b-stage-card, .b-detail-inner, .b-teacher-card, .b-parallel-card, .b-parallel-card-vertical'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));

  /* ── Parallax: hero + chapter images ── */
  const hero = document.getElementById('b-hero');
  const heroBg = hero?.querySelector('.b-hero-bg');
  const chapterImages = document.querySelectorAll('.b-chapter-image');
  let ticking = false;

  if (heroBg || chapterImages.length) {
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          const viewH = window.innerHeight;

          /* Hero parallax */
          if (heroBg && hero) {
            const heroHeight = hero.offsetHeight;
            if (scrolled < heroHeight) {
              const progress = scrolled / heroHeight;
              heroBg.style.transform = `translateY(${progress * 30}px)`;
              heroBg.style.opacity = 1 - progress * 0.6;
            }
          }

          /* Chapter image parallax — background moves slower than scroll */
          chapterImages.forEach(img => {
            const rect = img.getBoundingClientRect();
            const imgH = img.offsetHeight;
            if (rect.top < viewH + imgH && rect.bottom > -imgH) {
              const imgCenter = rect.top + imgH / 2;
              const viewCenter = viewH / 2;
              const offset = (imgCenter - viewCenter) * 0.12;
              const clamped = Math.max(-40, Math.min(40, offset));
              img.style.backgroundPosition = `center calc(30% + ${clamped}px)`;
            }
          });

          ticking = false;
        });
        ticking = true;
      }
    });
  }

});
