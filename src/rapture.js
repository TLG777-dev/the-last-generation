document.addEventListener('DOMContentLoaded', () => {

  /* ── Scroll-reveal for cards ── */
  const revealEls = document.querySelectorAll(
    '.r-pattern-card, .r-evidence-card, .r-view-card, .r-cal-card, .r-teacher-card, .r-salv-card'
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

  /* ── Timeline drag-to-scroll ── */
  const scrollEl = document.querySelector('.r-tl-viewport');
  if (scrollEl) {
    let isDown = false, startX, scrollLeft;

    const onStart = (x) => {
      isDown = true;
      startX = x - scrollEl.offsetLeft;
      scrollLeft = scrollEl.scrollLeft;
      scrollEl.style.userSelect = 'none';
      scrollEl.style.cursor = 'grabbing';
    };

    const onMove = (x) => {
      if (!isDown) return;
      const curX = x - scrollEl.offsetLeft;
      const walk = (curX - startX) * 1.5;
      scrollEl.scrollLeft = scrollLeft - walk;
    };

    const onEnd = () => {
      if (!isDown) return;
      isDown = false;
      scrollEl.style.userSelect = '';
      scrollEl.style.cursor = '';
    };

    /* Mouse */
    scrollEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      onStart(e.pageX);
    });
    document.addEventListener('mousemove', (e) => {
      if (isDown) e.preventDefault();
      onMove(e.pageX);
    });
    document.addEventListener('mouseup', onEnd);

    /* Touch */
    scrollEl.addEventListener('touchstart', (e) => {
      onStart(e.touches[0].pageX);
    }, { passive: true });
    scrollEl.addEventListener('touchmove', (e) => {
      onMove(e.touches[0].pageX);
    }, { passive: true });
    scrollEl.addEventListener('touchend', onEnd);
    scrollEl.addEventListener('touchcancel', onEnd);
  }

  /* ── Timeline scroll fades ── */
  const tlViewport = document.getElementById('rTlViewport');
  const tlInstruction = document.getElementById('rTlInstruction');
  if (tlViewport) {
    const updateFades = () => {
      const { scrollLeft, scrollWidth, clientWidth } = tlViewport;
      tlViewport.classList.toggle('has-left', scrollLeft > 10);
      tlViewport.classList.toggle('has-right', scrollLeft < scrollWidth - clientWidth - 10);
      if (tlInstruction && scrollLeft > 50) tlInstruction.classList.add('hidden');
    };
    tlViewport.addEventListener('scroll', updateFades);
    updateFades();
  }

  /* ── Timeline tooltip ── */
  const tlTooltip = document.getElementById('rTlTooltip');
  const tlRaptures = document.querySelectorAll('.r-tl-rapture');
  if (tlTooltip) {
    const hideTooltip = () => {
      tlTooltip.classList.remove('visible');
      tlTooltip.style.opacity = '0';
    };
    tlRaptures.forEach(r => {
      r.addEventListener('mouseenter', () => {
        const name = r.dataset.name || '';
        const timing = r.dataset.timing || '';
        const who = r.dataset.who || '';
        const scripture = r.dataset.scripture || '';
        const judgment = r.dataset.judgment || '';
        let html = '';
        if (name) html += '<div class="r-tl-tt-name">' + name + '</div>';
        if (timing) html += '<div class="r-tl-tt-timing">' + timing + '</div>';
        if (who) html += '<div class="r-tl-tt-who">' + who + '</div>';
        if (scripture) html += '<div class="r-tl-tt-scripture">' + scripture + '</div>';
        if (judgment) html += '<div class="r-tl-tt-judge">' + judgment + '</div>';
        tlTooltip.innerHTML = html;
        tlTooltip.classList.add('visible');
        tlTooltip.style.opacity = '1';
        const canvas = document.querySelector('.r-tl-canvas');
        if (!canvas) return;
        const rRect = r.getBoundingClientRect();
        const cRect = canvas.getBoundingClientRect();
        let left = rRect.left - cRect.left + rRect.width / 2;
        const top = rRect.top - cRect.top - 12;
        if (left + 220 > cRect.width) left = cRect.width - 230;
        if (left < 10) left = 10;
        tlTooltip.style.left = left + 'px';
        tlTooltip.style.top = top + 'px';
        /* Flip below if tooltip would overflow the top */
        const ttHeight = tlTooltip.offsetHeight || 100;
        if (top - ttHeight < 0) {
          tlTooltip.style.top = (rRect.top - cRect.top + rRect.height + 8) + 'px';
          tlTooltip.style.transform = 'translateY(0)';
        } else {
          tlTooltip.style.top = top + 'px';
          tlTooltip.style.transform = 'translateY(-100%)';
        }
      });
      r.addEventListener('mouseleave', hideTooltip);
    });
    /* Dismiss on click anywhere or on the tooltip itself */
    tlTooltip.addEventListener('mouseleave', hideTooltip);
    document.addEventListener('click', hideTooltip);
    document.addEventListener('scroll', hideTooltip, true);
  }

  /* ── Timeline staggered entrance animation ── */
  const tlCanvas = document.querySelector('.r-tl-canvas');
  const tlViewportEl = document.getElementById('rTlViewport');
  if (tlCanvas) {
    const tlEvents = tlCanvas.querySelectorAll('.r-tl-event');
    const tlSpans = tlCanvas.querySelectorAll('.r-tl-span');
    const tlRaptures = tlCanvas.querySelectorAll('.r-tl-rapture');
    const tlMilestones = tlCanvas.querySelectorAll('.r-tl-milestone');
    const tlConnections = tlCanvas.querySelectorAll('.r-tl-connection');

    let revealed = false;
    const revealTimeline = () => {
      if (revealed) return;
      revealed = true;
      let delay = 0;
      const step = 60;
      tlEvents.forEach(ev => {
        setTimeout(() => ev.classList.add('revealed'), delay);
        delay += step;
      });
      tlSpans.forEach(s => {
        setTimeout(() => s.classList.add('revealed'), delay);
      });
      delay += 200;
      tlRaptures.forEach(r => {
        setTimeout(() => r.classList.add('revealed'), delay);
        delay += 120;
      });
      tlMilestones.forEach((m, i) => {
        setTimeout(() => m.classList.add('visible'), delay + 200 + i * 200);
      });
      tlConnections.forEach((c, i) => {
        setTimeout(() => c.classList.add('visible'), delay + 400 + i * 150);
      });
    };

    /* Observe the scrollable viewport, not the canvas.
       The canvas is 2600px wide inside a scroll container,
       so the document-level IntersectionObserver can miscalculate. */
    const observeTarget = tlViewportEl || tlCanvas;
    const tlObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          revealTimeline();
          tlObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    tlObserver.observe(observeTarget);

    /* Fallback: if observer never fires (e.g. element already in view on load),
       reveal after a short delay. */
    setTimeout(revealTimeline, 800);
  }

  /* ── Parallax hero + chapter images ── */
  const hero = document.getElementById('r-hero');
  const heroBg = hero?.querySelector('.r-hero-bg');
  const chapterImages = document.querySelectorAll('.r-chapter-image');
  let ticking = false;

  if (heroBg || chapterImages.length) {
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          const viewH = window.innerHeight;

          if (heroBg && hero) {
            const heroHeight = hero.offsetHeight;
            if (scrolled < heroHeight) {
              const progress = scrolled / heroHeight;
              heroBg.style.transform = `translateY(${progress * 30}px)`;
              heroBg.style.opacity = 1 - progress * 0.6;
            }
          }

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
