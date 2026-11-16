/* الحزمة الموحّدة لمنظومة النواة الرقمية (النسخة نفسها في كل الأنظمة الثمانية، والمصدر: digital-core/site/assets/unified-kit.js)
 * 1) PK.fitNav: قائمة التنقل الداكنة، ما لا يتسع منها ينتقل إلى قائمة «المزيد» ذات تمرير رأسي، فلا يختفي أي تبويب.
 * 2) PK.mountAnnouncements: شريط الإعلانات والتحديثات (مركزي + خاص بالبوابة) من دالة portal_announcements_active.
 * 3) PK.announcementsAdmin: واجهة إدارة الإعلانات (scope: central لمدير النواة، portal للمسؤول المخول في البوابة).
 * 4) PK.welcome: بطاقة الترحيب الموحدة (الصورة والاسم والصفة). */
(function () {
  if (window.PK) return;
  const PK = (window.PK = {});
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
  PK.SYSTEMS = [["core", "النواة الرقمية"], ["smart_plans", "الخطط الذكية"], ["self_evaluation", "التقويم المدرسي الذكي"], ["teachers_community", "مجتمع النمو المهني"], ["indibati", "انضباطي"], ["qiyami", "قيمي"], ["facility_booking", "حجز المرافق"], ["mirat", "الملف الشامل"]];
  const SYSNAME = Object.fromEntries(PK.SYSTEMS);

  const CSS = `
.pk-fit{overflow:hidden!important;flex-wrap:nowrap!important}
.pk-hid{display:none!important}
.pk-more{flex:none;display:inline-flex;align-items:center}
.pk-more[hidden]{display:none}
.pk-mb{font:inherit;color:#3b2a06;background:linear-gradient(135deg,#f6c25e,#f0a35e);border:1px solid #f6c25e;border-radius:12px;padding:8px 16px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:800;white-space:nowrap;min-height:40px;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.pk-mb:hover,.pk-mb[aria-expanded=true]{background:linear-gradient(135deg,#ffd27a,#f6b25e);color:#2a1d03}
.pk-mb:focus-visible{outline:3px solid #f0b34a;outline-offset:2px}
.pk-mb svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .15s}
.pk-mb[aria-expanded=true] svg{transform:rotate(180deg)}
.pk-mm{position:fixed;z-index:200;min-width:230px;max-width:min(340px,calc(100vw - 16px));overflow-y:auto;overscroll-behavior:contain;background:#fff;color:#0d2b45;border:1px solid #e2edf1;border-radius:16px;box-shadow:0 18px 44px rgba(8,40,60,.28);padding:6px;font-family:inherit}
.pk-mm[hidden]{display:none}
.pk-mm a{display:flex;align-items:center;gap:8px;padding:11px 12px;border-radius:11px;color:#0d2b45;text-decoration:none;font-weight:500;font-size:.95rem;white-space:normal;min-height:44px;background:none}
.pk-mm a::after{display:none!important}
.pk-mm a:hover,.pk-mm a:focus-visible{background:#eef8fa;color:#0c6f82;outline:none}
.pk-mm a.on{background:#e3f6f7;color:#0c6f82;font-weight:800}
.pk-mm a svg{width:18px;height:18px;flex:none;stroke:currentColor}
.pk-mm a .bdg,.pk-mm a b{margin-inline-start:auto;background:#f0b34a;color:#3b2a06;border-radius:99px;font-size:.72rem;font-weight:800;padding:0 7px;line-height:1.6}
/* شريط الإعلانات */
.pk-ann{display:flex;align-items:center;gap:10px;background:#f4fbfc;border-block:1px solid #d4e9ee;color:#0d2b45;font-family:inherit;padding:6px max(14px,calc((100vw - 1200px)/2));min-height:44px;direction:rtl}
.pk-ann[hidden]{display:none}
.pk-ann-ic{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#18a4ab,#0c6f82);color:#fff}
.pk-ann-ic svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.pk-ann-vp{flex:1;min-width:0;overflow:hidden;white-space:nowrap;position:relative;line-height:1.9}
.pk-ann-tk{display:inline-block;white-space:nowrap;transition:opacity .35s}
.pk-ann-tk.out{opacity:0}
.pk-ann-vp.wrap{white-space:normal}.pk-ann-vp.wrap .pk-ann-tk{white-space:normal;display:block}
.pk-ann-tag{display:inline-block;font-style:normal;font-size:.72rem;font-weight:800;border-radius:7px;padding:1px 9px;margin-inline-end:8px;background:#e3f6f7;color:#0c6f82;vertical-align:1px}
.pk-ann-tag.up{background:#e7f0fb;color:#2f6fc4}
.pk-ann.imp{background:#fff8ea;border-color:#f3dcae}
.pk-ann.imp .pk-ann-ic{background:linear-gradient(135deg,#f0b34a,#d98f1d);color:#3b2a06}
.pk-ann.imp .pk-ann-tag.imp{background:#fbe8c4;color:#7a4a05}
.pk-ann-pp{flex:none;width:36px;height:36px;border-radius:10px;border:1px solid #d4e9ee;background:#fff;color:#0c6f82;cursor:pointer;display:grid;place-items:center;padding:0}
.pk-ann-pp svg{width:16px;height:16px;fill:currentColor}
.pk-ann-pp:focus-visible{outline:3px solid #f0b34a;outline-offset:2px}
.pk-ann-n{flex:none;font-size:.75rem;color:#5b7183;font-variant-numeric:tabular-nums}
@media print{.pk-ann{display:none}}
/* بطاقة الترحيب */
.pk-wc{display:flex;align-items:center;gap:22px;background:linear-gradient(120deg,#0b3442 0%,#0c6f82 55%,#18a4ab 100%);color:#fff;border-radius:28px;padding:26px 32px;margin:18px 0;box-shadow:0 14px 34px rgba(12,60,80,.24);border:1px solid rgba(240,179,74,.45);position:relative;overflow:hidden;font-family:inherit}
.pk-wc::before{content:"";position:absolute;inset-block:0;inset-inline-end:0;width:8px;background:linear-gradient(180deg,#f6c25e,#f0a35e)}
.pk-wc::after{content:"";position:absolute;inset:auto auto -80% 6%;width:38%;aspect-ratio:1;background:radial-gradient(closest-side,rgba(240,179,74,.3),transparent);pointer-events:none}
.pk-wc>*{position:relative}
.pk-wc-av{width:112px;height:112px;border-radius:50%;flex:none;overflow:hidden;background:rgba(255,255,255,.16);border:4px solid #f6c25e;box-shadow:0 0 0 6px rgba(255,255,255,.14);display:grid;place-items:center}
.pk-wc-av img,.pk-wc-av svg{width:100%;height:100%;display:block;object-fit:cover}
.pk-wc-t{min-width:0}.pk-wc-t h2{margin:0;color:#fff;font-size:clamp(1.4rem,3.6vw,2.2rem);font-weight:800;line-height:1.4;overflow-wrap:anywhere}
.pk-wc-t p{margin:6px 0 0;display:inline-block;color:#3b2a06;background:#f6c25e;border-radius:99px;padding:3px 16px;font-size:.98rem;font-weight:800}
@media (max-width:560px){.pk-wc{padding:18px;gap:14px;border-radius:22px}.pk-wc-av{width:76px;height:76px;border-width:3px}}
/* إدارة الإعلانات */
.pk-ad{font-family:inherit;color:#0d2b45}
.pk-ad .pk-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.pk-ad .pk-h h3{margin:0;flex:1;min-width:200px}
.pk-ad .pk-sub{margin:0 0 12px;color:#3d566b;font-size:.9rem;line-height:1.8}
.pk-b{font:inherit;font-weight:700;font-size:.88rem;min-height:40px;padding:0 16px;border-radius:12px;border:1px solid #d4e9ee;background:#fff;color:#0c6f82;cursor:pointer}
.pk-b:hover{background:#eef8fa}.pk-b.pri{background:linear-gradient(135deg,#18a4ab,#0c6f82);color:#fff;border-color:transparent}.pk-b.bad{color:#c23646;border-color:#f1c9cf}.pk-b:disabled{opacity:.55;cursor:wait}
.pk-b.sm{min-height:34px;padding:0 12px;font-size:.82rem}
.pk-row{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid #e2edf1;border-radius:14px;background:#fff;margin-bottom:8px;flex-wrap:wrap}
.pk-row .pk-m{flex:1;min-width:220px}.pk-row .pk-m p{margin:0 0 4px;line-height:1.8;overflow-wrap:anywhere}.pk-row small{color:#5b7183;display:block;line-height:1.7}
.pk-st{display:inline-block;font-size:.74rem;font-weight:800;border-radius:99px;padding:1px 10px;margin-inline-end:6px}
.pk-st.ok{background:#e2f5ea;color:#1f7a4d}.pk-st.off{background:#eef1f4;color:#5b7183}.pk-st.wait{background:#fdf1dc;color:#8a560a}.pk-st.imp{background:#fbe5e8;color:#a52b3a}
.pk-acts{display:flex;gap:6px;flex-wrap:wrap}
.pk-f{border:1px solid #cfe2e8;border-radius:16px;background:#f9fdfd;padding:14px;margin-bottom:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.pk-f label{display:flex;flex-direction:column;gap:4px;font-weight:700;font-size:.86rem}
.pk-f .full{grid-column:1/-1}
.pk-f input,.pk-f select,.pk-f textarea{font:inherit;font-weight:400;border:1px solid #bcd3db;border-radius:10px;padding:8px 10px;background:#fff;color:#0d2b45;min-height:42px;width:100%;box-sizing:border-box}
.pk-f textarea{min-height:84px;resize:vertical}
.pk-f .pk-chk{flex-direction:row;align-items:center;gap:8px;font-weight:500}.pk-f .pk-chk input{width:auto;min-height:0}
.pk-f .pk-tg{display:flex;flex-wrap:wrap;gap:6px 14px}
.pk-msg{margin:8px 0;font-size:.9rem}.pk-msg.err{color:#c23646}.pk-msg.ok{color:#1f7a4d}
.pk-card{background:#fff;border:1px solid #e2edf1;border-radius:20px;padding:18px;margin:16px 0;box-shadow:0 6px 20px rgba(13,43,69,.05)}
.pk-empty{padding:18px;text-align:center;color:#5b7183;border:1px dashed #cfe2e8;border-radius:14px}
`;
  const st = document.createElement("style"); st.id = "pk-css"; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);

  /* ================= 1) قائمة التنقل ================= */
  const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  PK.fitNav = function (nav, o = {}) {
    if (!nav) return;
    if (nav.__pk) { nav.__pk(); return; }
    const minW = o.minWidth == null ? 761 : o.minWidth;
    const wrap = document.createElement("div"); wrap.className = "pk-more"; wrap.hidden = true;
    wrap.innerHTML = `<button type="button" class="pk-mb" aria-haspopup="true" aria-expanded="false">${esc(o.label || "المزيد")}${CHEV}</button>`;
    const btn = wrap.firstChild, menu = document.createElement("div"); menu.className = "pk-mm"; menu.hidden = true; menu.setAttribute("role", "menu"); document.body.appendChild(menu);
    const items = () => [...nav.children].filter((e) => e.tagName === "A");
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    const open = () => {
      const r = btn.getBoundingClientRect(), top = Math.round(r.bottom + 6);
      menu.hidden = false; menu.style.maxHeight = Math.max(160, innerHeight - top - 12) + "px"; menu.style.top = top + "px";
      const w = menu.offsetWidth; let left = r.left; if (left + w > innerWidth - 8) left = innerWidth - w - 8; menu.style.left = Math.max(8, left) + "px";
      btn.setAttribute("aria-expanded", "true");
    };
    btn.onclick = (e) => { e.stopPropagation(); menu.hidden ? open() : close(); };
    menu.onclick = (e) => { if (e.target.closest("a")) close(); e.stopPropagation(); };
    menu.__btn = btn; PK._navs = (PK._navs || []).filter((n) => n.nav.isConnected || (n.menu.remove(), false)); PK._navs.push({ nav, menu });
    if (!PK._g) {
      PK._g = 1; const all = () => document.querySelectorAll(".pk-mm").forEach((m) => { m.hidden = true; if (m.__btn) m.__btn.setAttribute("aria-expanded", "false"); });
      document.addEventListener("click", all); addEventListener("scroll", all, { passive: true });
      document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; const m = [...document.querySelectorAll(".pk-mm")].find((x) => !x.hidden); if (m) { all(); if (m.__btn) m.__btn.focus(); } });
      addEventListener("resize", () => { clearTimeout(PK._rt); PK._rt = setTimeout(() => (PK._navs || []).forEach((n) => n.nav.isConnected && n.nav.__pk()), 120); });
      addEventListener("load", () => (PK._navs || []).forEach((n) => n.nav.isConnected && n.nav.__pk()));
    }
    let busy = false, t = 0;
    const obs = new MutationObserver(() => { if (!busy) { clearTimeout(t); t = setTimeout(layout, 60); } });
    function layout() {
      busy = true; obs.disconnect();
      try {
        const its = items(); its.forEach((a) => a.classList.remove("pk-hid"));
        menu.innerHTML = ""; if (!wrap.isConnected) nav.appendChild(wrap); wrap.hidden = true; close(); nav.classList.remove("pk-fit");
        if (innerWidth >= minW && its.length > 1) {
          nav.classList.add("pk-fit");
          const over = () => nav.scrollWidth > nav.clientWidth + 1;
          if (over()) {
            wrap.hidden = false;
            const cand = its.filter((a) => !a.classList.contains("on") && a.getAttribute("aria-current") !== "page").reverse();
            for (const a of cand) { if (!over()) break; a.classList.add("pk-hid"); }
            const hid = its.filter((a) => a.classList.contains("pk-hid"));
            if (!hid.length) wrap.hidden = true;
            menu.innerHTML = hid.map((a) => { const c = a.cloneNode(true); c.classList.remove("pk-hid", "on"); c.setAttribute("role", "menuitem"); c.removeAttribute("style"); return c.outerHTML; }).join("");
          }
        }
      } finally { obs.observe(nav, { childList: true, subtree: true, characterData: true }); busy = false; }
    }
    nav.__pk = layout;
    let rt = 0; if (window.ResizeObserver && nav.parentElement) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(layout, 80); }).observe(nav.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    layout();
  };

  /* ================= 2) شريط الإعلانات ================= */
  const ANN_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15 9a4 4 0 010 6M18 6.5a8 8 0 010 11"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const tagOf = (x) => (x.scope === "central" ? (x.kind === "update" ? "تحديث من النواة" : "إعلان مركزي") : (x.kind === "update" ? "تحديث البوابة" : "إعلان البوابة"));
  PK.mountAnnouncements = async function (o) {
    const sb = o.sb; if (!sb || !o.system) return;
    let bar = document.getElementById("pk-ann"), tok = 0;
    const key = o.system + "|" + (o.page || "all");
    if (bar && bar.isConnected && !bar.hidden && PK._annKey === key && Date.now() - PK._annAt < 60000) return;
    const place = (el) => {
      if (el.isConnected) return;
      let ref = o.before ? document.querySelector(o.before) : null;
      if (o.after) { const a = document.querySelector(o.after); if (a) { a.insertAdjacentElement("afterend", el); return; } }
      ref = ref || document.querySelector(".pagebar,.cp-page,#pghead,main,#view,#main");
      if (ref && ref.parentNode) ref.parentNode.insertBefore(el, ref); else document.body.prepend(el);
    };
    async function load() {
      let rows = [];
      try { const r = await sb.rpc("portal_announcements_active", { p_system: o.system, p_page: o.page || "all" }); rows = (r && r.data) || []; } catch (_) {}
      PK._annKey = key; PK._annAt = Date.now(); tok = PK._tok = (PK._tok || 0) + 1; const my = tok;
      if (!rows.length) { if (bar) bar.hidden = true; return; }
      if (!bar) { bar = document.createElement("section"); bar.id = "pk-ann"; bar.className = "pk-ann"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "الإعلانات والتحديثات"); }
      bar.hidden = false; place(bar);
      bar.innerHTML = `<span class="pk-ann-ic">${ANN_IC}</span><div class="pk-ann-vp" aria-live="off"><span class="pk-ann-tk"></span></div><span class="pk-ann-n"></span><button type="button" class="pk-ann-pp" aria-label="إيقاف حركة الشريط مؤقتاً" title="إيقاف / تشغيل الحركة">${PAUSE}</button>`;
      const vp = bar.querySelector(".pk-ann-vp"), tk = bar.querySelector(".pk-ann-tk"), pp = bar.querySelector(".pk-ann-pp"), nn = bar.querySelector(".pk-ann-n");
      let paused = reduce(), cur = null; if (reduce()) { pp.innerHTML = PLAY; vp.classList.add("wrap"); }
      const setPaused = (v) => { paused = v; pp.innerHTML = v ? PLAY : PAUSE; pp.setAttribute("aria-label", v ? "تشغيل حركة الشريط" : "إيقاف حركة الشريط مؤقتاً"); if (cur) { if (v && cur.playState === "running") cur.pause(); else if (!v && cur.playState === "paused") cur.play(); } };
      pp.onclick = () => setPaused(!paused);
      bar.onmouseenter = () => { if (!reduce() && !paused && cur && cur.playState === "running") cur.pause(); };
      bar.onmouseleave = () => { if (!paused && cur && cur.playState === "paused") cur.play(); };
      const wait = async (ms) => { let left = ms; while (left > 0) { if (my !== PK._tok) return false; if (!(paused || bar.matches(":hover"))) left -= 100; await delay(100); } return my === PK._tok; };
      let i = 0;
      for (;;) {
        if (my !== PK._tok) return;
        const x = rows[i % rows.length];
        bar.classList.toggle("imp", x.priority === "important");
        tk.classList.add("out"); await delay(reduce() ? 0 : 200); if (my !== PK._tok) return;
        tk.innerHTML = `<em class="pk-ann-tag ${x.kind === "update" ? "up" : ""} ${x.priority === "important" ? "imp" : ""}">${esc(x.priority === "important" ? "مهم · " + tagOf(x) : tagOf(x))}</em>${esc(x.message)}`;
        nn.textContent = rows.length > 1 ? `${(i % rows.length) + 1}/${rows.length}` : "";
        tk.style.transform = "none"; tk.classList.remove("out");
        const ov = tk.scrollWidth - vp.clientWidth;
        if (ov > 4 && !reduce()) {
          if (!(await wait(1500))) return;
          const dur = Math.max(4000, (ov / 45) * 1000);
          cur = tk.animate([{ transform: "translateX(0)" }, { transform: `translateX(${ov}px)` }], { duration: dur, easing: "linear", fill: "forwards" });
          if (paused) cur.pause();
          while (cur.playState !== "finished") { if (my !== PK._tok) { cur.cancel(); return; } await delay(150); }
          cur = null; if (!(await wait(2000))) return;
        } else if (!(await wait(reduce() ? 9000 : 6500))) return;
        if (rows.length === 1 && (ov <= 4 || reduce())) return;
        i++;
      }
    }
    await load();
    if (!window.__pkAnnT) window.__pkAnnT = setInterval(() => { if (!document.hidden) load(); }, 300000);
    return { reload: load };
  };

  /* ================= 3) إدارة الإعلانات ================= */
  const pad = (n) => String(n).padStart(2, "0");
  const toLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtD = (iso) => iso ? new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }) : "";
  PK.announcementsAdmin = async function (host, o) {
    if (!host) return; const sb = o.sb, central = o.scope === "central";
    host.classList.add("pk-ad");
    let rows = [], editing = null;
    const status = (x) => { const n = Date.now(); if (!x.is_active) return ["off", "موقوف"]; if (new Date(x.starts_at) > n) return ["wait", "مجدول"]; if (x.ends_at && new Date(x.ends_at) <= n) return ["off", "منتهٍ"]; return ["ok", "ظاهر الآن"]; };
    async function fetchRows() {
      let q = sb.from("portal_announcements").select("*").eq("scope", o.scope); if (!central) q = q.eq("system_code", o.system);
      const { data, error } = await q.order("sort_order").order("created_at", { ascending: false });
      if (error) { host.innerHTML = `<p class="pk-msg err">تعذر تحميل الإعلانات: ${esc(error.message)}</p>`; return false; }
      rows = data || []; return true;
    }
    function form(x) {
      const t = x ? x.targets || [] : [];
      return `<form class="pk-f" id="pkF" novalidate>
        <label>النوع<select name="kind"><option value="announcement"${x && x.kind === "announcement" ? " selected" : ""}>إعلان أو رسالة</option><option value="update"${x && x.kind === "update" ? " selected" : ""}>تحديث جديد</option></select></label>
        <label>الأهمية<select name="priority"><option value="normal">عادية</option><option value="important"${x && x.priority === "important" ? " selected" : ""}>مهمة</option></select></label>
        <label class="full">نص الرسالة (حتى 600 حرف)<textarea name="message" maxlength="600" required>${esc(x ? x.message : "")}</textarea></label>
        ${central ? `<div class="full"><b style="font-size:.86rem">الأنظمة التي تظهر فيها</b><div class="pk-tg" style="margin-top:6px"><label class="pk-chk"><input type="checkbox" name="all"${!x || !t.length ? " checked" : ""}> كل الأنظمة الثمانية</label>${PK.SYSTEMS.map(([k, n]) => `<label class="pk-chk"><input type="checkbox" name="t" value="${k}"${t.includes(k) ? " checked" : ""}> ${esc(n)}</label>`).join("")}</div></div>` : ""}
        <label>مكان الظهور<select name="show_on"><option value="all">جميع صفحات البوابة</option><option value="home"${x && x.show_on === "home" ? " selected" : ""}>الصفحة الرئيسية فقط</option></select></label>
        <label>الترتيب (الأصغر أولاً)<input type="number" name="sort_order" value="${x ? x.sort_order : 0}" step="1"></label>
        <label>بداية العرض<input type="datetime-local" name="starts_at" value="${toLocal(x ? x.starts_at : new Date())}"></label>
        <label>نهاية العرض (اختياري)<input type="datetime-local" name="ends_at" value="${toLocal(x && x.ends_at)}"></label>
        <label class="pk-chk full"><input type="checkbox" name="is_active"${!x || x.is_active ? " checked" : ""}> مفعّلة</label>
        <div class="full pk-acts"><button class="pk-b pri" type="submit">${x ? "حفظ التعديل" : "نشر الرسالة"}</button><button class="pk-b" type="button" id="pkC">إلغاء</button></div>
        <p class="pk-msg full" id="pkM" role="status"></p></form>`;
    }
    function paint() {
      host.innerHTML = `<div class="pk-h"><h3>${central ? "الإعلانات والتحديثات المركزية" : "الإعلانات والتحديثات"}</h3><button class="pk-b pri" type="button" id="pkN">إضافة رسالة</button></div>
        <p class="pk-sub">${central ? "تظهر في شريط أفقي داخل لوحات الأنظمة التي تحددها، وتتميّز بوسم «مركزي»." : `تظهر في شريط أفقي داخل لوحة ${esc(SYSNAME[o.system] || "البوابة")} فقط، إلى جانب أي رسالة مركزية دون أن تخفيها.`}</p>
        ${editing !== null ? form(editing === "new" ? null : rows.find((r) => r.id === editing)) : ""}
        ${rows.length ? rows.map((x) => { const [c, l] = status(x); return `<div class="pk-row"><div class="pk-m"><p><span class="pk-st ${c}">${l}</span>${x.priority === "important" ? '<span class="pk-st imp">مهمة</span>' : ""}<span class="pk-st off">${x.kind === "update" ? "تحديث" : "إعلان"}</span>${esc(x.message)}</p>
          <small>${central ? "الأنظمة: " + (x.targets.length ? x.targets.map((k) => SYSNAME[k] || k).join("، ") : "كلها") + " · " : ""}${x.show_on === "home" ? "الصفحة الرئيسية" : "كل الصفحات"} · من ${esc(fmtD(x.starts_at))}${x.ends_at ? " إلى " + esc(fmtD(x.ends_at)) : " دون تاريخ انتهاء"} · ترتيب ${x.sort_order}</small></div>
          <div class="pk-acts"><button class="pk-b sm" data-a="edit" data-id="${x.id}" type="button">تعديل</button><button class="pk-b sm" data-a="tog" data-id="${x.id}" type="button">${x.is_active ? "إيقاف" : "تفعيل"}</button><button class="pk-b sm bad" data-a="del" data-id="${x.id}" type="button">حذف</button></div></div>`; }).join("") : '<p class="pk-empty">لا رسائل بعد.</p>'}`;
      host.querySelector("#pkN").onclick = () => { editing = "new"; paint(); host.querySelector("textarea").focus(); };
      host.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
        const id = b.dataset.id, x = rows.find((r) => r.id === id); if (!x) return;
        if (b.dataset.a === "edit") { editing = id; paint(); host.querySelector("textarea").focus(); return; }
        b.disabled = true;
        if (b.dataset.a === "del") { if (!confirm("حذف هذه الرسالة نهائياً؟")) { b.disabled = false; return; } const { error } = await sb.from("portal_announcements").delete().eq("id", id); if (error) alert(error.message); }
        else { const { error } = await sb.from("portal_announcements").update({ is_active: !x.is_active }).eq("id", id); if (error) alert(error.message); }
        await fetchRows(); paint();
      }));
      const f = host.querySelector("#pkF");
      if (f) {
        host.querySelector("#pkC").onclick = () => { editing = null; paint(); };
        const all = f.elements.all; if (all) f.querySelectorAll('[name="t"]').forEach((c) => (c.onchange = () => { if (c.checked) all.checked = false; }));
        if (all) all.onchange = () => { if (all.checked) f.querySelectorAll('[name="t"]').forEach((c) => (c.checked = false)); };
        f.onsubmit = async (e) => {
          e.preventDefault(); const m = host.querySelector("#pkM"), v = f.elements;
          const msg = v.message.value.trim(); if (!msg) { m.className = "pk-msg full err"; m.textContent = "اكتب نص الرسالة."; return; }
          const s = v.starts_at.value ? new Date(v.starts_at.value) : new Date(), en = v.ends_at.value ? new Date(v.ends_at.value) : null;
          if (en && en <= s) { m.className = "pk-msg full err"; m.textContent = "نهاية العرض يجب أن تكون بعد بدايته."; return; }
          const rec = { kind: v.kind.value, priority: v.priority.value, message: msg, show_on: v.show_on.value, sort_order: parseInt(v.sort_order.value, 10) || 0, starts_at: s.toISOString(), ends_at: en ? en.toISOString() : null, is_active: v.is_active.checked };
          if (central) { rec.scope = "central"; rec.targets = v.all && v.all.checked ? [] : [...f.querySelectorAll('[name="t"]:checked')].map((c) => c.value); if (v.all && !v.all.checked && !rec.targets.length) { m.className = "pk-msg full err"; m.textContent = "اختر نظاماً واحداً على الأقل أو «كل الأنظمة»."; return; } }
          else { rec.scope = "portal"; rec.system_code = o.system; rec.targets = []; }
          const btn = f.querySelector(".pri"); btn.disabled = true;
          const { error } = editing === "new" ? await sb.from("portal_announcements").insert(rec) : await sb.from("portal_announcements").update(rec).eq("id", editing);
          if (error) { btn.disabled = false; m.className = "pk-msg full err"; m.textContent = "تعذر الحفظ: " + error.message; return; }
          editing = null; await fetchRows(); paint(); if (o.onChange) o.onChange();
        };
      }
    }
    if (await fetchRows()) paint();
  };


  /* قسم إدارة الإعلانات داخل صفحة إعدادات البوابة (خارج عنصر المحتوى كي لا تمسحه إعادة الرسم).
     o: { sb, system, after: محدد العنصر الذي يُدرج القسم بعده، central: true لمدير النواة (قسم مركزي إضافي) } */
  PK.mountAdminSection = async function (o) {
    const sb = o.sb, anchor = document.querySelector(o.after || "#main"); if (!sb || !anchor) return;
    document.querySelectorAll(".pk-admwrap").forEach((e) => e.remove());
    const can = async (scope, sys) => { try { const r = await sb.rpc("portal_can_manage_announcements", { p_scope: scope, p_system: sys }); return r && r.data === true; } catch (_) { return false; } };
    const [cen, loc] = await Promise.all([o.central ? can("central", null) : false, can("portal", o.system)]);
    if (!cen && !loc) return;
    const box = document.createElement("div"); box.className = "wrap pk-admwrap";
    box.innerHTML = (cen ? '<section class="pk-card"><div data-pk="c"></div></section>' : "") + (loc ? '<section class="pk-card"><div data-pk="p"></div></section>' : "");
    anchor.insertAdjacentElement("afterend", box);
    const reload = () => { const b = document.getElementById("pk-ann"); if (b) b.remove(); PK.mountAnnouncements({ sb, system: o.system, page: "all", before: ".pagebar" }); };
    if (cen) PK.announcementsAdmin(box.querySelector('[data-pk="c"]'), { sb, scope: "central", onChange: reload });
    if (loc) PK.announcementsAdmin(box.querySelector('[data-pk="p"]'), { sb, scope: "portal", system: o.system, onChange: reload });
  };

  /* ================= 4) بطاقة الترحيب ================= */
  const DEF_AV = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#2a7f93"/><circle cx="32" cy="25" r="11" fill="#fff" opacity=".9"/><path d="M10 64c2-15 11-22 22-22s20 7 22 22z" fill="#fff" opacity=".9"/></svg>';
  let photoP = null;
  const shortName = (n) => { const w = String(n || "").trim().split(/\s+/).filter(Boolean); if (w.length <= 2) return w.join(" ");
    if (w.length === 3 && /^ال/.test(w[1])) return w.join(" ");
    const pre = ["عبد", "أبو", "ابو", "أبا", "ابا"], mid = ["آل", "ال", "أبو", "ابو", "بن", "بنت", "عبد"];
    let first = w[0], i = 1; if (pre.includes(first) && w.length > 2) { first += " " + w[1]; i = 2; }
    let last = w[w.length - 1]; if (w.length - 2 >= i && ["آل", "ال", "أبو", "ابو", "عبد"].includes(w[w.length - 2])) last = w[w.length - 2] + " " + last;
    return mid.includes(last) ? first : first + " " + last; };
  PK.shortName = shortName;
  PK.photoUrl = function (sb) {
    if (photoP) return photoP;
    photoP = (async () => {
      try {
        const r = await sb.rpc("core_my_photo"), ph = r && r.data; if (!ph || !ph.path) return null;
        if (ph.public) return `${sb.supabaseUrl}/storage/v1/object/public/${ph.bucket}/${ph.path.split("/").map(encodeURIComponent).join("/")}`;
        const s = await sb.storage.from(ph.bucket).createSignedUrl(ph.path, 3600); return (s && s.data && s.data.signedUrl) || null;
      } catch (_) { return null; }
    })();
    return photoP;
  };
  PK.use = function (sb) {
    PK._sb = sb; const hyd = () => document.querySelectorAll("[data-pk-av]:not([data-pk-done])").forEach((a) => { a.dataset.pkDone = "1"; PK.photoUrl(PK._sb).then((u) => { if (!u) return; const im = new Image(); im.alt = ""; im.onload = () => { a.textContent = ""; a.appendChild(im); }; im.src = u; }); });
    hyd(); if (!PK._mo) { let t = 0; PK._mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(hyd, 50); }); PK._mo.observe(document.body, { childList: true, subtree: true }); }
  };
  PK.welcomeHTML = (o) => `<section class="pk-wc" aria-label="بطاقة الترحيب"><span class="pk-wc-av" data-pk-av>${DEF_AV}</span><div class="pk-wc-t"><h2>مرحباً بك، ${esc(shortName(o.name))}</h2>${o.role ? `<p>${esc(o.role)}</p>` : ""}</div></section>`;
  // host: عنصر أو محدد؛ mode: before | prepend | replace (الافتراضي prepend داخل host)
  PK.welcome = function (host, o) {
    const h = typeof host === "string" ? document.querySelector(host) : host; if (!h) return null;
    document.querySelectorAll(".pk-wcw").forEach((e) => e.remove()); document.querySelectorAll(".pk-wc").forEach((e) => e.remove());
    const html = PK.welcomeHTML(o);
    h.insertAdjacentHTML(o.mode === "after" ? "afterend" : o.mode === "before" ? "beforebegin" : "afterbegin", o.mode ? `<div class="wrap pk-wcw">${html}</div>` : html);
    const el = document.querySelector(".pk-wc");
    if (o.sb) PK.use(o.sb);
    return el;
  };
})();
