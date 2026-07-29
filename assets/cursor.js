(function () {
  'use strict';
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var dot = document.createElement('div');
  dot.id = 'cursor-dot';
  var ring = document.createElement('div');
  ring.id = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.classList.add('cursor-ready');

  var mx = -100, my = -100, rx = -100, ry = -100, started = false;

  function setDot(x, y) {
    dot.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
  }
  function setRing(x, y) {
    ring.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
  }

  window.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    setDot(mx, my);
    if (!started) { rx = mx; ry = my; setRing(rx, ry); document.body.classList.add('cursor-visible'); started = true; }
  }, { passive: true });

  document.addEventListener('mouseleave', function () {
    document.body.classList.remove('cursor-visible');
  });
  document.addEventListener('mouseenter', function () {
    if (started) document.body.classList.add('cursor-visible');
  });

  function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    setRing(rx, ry);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  var HOVER_SELECTOR = 'a, button, input, textarea, select, [role="button"], ' +
    '.service-card, .proof-card, .pricing-card, .rel-card, .step-num';

  document.addEventListener('mouseover', function (e) {
    if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
      document.body.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
      document.body.classList.remove('cursor-hover');
    }
  });
})();
