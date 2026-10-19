/* Newsletter signup popup -> n8n "BC — Website newsletter signup to Odoo" (vOYywJTuMGOQBh7B) -> Odoo list "Newsletter".
   Shows once per visitor after the cookie banner is answered, at 20 s or 50 % scroll.
   Closed: hidden for 30 days. Subscribed: hidden for good. Test with ?nl=1. */
(function () {
  var ENDPOINT = 'https://n8n.srv840520.hstgr.cloud/webhook/bc-newsletter-signup';
  var KEY = 'bc_nl_state', DAYS = 30, DELAY = 20000;
  var force = /[?&]nl=1\b/.test(location.search);
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var st = get(KEY);
  if (!force && (st === 'subscribed' || (st && Date.now() - +st < DAYS * 864e5))) return;

  var css = '' +
    '#bcnl{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,20,45,.55);opacity:0;transition:opacity .25s}' +
    '#bcnl.on{opacity:1}' +
    '#bcnl .box{position:relative;width:100%;max-width:440px;background:#fff;border-radius:14px;border-top:4px solid #BC9042;box-shadow:0 24px 60px rgba(0,20,45,.35);padding:32px 28px 24px;font-family:Inter,system-ui,sans-serif;color:#002349;transform:translateY(12px);transition:transform .25s}' +
    '#bcnl.on .box{transform:none}' +
    '#bcnl .x{position:absolute;top:10px;right:12px;width:36px;height:36px;border:0;background:none;font-size:24px;line-height:1;color:#8a94a6;cursor:pointer;border-radius:8px}' +
    '#bcnl .x:hover{color:#002349;background:#f3f4f6}' +
    '#bcnl .k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#BC9042;margin:0 0 10px}' +
    '#bcnl h2{font-size:24px;line-height:1.25;font-weight:800;margin:0 0 10px;color:#002349}' +
    '#bcnl p.t{font-size:15px;line-height:1.55;color:#4b5563;margin:0 0 20px}' +
    '#bcnl form{display:flex;flex-direction:column;gap:10px}' +
    '#bcnl input[type=email]{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:12px 14px;border:1px solid #d1d5db;border-radius:8px;color:#002349}' +
    '#bcnl input[type=email]:focus{outline:2px solid #BC9042;outline-offset:1px;border-color:#BC9042}' +
    '#bcnl button.go{font:inherit;font-size:15px;font-weight:700;padding:12px 16px;border:0;border-radius:8px;cursor:pointer;color:#002349;background:linear-gradient(135deg,#BC9042,#E7C874)}' +
    '#bcnl button.go:disabled{opacity:.6;cursor:wait}' +
    '#bcnl .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '#bcnl .s{font-size:12px;line-height:1.5;color:#8a94a6;margin:12px 0 0}' +
    '#bcnl .s a{color:#8a94a6;text-decoration:underline}' +
    '#bcnl .err{font-size:13px;color:#b42318;margin:0;min-height:0}' +
    '#bcnl .ok h2{margin-bottom:6px}' +
    '#bcnl .ok .t2{font-size:13px;line-height:1.5;color:#4b5563;margin:0 0 18px}' +
    '#bcnl button.got{font:inherit;font-size:15px;font-weight:700;padding:12px 16px;border:0;border-radius:8px;cursor:pointer;color:#002349;background:linear-gradient(135deg,#BC9042,#E7C874);width:100%}' +
    '#cursor-dot,#cursor-ring{z-index:10002}';   // keep the site's custom cursor (z 9999) above the popup

  var shown = false, root;
  function build() {
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    root = document.createElement('div'); root.id = 'bcnl';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'bcnl-h');
    root.innerHTML =
      '<div class="box"><button class="x" type="button" aria-label="Close">&times;</button>' +
      '<div class="body"><p class="k">Bernius Consulting newsletter</p>' +
      '<h2 id="bcnl-h">Stay in the Loop</h2>' +
      '<p class="t">Audit, Automation, and Growth Insights. Max. once a month. No spam.</p>' +
      '<form novalidate><label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<input type="email" name="email" placeholder="Your email address" autocomplete="email" required aria-label="Email address">' +
      '<p class="err" role="alert"></p>' +
      '<button class="go" type="submit">Subscribe</button></form>' +
      '<p class="s">Unsubscribe anytime with one click. <a href="/privacy">Privacy Policy</a></p></div></div>';
    document.body.appendChild(root);
    root.querySelector('.x').onclick = close;
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shown) close(); });
    root.querySelector('form').onsubmit = submit;
  }
  function show() {
    if (shown) return; shown = true; build();
    requestAnimationFrame(function () { root.classList.add('on'); });
    setTimeout(function () { var i = root.querySelector('input[type=email]'); i && i.focus({ preventScroll: true }); }, 260);
    if (window.gtag) gtag('event', 'newsletter_popup_view');
  }
  function close() {
    if (get(KEY) !== 'subscribed') set(KEY, String(Date.now()));
    root.classList.remove('on'); setTimeout(function () { root.remove(); }, 250); shown = false;
  }
  function submit(e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('.go'), err = f.querySelector('.err');
    var email = f.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Please enter a valid email address.'; f.email.focus(); return; }
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Sending…';
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, website: f.website.value, page: location.pathname }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.ok) throw 0; }); })
      .then(function () {
        set(KEY, 'subscribed');
        if (window.gtag) gtag('event', 'newsletter_signup');
        root.querySelector('.body').innerHTML = '<div class="ok"><p class="k">One last step</p><h2>Check your inbox.</h2>' +
          '<p class="t">We sent a confirmation link to <strong>' + email.replace(/[<>&"]/g, '') + '</strong>. Click it to join the list. Look in Spam or Promotions if you do not see the email.</p>' +
          '<p class="t2">Save <strong>stefan@news.berniusconsulting.com</strong> to your contacts so future newsletters always arrive.</p>' +
          '<button class="got" type="button">Got it</button></div>';
        root.querySelector('.got').onclick = close;
      })
      .catch(function () { btn.disabled = false; btn.textContent = 'Subscribe'; err.textContent = 'That did not work. Please try again in a moment.'; });
  }

  function arm() {
    if (force) return show();
    var t = setTimeout(show, DELAY);
    function onScroll() {
      var h = document.documentElement.scrollHeight - innerHeight;
      if (h > 0 && scrollY / h >= 0.5) { removeEventListener('scroll', onScroll); clearTimeout(t); show(); }
    }
    addEventListener('scroll', onScroll, { passive: true });
  }
  // wait until the cookie banner is answered, so two overlays never stack
  function start() {
    if (force || get('cookie_consent')) return arm();
    var iv = setInterval(function () { if (get('cookie_consent')) { clearInterval(iv); arm(); } }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
