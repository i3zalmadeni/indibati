/* انضباطي: نسخة من عناصر هوية النواة الرقمية (عبر قيمي) مع شعار النظام فقط. عناصر الهوية المشتركة: الشعار، شارة الوزارة، التذييل، حركة الشريط مع التمرير */
document.documentElement.classList.add("js");
const ICONS = {"star": "<path d=\"M12 3l2.7 5.6 6.1.8-4.5 4.300 1.100 6.100L12 16.900 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.8z\"/>", "gem": "<path d=\"M7 4h10l4 5-9 11L3 9zM3 9h18M9 9l3 11 3-11M9 9l3-5 3 5\"/>", "arrow": "<path d=\"M19 12H5M11 6l-6 6 6 6\"/>", "bell": "<path d=\"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z\"/><path d=\"M10 21a2 2 0 0 0 4 0\"/>", "home": "<path d=\"M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6\"/>", "info": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 8h.01\"/>", "chart": "<path d=\"M4 20v-7M10 20V5M16 20v-10M22 20H2\"/>", "key": "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"M11 12l8-8M16 7l3 3M14 9l2 2\"/>", "school": "<path d=\"M3 10l9-6 9 6M5 10v10M19 10v10M2 20h20M9 20v-6h6v6\"/>", "users": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.9.7 3.2 2.3 3.5 5.2\"/>", "cap": "<path d=\"M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5\"/>", "building": "<path d=\"M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M2 21h20M8 7h4M8 11h4M8 15h4\"/>", "lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 018 0v3\"/>", "gear": "<path d=\"M3 6h9M16 6h5M3 12h5M12 12h9M3 18h11M18 18h3\"/><circle cx=\"14\" cy=\"6\" r=\"2\"/><circle cx=\"10\" cy=\"12\" r=\"2\"/><circle cx=\"16\" cy=\"18\" r=\"2\"/>", "globe": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18\"/>", "user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c1-4 4-6 8-6s7 2 8 6\"/>", "logout": "<path d=\"M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M15 8l4 4-4 4M19 12H9\"/>", "compass": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M15.5 8.5l-2 5-5 2 2-5z\"/>", "grid": "<rect x=\"3\" y=\"3\" width=\"7.5\" height=\"7.5\" rx=\"2\"/><rect x=\"13.5\" y=\"3\" width=\"7.5\" height=\"7.5\" rx=\"2\"/><rect x=\"3\" y=\"13.5\" width=\"7.5\" height=\"7.5\" rx=\"2\"/><rect x=\"13.5\" y=\"13.5\" width=\"7.5\" height=\"7.5\" rx=\"2\"/>", "mail": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7l9 6 9-6\"/>", "phone": "<path d=\"M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2\"/>", "pin": "<path d=\"M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>", "up": "<path d=\"M12 19V5M6 11l6-6 6 6\"/>", "signal": "<path d=\"M5 12a10 10 0 0114 0M8 15a6 6 0 018 0M12 19h.01\"/>", "hourglass": "<path d=\"M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9\"/>", "menu": "<path d=\"M4 7h16M4 12h16M4 17h16\"/>", "refresh": "<path d=\"M20 12a8 8 0 11-2.3-5.6M20 4v5h-5\"/>", "calendar": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/>", "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>", "check": "<path d=\"M4 12l5 5L20 6\"/>", "x": "<path d=\"M6 6l12 12M18 6L6 18\"/>", "plus": "<path d=\"M12 5v14M5 12h14\"/>", "list": "<path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/>", "inbox": "<path d=\"M3 13l3-8h12l3 8M3 13v6h18v-6M3 13h5l1 3h6l1-3h5\"/>", "trophy": "<path d=\"M8 4h8v5a4 4 0 01-8 0zM8 6H4v2a3 3 0 003 3M16 6h4v2a3 3 0 01-3 3M12 13v4M8 21h8M10 17h4\"/>", "help": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01\"/>", "tool": "<path d=\"M14.7 6.3a4 4 0 005 5L21 13l-8 8-4-4 8-8zM9 17l-5 5\"/>", "eye": "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>"};
const ico = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const LOGO = '<svg class="bm-ic" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lgh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18a4ab"/><stop offset="1" stop-color="#0c6f82"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#lgh)"/><rect x="13" y="16" width="38" height="34" rx="6" fill="#fff"/><path d="M13 25h38" stroke="#0c6f82" stroke-width="2.6"/><path d="M22 11v9M42 11v9" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M23 37l6 6 12-12" fill="none" stroke="#1f9d63" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="51" cy="51" r="6" fill="#f0b34a"/></svg>';
const brandHTML = (href) => `<a class="bm" href="${href || "index.html"}">${LOGO}<span><b>انضباطي</b><small>متوسطة لبيد بن ربيعة</small></span></a>`;
const moeHTML = '<span class="moe"><b>وزارة التعليم</b><small>المملكة العربية السعودية</small></span>';
// ===== التذييل الموحّد لمنظومة النواة الرقمية (نمط تذييل الخطط الذكية) =====
// النسخة نفسها في كل الأنظمة؛ يختلف سطران فقط: اسم النظام ورابط «كيف بُني المشروع».
const UF_PROJECT = "انضباطي";
const UF_HOW_URL = "https://i3zalmadeni.netlify.app/projects";
const UF_ME_URL = "https://i3zalmadeni.netlify.app/me";
const UF_CSS = `footer.uf{--uf-navy:#102c3b;--uf-blue:#3f7592;--uf-teal:#39a6a3;--uf-orange:#f0a35e;border-top:1px solid var(--line,#e2edf1);background:var(--surface,#fff);color:var(--ink,#0d2b45);font-family:inherit;margin-top:0}
footer.uf .uf-in{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-block:16px}
footer.uf .uf-moe{display:flex;flex-direction:column;align-items:center;line-height:1.2;padding-inline-start:10px;border-inline-start:2px solid var(--uf-orange)}
footer.uf .uf-moe b{font-size:.9rem;font-weight:800}footer.uf .uf-moe small{font-size:.62rem;color:var(--muted,#71859a)}
footer.uf .uf-mid{flex:1;min-width:200px;display:flex;flex-direction:column;font-size:.84rem;color:var(--muted,#71859a);line-height:1.7}footer.uf .uf-mid b{color:var(--ink,#0d2b45);font-weight:800}
footer.uf .uf-end{display:flex;align-items:center;gap:10px;margin-inline-start:auto}
footer.uf .uf-card{display:inline-flex;align-items:center;gap:12px;padding:10px 16px 10px 12px;border-radius:18px;background:var(--uf-navy);color:#fff;box-shadow:0 10px 24px rgba(16,44,59,.18)}
footer.uf .uf-card:hover .uf-mark{transform:rotate(-12deg)}
footer.uf .uf-txt{display:flex;flex-direction:column;line-height:1.35}footer.uf .uf-txt small{font-size:.72rem;color:#9fd3d1;font-weight:500}footer.uf .uf-txt b{font-size:.95rem;font-weight:800;white-space:nowrap;color:#fff}
footer.uf .uf-sep{align-self:stretch;width:1px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.35),transparent)}
footer.uf .uf-links{display:flex;flex-direction:column;gap:4px}
footer.uf .uf-links a{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border-radius:9px;color:#e6f1f5;font-weight:600;font-size:.82rem;text-decoration:none;white-space:nowrap;min-height:32px;transition:background .2s,color .2s}
footer.uf .uf-links a:hover{background:rgba(255,255,255,.1);color:var(--uf-orange)}footer.uf .uf-links a:focus-visible{outline:3px solid var(--uf-orange);outline-offset:2px}
footer.uf .uf-links svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
footer.uf .uf-mark{width:46px;height:46px;flex:none;overflow:visible;transition:transform .4s}
footer.uf .uf-mark .bg{fill:#fff}footer.uf .uf-mark .ring{fill:none;stroke:var(--uf-teal);stroke-width:2;stroke-dasharray:3 4;transform-origin:24px 24px;animation:ufSpin 18s linear infinite}
footer.uf .uf-mark .t{fill:var(--uf-navy);font:700 20px Tajawal,sans-serif}footer.uf .uf-mark .dot{fill:var(--uf-orange);transform-origin:24px 24px;animation:ufOrbit 9s ease-in-out infinite}
@keyframes ufSpin{to{transform:rotate(360deg)}}@keyframes ufOrbit{0%,70%,100%{transform:rotate(0)}85%{transform:rotate(-40deg)}}
footer.uf .uf-ai{font-style:normal;font-size:.68em;font-weight:700;letter-spacing:.04em;color:#fff;background:linear-gradient(135deg,var(--uf-teal),var(--uf-blue) 60%,var(--uf-orange));padding:.12em .5em;border-radius:6px;vertical-align:.2em;display:inline-block;line-height:1.4}
@media (max-width:860px){footer.uf .uf-in{justify-content:center;text-align:center}footer.uf .uf-end{width:100%;justify-content:flex-end}}
@media (max-width:520px){footer.uf .uf-card{flex-wrap:wrap;row-gap:8px}footer.uf .uf-sep{display:none}footer.uf .uf-links{flex-direction:row;width:100%;justify-content:flex-end}footer.uf .uf-txt b{white-space:normal}}
@media (prefers-reduced-motion:reduce){footer.uf .uf-mark .ring,footer.uf .uf-mark .dot{animation:none}}
@media print{footer.uf{display:none}}`;
(function () { if (document.getElementById("uf-css")) return; const s = document.createElement("style"); s.id = "uf-css"; s.textContent = UF_CSS; document.head.appendChild(s); })();
const footerHTML = `<footer class="uf credit"><div class="wrap uf-in"><span class="uf-moe"><b>وزارة التعليم</b><small>Ministry of Education</small></span><div class="uf-mid"><b>مدرسة لبيد بن ربيعة المتوسطة</b><span>مدير المدرسة: خالد بن عبدالرحمن الباش</span><span>${UF_PROJECT} – 1448هـ</span></div><div class="uf-end"><div class="uf-card"><svg class="uf-mark" viewBox="0 0 48 48" aria-hidden="true"><circle class="bg" cx="24" cy="24" r="21"/><circle class="ring" cx="24" cy="24" r="15"/><text class="t" x="24" y="31" text-anchor="middle">ع</text><circle class="dot" cx="39" cy="10" r="4.5"/></svg><span class="uf-txt"><small>أحد منتجات</small><b>مختبر الأفكار — عبدالعزيز المديني <i class="uf-ai">AI</i></b></span><span class="uf-sep" aria-hidden="true"></span><span class="uf-links"><a href="${UF_ME_URL}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>تعرّف عليّ</a><a href="${UF_HOW_URL}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>كيف بُني المشروع</a></span></div></div></div></footer>`;
// ===== نهاية التذييل الموحّد =====
// ===== شريط المستخدم الموحّد لمنظومة النواة الرقمية: الإشعارات، ثم صورة المستخدم واسمه الأول والأخير، ثم الخروج =====
// النسخة نفسها في كل الأنظمة. كل نظام يمرّر مصدر إشعاراته ورابط «مشاهدة الكل» إن وُجدت صفحة للإشعارات.
// زر الخروج يحمل المعرّف out، فيعمل معه معالج الخروج الموجود في كل نظام دون تغيير.
const UB_SVG = {
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  check: '<path d="M4 12l5 5L20 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', alert: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', inbox: '<path d="M3 13l3-8h12l3 8M3 13v6h18v-6M3 13h5l1 3h6l1-3h5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/>', file: '<path d="M14 3H6v18h12V7zM14 3v4h4"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z"/>',
};
const ubIco = (n) => `<svg class="ub-i" viewBox="0 0 24 24" aria-hidden="true">${UB_SVG[n] || UB_SVG.bell}</svg>`;
const ubEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// الاسم الأول والأخير: يُبقي الأسماء المركبة («عبد الله»، «آل الشيخ») متصلة
function ubShortName(n) {
  const w = String(n || "").trim().split(/\s+/).filter(Boolean); if (w.length <= 2) return w.join(" ");
  if (w.length === 3 && /^ال/.test(w[1])) return w.join(" "); // اسم حساب وصفي مثل «مدير النواة الرقمية»
  const pre = ["عبد", "أبو", "ابو", "أبا", "ابا"], mid = ["آل", "ال", "أبو", "ابو", "بن", "بنت", "عبد"];
  let first = w[0], i = 1; if (pre.includes(first) && w.length > 2) { first += " " + w[1]; i = 2; }
  let last = w[w.length - 1]; if (w.length - 2 >= i && ["آل", "ال", "أبو", "ابو", "عبد"].includes(w[w.length - 2])) last = w[w.length - 2] + " " + last;
  return mid.includes(last) ? first : first + " " + last;
}
const UB_CSS = `.ub{display:flex;align-items:center;gap:10px;flex:none}
.ub-n{position:relative}
.ub-bell{position:relative;display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.28);color:#fff;cursor:pointer;padding:0;transition:background .2s}
.ub-bell:hover,.ub-bell[aria-expanded=true]{background:rgba(255,255,255,.22)}.ub-bell:focus-visible,.ub-out:focus-visible,.ub-u:focus-visible{outline:3px solid #f0b34a;outline-offset:2px}
.ub .ub-i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ub-c{position:absolute;inset-block-start:-6px;inset-inline-end:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#f0b34a;color:#3b2a06;font-size:.72rem;font-weight:800;display:grid;place-items:center;box-shadow:0 0 0 2px #17414f;line-height:1}
.ub-c[hidden],.ub-p[hidden],.ub a.ub-all[hidden]{display:none}
.ub-p{position:absolute;inset-block-start:calc(100% + 10px);inset-inline-end:0;width:min(370px,calc(100vw - 24px));max-height:72vh;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#0d2b45);border:1px solid var(--line,#e2edf1);border-radius:18px;box-shadow:0 18px 44px rgba(8,40,60,.28);z-index:80;overflow:hidden;text-align:start;font-weight:400}
.ub-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line,#e2edf1)}
.ub-ph b{font-size:1rem;color:var(--ink,#0d2b45)}.ub-ph button{font:inherit;font-size:.8rem;font-weight:700;color:var(--brand2,#0c6f82);background:none;border:0;cursor:pointer;padding:4px 0}
.ub-l{overflow:auto;flex:1}
.ub a.ub-it{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;text-decoration:none;color:var(--ink,#0d2b45);border-bottom:1px solid var(--soft,#eef8fa);background:none;border-radius:0;font-weight:400;white-space:normal;min-height:0}
.ub a.ub-it::after{display:none}.ub a.ub-it:hover{background:var(--soft,#eef8fa);color:var(--ink,#0d2b45)}.ub a.ub-it.new{background:var(--brandsoft,#e3f6f7)}
.ub-ic{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:none;background:#e7f0fb;color:#2f6fc4}
.ub-ic .ub-i{width:17px;height:17px}.ub-it.ok .ub-ic{background:#e2f5ea;color:#1f9d63}.ub-it.warn .ub-ic{background:#fdf1dc;color:#b06d0c}.ub-it.bad .ub-ic{background:#fbe5e8;color:#c23646}
.ub-it .ub-tx{min-width:0;flex:1}.ub-it b{display:block;font-size:.9rem;line-height:1.5;color:var(--ink,#0d2b45)}.ub-it small{display:block;color:var(--ink2,#3d566b);font-size:.8rem;line-height:1.6}
.ub-it time{display:block;color:var(--muted,#71859a);font-size:.72rem;margin-top:2px}.ub-it .ub-dot{width:8px;height:8px;border-radius:50%;background:#f0b34a;flex:none;margin-top:8px}
.ub-empty{margin:18px 14px;text-align:center;color:var(--muted,#71859a);font-size:.9rem}
.ub a.ub-all{display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-top:1px solid var(--line,#e2edf1);font-weight:800;font-size:.88rem;color:var(--brand2,#0c6f82);text-decoration:none;background:var(--surface,#fff);border-radius:0;white-space:nowrap}
.ub a.ub-all:hover{background:var(--soft,#eef8fa)}
.ub a.ub-u{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:#fff;min-height:44px;padding:0;padding-inline-start:10px;border-radius:0;border-inline-start:1px solid rgba(255,255,255,.18);background:none;font-weight:400}.ub a.ub-u:hover{background:none}.ub a.ub-u::after{display:none}
.ub-av{width:36px;height:36px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;background:rgba(255,255,255,.16);color:#fff;font-weight:800;font-size:.95rem;border:2px solid rgba(255,255,255,.6)}
.ub-av img{width:100%;height:100%;object-fit:cover;display:block}
.ub-nm{color:#e3f0f5;font-size:.86rem;font-weight:700;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ub a.ub-u:hover .ub-nm{text-decoration:underline}
.ub-out{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.28);color:#fff;font:inherit;font-size:.86rem;font-weight:700;cursor:pointer;text-decoration:none;transition:background .2s}
.ub-out .ub-i{width:18px;height:18px}
.ub #out.ub-out,header .ub #out.ub-out{color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.28);box-shadow:none;transform:none}
.ub #out.ub-out:hover,header .ub #out.ub-out:hover{background:#c23646;border-color:#c23646;color:#fff}
@media (max-width:700px){.ub-nm{display:none}.ub a.ub-u{padding-inline-start:6px}}
@media (max-width:520px){.ub{gap:6px}.ub-out span{display:none}.ub-out{padding:0 10px}}
@media (max-width:640px){.ub-p{position:fixed;inset-inline:12px;inset-block-start:auto;margin-top:10px;width:auto;max-height:70vh}}
@media print{.ub{display:none}}`;
(function () { if (document.getElementById("ub-css")) return; const s = document.createElement("style"); s.id = "ub-css"; s.textContent = UB_CSS; (document.head || document.documentElement).appendChild(s); })();
// HTML الشريط. home: رابط صفحة المستخدم (ملفه أو حسابه) عند النقر على صورته واسمه
function ubBarHTML(name, home) {
  return `<div class="ub"><div class="ub-n"><button type="button" class="ub-bell" id="ubB" aria-label="الإشعارات" aria-expanded="false" aria-haspopup="true" aria-controls="ubP">${ubIco("bell")}<span class="ub-c" id="ubC" hidden></span></button>
    <div class="ub-p" id="ubP" role="dialog" aria-label="الإشعارات" hidden><div class="ub-ph"><b>الإشعارات</b><button type="button" id="ubR">تحديد الكل كمقروء</button></div><div class="ub-l" id="ubL"><p class="ub-empty">جارٍ التحميل…</p></div><a class="ub-all" id="ubA" href="#" hidden>مشاهدة الكل</a></div></div>
    <a class="ub-u" href="${ubEsc(home || "#")}" title="${ubEsc(name)}"><span class="ub-av" id="ubAv" aria-hidden="true">${ubEsc(String(name || "").trim().charAt(0))}</span><span class="ub-nm">${ubEsc(ubShortName(name))}</span></a>
    <button type="button" class="ub-out" id="out">${ubIco("logout")}<span>خروج</span></button></div>`;
}
// تشغيل الشريط بعد إدراجه. o: { client, key, uid, load: async () => [عناصر], allUrl, markAll: async () => {} }
// العنصر: { id, title, body, href, icon, tone: ok|warn|bad|info, t: وقت (اختياري), read: (اختياري؛ وإلا يُحفظ المقروء في هذا المتصفح) }
function ubMount(o) {
  const $u = (s) => document.getElementById(s), B = $u("ubB"), P = $u("ubP"), L = $u("ubL"), C = $u("ubC"), A = $u("ubA");
  if (!B) return;
  const cli = o.client || (typeof sb !== "undefined" ? sb : null);
  // الصورة: من سجل النواة (دالة core_my_photo)، وإلا يبقى أول حرف من الاسم
  if (cli) Promise.resolve(cli.rpc("core_my_photo")).then(async (r) => {
    const ph = r && r.data; if (!ph || !ph.path) return;
    let url = null;
    if (ph.public) url = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/${ph.bucket}/${ph.path.split("/").map(encodeURIComponent).join("/")}`;
    else { try { const s = await cli.storage.from(ph.bucket).createSignedUrl(ph.path, 3600); url = s && s.data && s.data.signedUrl; } catch (_) {} }
    if (!url) return; const im = new Image(); im.alt = ""; im.onload = () => { const d = $u("ubAv"); if (d) { d.textContent = ""; d.appendChild(im); } }; im.src = url;
  }).catch(() => {});
  if (o.allUrl) { A.href = o.allUrl; A.hidden = false; }
  const KEY = "ub-seen-" + (o.key || "x") + "-" + (o.uid || ""); let seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch (_) { seen = new Set(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen].slice(-300))); } catch (_) {} };
  let N = [], at = 0;
  const unread = (x) => (x.read != null ? !x.read : !seen.has(String(x.id)));
  const fmt = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }); };
  const paint = () => {
    const n = N.filter(unread).length; C.hidden = !n; C.textContent = n > 9 ? "9+" : String(n);
    B.setAttribute("aria-label", n ? `الإشعارات، ${n} غير مقروء` : "الإشعارات");
    L.innerHTML = N.length ? N.slice(0, 15).map((x, i) => `<a class="ub-it ${ubEsc(x.tone || "info")}${unread(x) ? " new" : ""}" href="${ubEsc(x.href || "#")}" data-i="${i}"><span class="ub-ic">${ubIco(x.icon || "bell")}</span><span class="ub-tx"><b>${ubEsc(x.title)}</b>${x.body ? `<small>${ubEsc(x.body)}</small>` : ""}${x.t ? `<time>${ubEsc(fmt(x.t))}</time>` : ""}</span>${unread(x) ? '<span class="ub-dot" aria-label="غير مقروء"></span>' : ""}</a>`).join("")
      : '<p class="ub-empty">لا إشعارات حالياً.</p>';
  };
  const load = async () => { try { N = (await o.load()) || []; } catch (e) { console.error(e); N = []; } N.sort((a, b) => (+new Date(b.t || 0) || 0) - (+new Date(a.t || 0) || 0)); at = Date.now(); paint(); };
  const close = () => { P.hidden = true; B.setAttribute("aria-expanded", "false"); };
  B.onclick = (e) => { e.stopPropagation(); const open = P.hidden; P.hidden = !open; B.setAttribute("aria-expanded", String(open)); if (open && Date.now() - at > 60000) load(); };
  $u("ubR").onclick = async () => { N.forEach((x) => seen.add(String(x.id))); save(); if (o.markAll) { try { await o.markAll(); } catch (_) {} } N = N.map((x) => (x.read != null ? { ...x, read: true } : x)); paint(); };
  L.addEventListener("click", (e) => { const a = e.target.closest("[data-i]"); if (!a) return; const x = N[+a.dataset.i]; if (x) { seen.add(String(x.id)); save(); } });
  P.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", close); document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !P.hidden) { close(); B.focus(); } });
  load();
}
// تحديث الاسم بعد الدخول (للأنظمة التي تبني الشريط قبل معرفة المستخدم)
function ubSetName(name, home) {
  const u = document.querySelector(".ub-u"); if (!u) return; u.title = name || ""; if (home) u.href = home;
  const n = u.querySelector(".ub-nm"); if (n) n.textContent = ubShortName(name);
  const av = document.getElementById("ubAv"); if (av && !av.querySelector("img")) av.textContent = String(name || "").trim().charAt(0);
}
// ===== نهاية شريط المستخدم الموحّد =====
(function () {
  const r = document.documentElement; let t = 0;
  const upd = () => { t = 0; const h = document.documentElement.scrollHeight - innerHeight; r.style.setProperty("--sp", h > 0 ? Math.min(1, scrollY / h).toFixed(3) : 0); };
  addEventListener("scroll", () => { if (!t) t = requestAnimationFrame(upd); }, { passive: true }); addEventListener("resize", upd); upd();
})();
function bindNav() { const b = document.querySelector(".navtoggle"), n = document.querySelector("header nav"); if (b && n) b.onclick = () => { const o = n.classList.toggle("open"); b.setAttribute("aria-expanded", o); }; }

// ===== الموقع العام: ترويسة (النواة يميناً، الصفحات وسطاً، شعار الوزارة يساراً) وديناميكية الصفحات =====
const PUB_NAV = [["index.html", "الرئيسية", "home"], ["about.html", "عن انضباطي", "info"]];
const headMoe = '<a class="moe hm" href="https://moe.gov.sa" target="_blank" rel="noopener" title="موقع وزارة التعليم"><b>وزارة التعليم</b><small>Ministry of Education</small></a>';
const CORE_N = '<svg class="cn-ic" viewBox="0 0 160 160" aria-hidden="true"><defs><linearGradient id="cnl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18a4ab"/><stop offset="1" stop-color="#0c6f82"/></linearGradient></defs><circle cx="80" cy="80" r="76" fill="#fff"/><g class="ci-ring"><circle cx="80" cy="80" r="62" fill="none" stroke="#4fa39a" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 10.8"/></g><circle cx="80" cy="80" r="42" fill="url(#cnl)"/><text x="80" y="101" text-anchor="middle" font-family="Tajawal,Tahoma,Arial,sans-serif" font-size="70" font-weight="800" fill="#fff">ن</text><g class="ci-orb"><circle cx="80" cy="16" r="8" fill="#f0b34a"/><circle cx="24.6" cy="112" r="8" fill="#e0955a"/><circle cx="135.4" cy="112" r="8" fill="#4fa39a"/></g></svg>';
const coreBlock = () => `<a class="hcb" href="${window.CORE_URL || "#"}" title="النواة الرقمية">${CORE_N}<span><b>النواة الرقمية</b><small>الهوية الموحدة</small></span></a>`;
const pubHeader = (active) => `<header><div class="wrap top">${brandHTML("index.html")}<button class="navtoggle" aria-label="القائمة" aria-expanded="false">${ico("menu")}</button>
<nav>${PUB_NAV.map(([h, n, i]) => `<a href="${h}" class="${h === active ? "on" : ""}" ${h === active ? 'aria-current="page"' : ""}>${ico(i || "star")}${n}</a>`).join("")}<a href="login.html" data-login="1" class="${active === "login.html" ? "on" : ""}" ${active === "login.html" ? 'aria-current="page"' : ""}>${ico("grid")}لوحة التحكم</a><a class="only-m" href="${window.CORE_URL || "#"}">النواة الرقمية</a></nav><div class="hid">${coreBlock()}${headMoe}</div></div></header>`;
// شريط داكن لأقسام الصفحة الحالية (يُبنى من العناوين) مع تمييز القسم الظاهر أثناء التمرير
function pubSubnav() {
  const bar = document.getElementById("pubsub"); if (!bar) return;
  const secs = [...document.querySelectorAll("[data-sec], section.pub > h2")].filter((e) => e.offsetParent !== null || e.dataset.sec);
  const items = secs.map((e, i) => { if (!e.id) e.id = "sec" + i; return { id: e.id, t: e.dataset.sec || e.textContent.trim(), i: e.dataset.secIco || "grid" }; });
  if (items.length < 2) { bar.hidden = true; return; }
  const inn = bar.querySelector(".dnav-in"); inn.innerHTML = items.map((x) => `<a href="#${x.id}">${ico(x.i)}${pesc2(x.t)}</a>`).join(""); bar.hidden = false;
  const links = [...inn.children], spy = () => { let cur = 0; items.forEach((x, k) => { const el = document.getElementById(x.id); if (el && el.getBoundingClientRect().top < 160) cur = k; }); links.forEach((a, k) => a.classList.toggle("on", k === cur)); };
  if (!window._spy) { window._spy = true; addEventListener("scroll", () => window._spyFn && window._spyFn(), { passive: true }); }
  window._spyFn = spy; spy();
}
const pesc2 = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CORE_ICON = `<svg class="core-ic" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18a4ab"/><stop offset="1" stop-color="#0c6f82"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#cg)"/><rect x="13" y="16" width="38" height="34" rx="6" fill="#fff"/><path d="M13 25h38" stroke="#0c6f82" stroke-width="2.6"/><path d="M22 11v9M42 11v9" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M23 37l6 6 12-12" fill="none" stroke="#1f9d63" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="51" cy="51" r="6" fill="#f0b34a"/></svg>`;
function pubInit(active) {
  const h = document.getElementById("hdr"); if (h) h.outerHTML = pubHeader(active);
  const f = document.getElementById("ftr"); if (f) f.outerHTML = footerHTML;
  document.querySelectorAll("[data-core]").forEach((e) => (e.innerHTML = CORE_ICON));
  document.querySelectorAll("[data-ico]").forEach((e) => (e.innerHTML = ico(e.dataset.ico)));
  bindNav(); pubSubnav();
  try { if (Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k))) document.querySelectorAll("[data-login]").forEach((a) => { a.href = "dashboard.html"; }); } catch (e) {}
  const rv = document.querySelectorAll(".rv"), reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const count = (el) => { const to = +el.dataset.count, t0 = performance.now(); if (reduce) { el.textContent = to; return; } const step = (t) => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  if (!("IntersectionObserver" in window)) { rv.forEach((e) => e.classList.add("in")); document.querySelectorAll("[data-count]").forEach(count); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); e.target.querySelectorAll("[data-count]").forEach(count); if (e.target.dataset.count) count(e.target); io.unobserve(e.target); } }), { threshold: 0.15 });
  rv.forEach((e) => io.observe(e));
  const hero = document.querySelector(".hero,.hero3"); if (hero && !reduce) hero.addEventListener("pointermove", (ev) => { const r = hero.getBoundingClientRect(); hero.style.setProperty("--mx", ((ev.clientX - r.left) / r.width).toFixed(3)); hero.style.setProperty("--my", ((ev.clientY - r.top) / r.height).toFixed(3)); });
}

(function () {
  const r = document.documentElement, reduce = matchMedia("(prefers-reduced-motion:reduce)").matches; let t = 0;
  const run = () => { t = 0; const y = scrollY; r.style.setProperty("--sy", y.toFixed(0));
    const h = document.querySelector("header"); if (h) h.classList.toggle("sc", y > 40);
    const links = [...document.querySelectorAll("header nav a[data-s]")]; if (!links.length || !document.getElementById("home")) return;
    let cur = ""; links.forEach((a) => { const el = document.getElementById(a.dataset.s); if (el && el.getBoundingClientRect().top < innerHeight * 0.35) cur = a.dataset.s; });
    links.forEach((a) => { const on = a.dataset.s === cur; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"); }); };
  if (!reduce) addEventListener("scroll", () => { if (!t) t = requestAnimationFrame(run); }, { passive: true }); else addEventListener("scroll", run, { passive: true });
  addEventListener("load", run); addEventListener("hashchange", () => setTimeout(run, 50)); setTimeout(run, 300);
})();
