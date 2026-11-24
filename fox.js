/* Maskot rubah imut yang mengintip dari pojok kiri bawah. Mata biru berkilau mengikuti kursor / sentuhan. */
(function () {
  const el = document.createElement('div');
  el.id = 'fox-mascot';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:12px;bottom:0;width:104px;height:88px;z-index:40;pointer-events:none;overflow:hidden;transform:translateY(100%);transition:transform .6s cubic-bezier(.2,1.4,.4,1)';
  el.innerHTML = `<svg viewBox="0 0 100 85" width="100%" height="100%">
    <defs>
      <radialGradient id="fx-iris" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#6f8cff"/><stop offset=".6" stop-color="#2d3fb8"/><stop offset="1" stop-color="#18216b"/></radialGradient>
      <radialGradient id="fx-face" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#fff6ec"/><stop offset="1" stop-color="#ffe3cf"/></radialGradient>
    </defs>
    <g id="fox-head" style="transform-origin:50px 95px;transition:transform .12s ease-out">
      <g stroke-linejoin="round" stroke-width="5">
        <polygon points="15,44 17,9 45,27" fill="#ee8a3c" stroke="#ee8a3c"/><polygon points="85,44 83,9 55,27" fill="#ee8a3c" stroke="#ee8a3c"/>
        <polygon points="22,35 22,17 36,27" fill="#ffb3bd" stroke="#ffb3bd" stroke-width="2"/><polygon points="78,35 78,17 64,27" fill="#ffb3bd" stroke="#ffb3bd" stroke-width="2"/>
      </g>
      <path d="M5 58 Q5 22 50 22 Q95 22 95 58 L95 110 L5 110Z" fill="#ee8a3c"/>
      <path d="M2 66 L9 60 L4 56 L12 52 L10 70Z M98 66 L91 60 L96 56 L88 52 L90 70Z" fill="#fff6ec"/>
      <path d="M13 62 Q18 40 50 46 Q82 40 87 62 L87 110 L13 110Z" fill="url(#fx-face)"/>
      <path d="M50 30 Q44 38 50 46 Q56 38 50 30Z" fill="#fff6ec"/>
      <g id="fox-eyes">
        <ellipse cx="33" cy="60" rx="11" ry="12" fill="#fff"/><ellipse cx="67" cy="60" rx="11" ry="12" fill="#fff"/>
        <g id="fox-il"><ellipse cx="33" cy="60" rx="9" ry="10" fill="url(#fx-iris)"/><circle cx="33" cy="61" r="4.4" fill="#10143d"/><circle cx="36.5" cy="56" r="3.2" fill="#fff"/><circle cx="29.5" cy="65" r="1.5" fill="#fff" opacity=".9"/></g>
        <g id="fox-ir"><ellipse cx="67" cy="60" rx="9" ry="10" fill="url(#fx-iris)"/><circle cx="67" cy="61" r="4.4" fill="#10143d"/><circle cx="70.5" cy="56" r="3.2" fill="#fff"/><circle cx="63.5" cy="65" r="1.5" fill="#fff" opacity=".9"/></g>
      </g>
      <ellipse cx="19" cy="75" rx="7" ry="4" fill="#ff8fa3" opacity=".65"/><ellipse cx="81" cy="75" rx="7" ry="4" fill="#ff8fa3" opacity=".65"/>
      <ellipse cx="50" cy="71" rx="3" ry="2.2" fill="#3d2c30"/>
      <path d="M43.5 76 Q47 80 50 76 Q53 80 56.5 76" fill="none" stroke="#3d2c30" stroke-width="1.8" stroke-linecap="round"/>
    </g></svg>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => setTimeout(() => { el.style.transform = 'translateY(6px)'; }, 150));

  const $ = (id) => el.querySelector('#' + id);
  const head = $('fox-head'), eyes = $('fox-eyes'), il = $('fox-il'), ir = $('fox-ir');

  function look(x, y) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.7;
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 140), a = Math.atan2(dy, dx);
    const ox = Math.cos(a) * 3 * k, oy = Math.sin(a) * 3.2 * k;
    il.setAttribute('transform', `translate(${ox} ${oy})`);
    ir.setAttribute('transform', `translate(${ox} ${oy})`);
    const tilt = Math.max(-1, Math.min(1, dx / 500));
    head.style.transform = `rotate(${tilt * 7}deg) translate(${ox * 0.6}px,${oy * 0.4}px)`;
  }
  window.addEventListener('pointermove', (e) => look(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) look(t.clientX, t.clientY); }, { passive: true });

  // kedip sesekali
  eyes.style.transformOrigin = '50px 60px';
  eyes.style.transition = 'transform .08s';
  il.style.transition = ir.style.transition = 'transform .08s';
  setInterval(() => {
    eyes.style.transform = 'scaleY(.1)';
    setTimeout(() => { eyes.style.transform = ''; }, 140);
  }, 3600);
})();
