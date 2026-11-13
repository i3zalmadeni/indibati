/* المنطق المشترك لنظام «انضباطي». الهوية من core.css وchrome.js (هوية النواة الرقمية).
   كل كتابة وقراءة تشغيلية عبر دوال ind_* في قاعدة النواة، وتتحقق من الدور والإسناد والتثبيت على الخادم.
   إخفاء عناصر الواجهة هنا للتيسير فقط ولا يُعتمد عليه في الحماية. */
const sb = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
async function doLogout(to) {
  try { await Promise.race([sb.auth.signOut({ scope: "local" }), new Promise((r) => setTimeout(r, 2500))]); } catch (_) {}
  try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => localStorage.removeItem(k)); sessionStorage.clear(); } catch (_) {}
  location.replace(to || "index.html");
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// ===== التاريخ والوقت: توقيت الرياض، والهجري (أم القرى) مع الميلادي =====
const TZ = "Asia/Riyadh";
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const nowHM = () => new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const d12 = (iso) => new Date(String(iso).slice(0, 10) + "T12:00:00Z");
const fmtDay = (iso) => (iso ? d12(iso).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
const fmtHijri = (iso) => (iso ? d12(iso).toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
const fmtBoth = (iso) => (iso ? `${fmtHijri(iso)} · ${d12(iso).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}م` : "—");
const fmtShortDay = (iso) => d12(iso).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const fmtT = (d) => (d ? new Date(d).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }) : "—");
const fmtHM = (hm) => { if (!hm) return "—"; const [h, m] = String(hm).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`; };
const dow = (iso) => d12(iso).getUTCDay();
// آخر يوم دراسي حتى اليوم (يتخطى الإجازة الأسبوعية): الافتراضي لشاشات التحضير واللوحة
const lastSchoolDay = (meta) => { const wk = meta?.attendance?.weekend || []; let d = d12(meta?.today || todayISO()); for (let i = 0; i < 7 && wk.includes(d.getUTCDay()); i++) d = new Date(d - 864e5); return d.toISOString().slice(0, 10); };

const ERR = {
  forbidden: "لا تملك صلاحية تنفيذ هذه العملية. سُجّلت المحاولة.",
  locked: "التحضير مثبت لهذا الفصل في هذا التاريخ. يلزم إلغاء التثبيت من منسق الغياب.",
  date_future: "لا يمكن التسجيل بتاريخ مستقبلي.",
  date_too_old: "التاريخ أقدم من المدة المسموحة للتسجيل بأثر رجعي. راجع منسق الغياب.",
  date_out_of_year: "التاريخ خارج العام الدراسي الحالي.",
  weekend_day: "التاريخ المختار يوم إجازة أسبوعية.",
  year_not_current: "هذا الفصل لا يتبع العام الدراسي الحالي.",
  day_required: "اختر التاريخ.",
  student_not_in_section: "أحد الطلاب لا ينتمي إلى هذا الفصل. حدّث الصفحة.",
  recorded_in_other_section: "سُجّل غياب أحد الطلاب في فصل آخر في اليوم نفسه.",
  duplicate_student: "تكرر طالب في القائمة.",
  status_invalid: "حالة غير صحيحة.",
  reason_required: "السبب مطلوب.",
  other_reason_required: "اكتب السبب الذي ذكره الطالب.",
  arrival_required: "حدد وقت وصول الطالب.",
  not_late: "وقت الوصول قبل بداية احتساب التأخر.",
  lateness_exists: "سُجّل تأخر لهذا الطالب في هذا اليوم.",
  student_not_enrolled: "الطالب غير مقيد في العام الدراسي الحالي.",
  text_too_long: "النص أطول من 300 حرف.",
  sections_required: "اختر فصلاً واحداً على الأقل.",
  staff_not_found: "المنسوب غير موجود أو غير فعّال.",
  section_not_found: "الفصل غير موجود في العام الحالي.",
  assignment_exists: "لهذا المنسوب تكليف فعّال آخر للمهمة نفسها.",
  name_required: "الاسم مطلوب.", name_taken: "الاسم مستخدم.",
  late_before_start: "بداية احتساب التأخر يجب أن تكون بعد بداية الدوام.",
  no_sections: "لا فصول في النطاق المحدد.",
  not_found: "السجل غير موجود.", bad_request: "طلب غير صحيح.",
  already_decided: "صدر قرار نهائي في هذا العذر.", not_allowed: "الإجراء غير متاح في حالة الرسالة الحالية.",
  students_required: "حدد طالباً واحداً على الأقل.", too_many: "العدد كبير جداً في دفعة واحدة.",
  invalid_link: "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً من المدرسة.",
  no_absence_that_day: "لا يوجد غياب مسجل لهذا التاريخ.", excuse_too_late: "انتهت المدة المسموحة لتقديم العذر لهذا اليوم.",
  attachment_required: "إرفاق ملف العذر مطلوب.", too_many_files: "ثلاثة مرفقات كحد أقصى.", excuse_exists: "سبق تقديم عذر لهذا اليوم.",
  attachment_invalid: "مرفق غير صالح.", range_too_long: "الفترة أطول من المسموح (400 يوم).",
};
const mapErr = (e) => { const m = e?.message || String(e); return ERR[m] || (/permission denied|row-level security/i.test(m) ? ERR.forbidden : /Failed to fetch|NetworkError/i.test(m) ? "تعذر الاتصال بالخادم. تحقق من الشبكة." : m); };
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) throw new Error(mapErr(error));
  if (data && typeof data === "object" && !Array.isArray(data) && data.error) throw new Error(mapErr({ message: data.error }));
  return data;
}

function toast(msg, bad) { const d = document.createElement("div"); d.className = "toast" + (bad ? " bad" : ""); d.setAttribute("role", "status"); d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 4000); }
function modal(html, wide) {
  const ov = document.createElement("div"); ov.className = "ov"; ov.innerHTML = `<div class="md" role="dialog" aria-modal="true" ${wide ? 'style="max-width:860px"' : ""}>${html}</div>`;
  const close = () => ov.remove(); ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
  document.body.appendChild(ov); return { el: ov.firstChild, close };
}
// نافذة تأكيد للعمليات الحساسة، مع حقل سبب اختياري أو إلزامي
function confirmBox(title, body, { okText = "تأكيد", reason = null, danger = false } = {}) {
  return new Promise((res) => {
    const md = modal(`<h3>${esc(title)}</h3><div class="sub">${body}</div>${reason ? `<label for="cr">${esc(reason.label)}${reason.required ? " *" : ""}</label><textarea id="cr" maxlength="500"></textarea>` : ""}<p class="err" id="ce" role="alert"></p>
      <div class="acts mt"><button class="btn ${danger ? "bad" : ""}" id="ok">${esc(okText)}</button><button class="btn sec" id="no">رجوع</button></div>`);
    $("#no", md.el).onclick = () => { md.close(); res(null); };
    $("#ok", md.el).onclick = () => { const v = reason ? $("#cr", md.el).value.trim() : ""; if (reason?.required && !v) { $("#ce", md.el).textContent = "السبب مطلوب."; return; } md.close(); res({ reason: v }); };
    (reason ? $("#cr", md.el) : $("#ok", md.el)).focus();
  });
}
const empty = (icon, t, s) => `<div class="card empty"><div class="big">${ico(icon)}</div><b>${esc(t)}</b>${s ? `<p class="sub">${s}</p>` : ""}</div>`;
const loading = (t) => `<p class="sub" aria-busy="true">${esc(t || "جارٍ التحميل…")}</p>`;
Object.assign(ICONS, {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  file: '<path d="M14 3H6v18h12V7zM14 3v4h4"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.500 4 2.500 4H5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
});
const STATUS = { present: "حاضر", absent_excused: "غائب بعذر", absent_unexcused: "غائب بدون عذر" };
const TASK = { absence: "تسجيل الغياب", lateness: "تسجيل التأخر" };
const ROLE = { coordinator: "منسق الغياب", affairs: "شؤون الطلاب", portal_admin: "مدير البوابة" };
const FN = (name) => APP_CONFIG.supabaseUrl + "/functions/v1/" + name;
const EXC = { submitted: ["عذر مقدم", "info"], under_review: ["قيد المراجعة", "warn"], approved: ["معتمد", "ok"], rejected: ["غير معتمد", "bad"] };
const NST = { queued: ["بانتظار الإرسال", "warn"], sending: ["قيد الإرسال", "warn"], no_phone: ["لا يوجد رقم", "bad"], sent: ["قبلها واتساب", "info"], delivered: ["وصلت", "ok"], read: ["قُرئت", "ok"], failed: ["فشل الإرسال", "bad"], cancelled: ["ملغاة", ""] };
const NKIND = { absence: "إشعار غياب", lateness: "إشعار تأخر", lateness_repeat: "تكرار التأخر", escalation: "إجراء نظامي", excuse_received: "استلام عذر", excuse_result: "نتيجة العذر" };
const badge = (m, k) => { const [t, c] = m[k] || [k, ""]; return `<span class="badge ${c}">${esc(t)}</span>`; };
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast("نُسخ"); } catch (_) { prompt("انسخ الرابط:", t); } }
const lockBadge = (on) => `<span class="lockst ${on ? "on" : "off"}">${ico(on ? "lock" : "unlock")}${on ? "مثبت" : "غير مثبت"}</span>`;

// ===== اختيار الصف ثم الفصل ثم التاريخ (المرحلة واحدة: المتوسطة) =====
function sectionPicker(host, meta, { withDay = true, day, section, onChange } = {}) {
  const grades = meta.grades.filter((g) => meta.sections.some((s) => s.grade === g.code));
  host.innerHTML = `<div class="pickbar"><div><label for="pg">الصف</label><select id="pg">${grades.length > 1 ? '<option value="">كل الصفوف</option>' : ""}${grades.map((g) => `<option value="${esc(g.code)}">${esc(g.name)}</option>`).join("")}</select></div>
    <div><label for="ps">الفصل</label><select id="ps"></select></div>
    ${withDay ? `<div><label for="pd">التاريخ</label><input type="date" id="pd" max="${esc(meta.today)}" value="${esc(day || lastSchoolDay(meta))}"><div class="dayhint" id="pdh"></div></div>` : ""}</div>`;
  const g = $("#pg", host), s = $("#ps", host), d = $("#pd", host);
  const fill = () => { const list = meta.sections.filter((x) => !g.value || x.grade === g.value);
    s.innerHTML = list.length ? `<option value="">اختر الفصل</option>` + list.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join("") : '<option value="">لا فصول</option>'; };
  const hint = () => { if (!d) return; const wk = (meta.attendance?.weekend || []).includes(dow(d.value)); $("#pdh", host).textContent = d.value ? (wk ? "يوم إجازة أسبوعية" : fmtHijri(d.value)) : ""; };
  const sel = meta.sections.find((x) => x.id === section);
  if (sel) g.value = sel.grade; fill(); if (sel) s.value = sel.id;
  if (meta.sections.length === 1 && !sel) s.value = meta.sections[0].id;
  const fire = () => { hint(); onChange && onChange({ grade: g.value, section: s.value, day: d ? d.value : null }); };
  g.onchange = () => { fill(); fire(); }; s.onchange = fire; if (d) d.onchange = fire;
  hint(); return { get: () => ({ grade: g.value, section: s.value, day: d ? d.value : null }), fire };
}

// ===== البحث المباشر عن طالب =====
function studentSearch(root, task, onPick) {
  root.classList.add("pick");
  root.innerHTML = `<input type="search" placeholder="اكتب اسم الطالب أو رقمه" autocomplete="off" aria-label="بحث عن طالب"><div class="res" hidden></div>`;
  const inp = $("input", root), res = $(".res", root); let t = 0, seq = 0;
  const run = async () => {
    const q = inp.value.trim(), my = ++seq; if (q.length < 2) { res.hidden = true; return; }
    try {
      const rows = await rpc("ind_student_search", { p_q: q, p_task: task, p_limit: 12 }); if (my !== seq) return;
      res.innerHTML = rows.length ? rows.map((s, i) => `<button type="button" data-i="${i}"><span>${esc(s.name)}</span><small>${esc(s.grade_name)} · ${esc(s.section)} · ${esc(s.no || "")}</small></button>`).join("") : '<p class="sub" style="margin:12px">لا نتائج ضمن فصولك.</p>';
      res.hidden = false; $$("button", res).forEach((b) => (b.onclick = () => { res.hidden = true; inp.value = ""; onPick(rows[+b.dataset.i]); }));
    } catch (e) { res.innerHTML = `<p class="err" style="margin:12px">${esc(mapErr(e))}</p>`; res.hidden = false; }
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 250); });
  document.addEventListener("click", (e) => { if (!root.contains(e.target)) res.hidden = true; });
  return inp;
}

// ===== التصدير والطباعة =====
function exportCSV(name, headers, rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(["﻿" + [headers, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}-${todayISO()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ===== الهيكل والقائمة بحسب الدور =====
// r: all | absence | lateness | coord | admin(portal) | oversee
const NAV = [
  ["dashboard.html", "الرئيسية", "grid", "ملخص اليوم ومهامك", "all"],
  ["attendance.html", "التحضير", "check", "اختر الفصل والتاريخ ثم حدد الغائبين فقط", "absence"],
  ["locks.html", "التثبيت", "lock", "حالة التحضير والتثبيت لكل فصل وتاريخ", "absence"],
  ["lateness.html", "التأخر", "clock", "تسجيل حالات التأخر الصباحي ومتابعتها", "lateness"],
  ["excuses.html", "الأعذار", "file", "أعذار الغياب المقدمة من أولياء الأمور ومراجعتها", "oversee"],
  ["student.html", "الملفات", "user", "سجل الطالب التراكمي: الغياب والتأخر والأعذار والإشعارات والإجراءات", "oversee"],
  ["notifications.html", "الإشعارات", "bell", "رسائل أولياء الأمور عبر واتساب: الإعداد والإرسال والمتابعة", "oversee"],
  ["reports.html", "التقارير", "chart", "تقارير الحضور والغياب والتأخر والإشعارات والأعذار والإجراءات والنقاط، مع التصدير والطباعة", "oversee"],
  ["escalations.html", "الإجراءات", "flag", "إشعارات الغياب النظامية وحدودها وطباعتها", "oversee"],
  ["assignments.html", "التكليفات", "users", "إسناد فصول الغياب والتأخر لمدخلي البيانات", "coord"],
  ["settings.html", "الإعدادات", "gear", "إعدادات التأخر والتحضير والأسباب والأدوار", "admin"],
  ["audit.html", "السجل", "list", "كل عملية مسجلة بالمستخدم والوقت والقيم السابقة والجديدة", "admin"],
];
async function boot(page, render, o = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search)); return; }
  const shell = document.getElementById("shell");
  const fail = (msg) => {
    shell.innerHTML = `<main class="wrap"><div class="card" style="max-width:520px;margin:48px auto"><h3 style="margin-top:0">تعذر فتح لوحة التحكم</h3><p class="err">${esc(msg)}</p><div class="acts mt"><button class="btn" id="rt">إعادة المحاولة</button><button class="btn sec" id="lo">تسجيل الخروج</button></div></div></main>`;
    $("#rt").onclick = () => location.reload(); $("#lo").onclick = () => doLogout();
  };
  let who;
  try { who = await rpc("ind_whoami"); } catch (e) { console.error(e); fail(/does not exist|schema cache|Could not find/i.test(String(e.message)) ? "لم يُنفَّذ سكربت قاعدة بيانات انضباطي بعد (supabase/migrations/0301)." : "تعذر الاتصال بالخادم أو التحقق من حسابك."); return; }
  if (!who) { await doLogout("login.html?e=nostaff"); return; }
  const tasks = new Set(who.tasks || []);
  const ctx = { who, uid: session.user.id, isAdmin: who.is_admin, isCoord: who.is_coord, isAffairs: who.is_affairs, isPortal: who.is_portal_admin,
    absence: who.is_coord || tasks.has("absence"), lateness: who.is_coord || tasks.has("lateness"), oversee: who.is_coord || who.is_affairs,
    role: who.is_coord ? (who.is_admin ? "مدير النواة الرقمية" : "منسق الغياب") : who.is_affairs ? "شؤون الطلاب" : who.is_portal_admin ? "مدير البوابة" : tasks.size ? "مدخل بيانات" : "منسوب" };
  window.__ind = ctx;
  const ok = (r) => r === "all" || (r === "absence" && (ctx.absence || ctx.oversee)) || (r === "lateness" && (ctx.lateness || ctx.oversee)) || (r === "coord" && ctx.isCoord) || (r === "oversee" && ctx.oversee) || (r === "admin" && (ctx.isCoord || ctx.isPortal));
  if (o.role && !ok(o.role)) { location.replace("dashboard.html"); return; }
  const FULL = { "reports.html": "التقارير", "attendance.html": "التحضير اليومي", "student.html": "الملف الانضباطي", "notifications.html": "مركز الإشعارات", "escalations.html": "الإجراءات النظامية", "assignments.html": "إدارة التكليفات", "audit.html": "سجل العمليات" };
  const cur0 = NAV.find((n) => n[0] === page), cur = cur0 ? [cur0[0], FULL[page] || cur0[1], cur0[2], cur0[3]] : [page, o.title || "لوحة التحكم", "grid", o.desc || ""];
  shell.innerHTML =
    `<header class="dash"><div class="wrap top">${brandHTML("dashboard.html")}<div class="idl"><a class="sitelink" href="index.html">الموقع الإلكتروني</a><span class="vdiv"></span>${coreBlock()}${headMoe}</div></div>
     <div class="strip" aria-hidden="true"></div>
     <div class="dnav"><div class="wrap dn"><div class="dnav-in">${NAV.filter((n) => ok(n[4])).map(([h, n, e, t]) => `<a href="${h}" title="${esc(t)}" class="${h === page ? "on" : ""}" ${h === page ? 'aria-current="page"' : ""}>${ico(e)}${n}</a>`).join("")}</div>
     <div class="dwho"><span class="dname">${esc(who.name)}</span><a class="loginbtn" href="#" id="out">خروج</a></div></div></div></header>
     <div class="pagebar"><div class="wrap pb"><div class="pb-t"><small>${esc(ctx.role)}</small><h1>${esc(cur[1])}</h1></div><p class="pb-d">${esc(cur[3])}</p>
     <div class="pb-u"><span id="pbTime">${esc(fmtHijri(todayISO()))}</span><button class="btn sec sm" id="pbRefresh" type="button">${ico("refresh")}تحديث</button></div></div></div>
     <main class="wrap" id="main"></main>${footerHTML}`;
  bindNav();
  document.title = cur[1] + " – انضباطي";
  $("#pbRefresh").onclick = () => location.reload();
  $("#out").onclick = (e) => { e.preventDefault(); doLogout(); };
  const main = $("#main");
  try { await render(main, ctx); } catch (e) { console.error(e); main.innerHTML = `<div class="card"><p class="err">تعذر تحميل الصفحة: ${esc(mapErr(e))}</p><button class="btn sec" onclick="location.reload()">إعادة المحاولة</button></div>`; }
}
// تبويبات داخل الصفحة
function tabs(host, list, onTab) {
  const q = new URLSearchParams(location.search).get("tab"); let cur = list.some((t) => t[0] === q) ? q : list[0][0];
  host.innerHTML = `<div class="subnav card" role="tablist" style="padding:0 6px;margin-bottom:12px">${list.map(([k, n, i]) => `<a href="?tab=${k}" role="tab" data-t="${k}">${ico(i)}${esc(n)}</a>`).join("")}</div><div id="tabbody"></div>`;
  const body = $("#tabbody", host);
  const go = async (k) => { cur = k; $$("[data-t]", host).forEach((a) => { const on = a.dataset.t === k; a.classList.toggle("on", on); a.setAttribute("aria-selected", on); });
    body.innerHTML = loading(); try { await onTab(k, body); } catch (e) { body.innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; } };
  $$("[data-t]", host).forEach((a) => (a.onclick = (e) => { e.preventDefault(); history.replaceState(null, "", "?tab=" + a.dataset.t); go(a.dataset.t); }));
  go(cur);
}
