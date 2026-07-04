// Bible Downloads — minimal interaction (stagger reveal on scroll)
(function () {
  const cards = document.querySelectorAll('.bd-card')
  if (!cards.length) return

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1'
        e.target.style.transform = 'translateY(0)'
        io.unobserve(e.target)
      }
    })
  }, { threshold: 0.1 })

  cards.forEach((card, i) => {
    card.style.opacity = '0'
    card.style.transform = 'translateY(12px)'
    card.style.transition = `opacity 0.5s ${i * 0.04}s, transform 0.5s ${i * 0.04}s`
    io.observe(card)
  })
})()
