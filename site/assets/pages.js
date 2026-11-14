/* صفحات لوحة تحكم «انضباطي». كل صفحة تُستدعى من ملف HTML بسطر واحد: PAGES.<name>() */
const PAGES = {};

// ============================== الرئيسية ==============================
PAGES.dashboard = () => boot("dashboard.html", async (main, c) => {
  main.innerHTML = loading();
  const meta = await rpc("ind_meta", { p_task: "view" }), day = lastSchoolDay(meta), notToday = day !== meta.today;
  let html = "";
  // مهام مدخل البيانات
  const my = await rpc("ind_my_tasks", { p_day: day });
  if (my.length) {
    html += `<h2 class="sec">${notToday ? "مهامي في آخر يوم دراسي" : "مهامي اليوم"} <small class="sub">${esc(fmtBoth(day))}</small></h2><div class="grid">${my.map((t) => `<div class="task-c"><div class="row2"><b>${ico(t.task === "absence" ? "check" : "clock")} ${esc(TASK[t.task])}</b>
      <a class="btn sm" href="${t.task === "absence" ? "attendance.html" : "lateness.html"}">فتح الشاشة</a></div>
      <div class="tw mt"><table class="tbl"><thead><tr><th>الفصل</th><th>${t.task === "absence" ? "التحضير" : "التأخر اليوم"}</th>${t.task === "absence" ? "<th>التثبيت</th>" : ""}</tr></thead><tbody>
      ${(t.sections || []).map((s) => `<tr><td>${t.task === "absence" ? `<a href="attendance.html?s=${s.id}&d=${day}">${esc(s.label)}</a>` : esc(s.label)}</td><td>${t.task === "absence" ? (s.saved ? '<span class="badge ok">محفوظ</span>' : '<span class="badge warn">لم يُحفظ</span>') : `<b class="mono">${s.late_today}</b>`}</td>${t.task === "absence" ? `<td>${lockBadge(s.locked)}</td>` : ""}</tr>`).join("")}</tbody></table></div></div>`).join("")}</div>`;
  }
  if (c.oversee) {
    const [d, ab] = await Promise.all([rpc("ind_dashboard", { p_day: day }), rpc("ind_day_absentees", { p_day: day })]);
    const maxW = Math.max(1, ...d.week.map((x) => Math.max(x.absent, x.late)));
    const pend = d.sections.filter((s) => !s.saved), unl = d.sections.filter((s) => s.saved && !s.locked);
    const XS = { submitted: ["عذر جديد", "warn"], under_review: ["قيد المراجعة", "warn"], approved: ["عذر معتمد", "ok"], rejected: ["عذر مرفوض", "bad"] };
    html += `<h2 class="sec">${notToday ? "آخر يوم دراسي" : "اليوم"} <small class="sub">${esc(fmtBoth(day))}</small></h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      <div class="card"><div class="row2"><h3 class="sec" style="margin:0">${ico("check")} لم يكتمل تحضيرها (${pend.length})</h3><a class="btn sm sec" href="attendance.html">التحضير</a></div>
        ${pend.length ? `<div class="pill-l mt">${pend.map((s) => `<a href="attendance.html?s=${s.id}&d=${day}"><span>${esc(s.label)}</span></a>`).join("")}</div>` : '<p class="sub">اكتمل تحضير جميع الفصول.</p>'}</div>
      <div class="card"><div class="row2"><h3 class="sec" style="margin:0">${ico("lock")} حُضّرت ولم تُثبَّت (${unl.length})</h3><a class="btn sm sec" href="locks.html?d=${day}">التثبيت</a></div>
        ${unl.length ? `<div class="pill-l mt">${unl.map((s) => `<span>${esc(s.label)}</span>`).join("")}</div>` : `<p class="sub">${pend.length ? "لا فصول محفوظة بانتظار التثبيت." : "جميع الفصول مثبتة."}</p>`}</div>
    </div>
    <h3 class="sec">إحصائيات الغياب</h3>
    <div class="kgrid">
      <div class="kpi k0"><div class="ic">${ico("users")}</div><div><b class="mono">${d.total}</b><span>إجمالي الطلاب</span></div></div>
      <div class="kpi k4"><div class="ic">${ico("check")}</div><div><b class="mono">${d.present}</b><span>${d.sections.some((x) => x.saved) ? `حاضر${d.rate != null ? ` · ${d.rate}%` : ""}` : "لم يبدأ التحضير"}</span></div></div>
      <div class="kpi k5"><div class="ic">${ico("x")}</div><div><b class="mono">${d.excused + d.unexcused}</b><span>إجمالي الغائبين</span></div></div>
      <div class="kpi k3"><div class="ic">${ico("file")}</div><div><b class="mono">${d.excused}</b><span>غائب بعذر</span></div></div>
      <div class="kpi k5"><div class="ic">${ico("x")}</div><div><b class="mono">${d.unexcused}</b><span>غائب بدون عذر</span></div></div>
      <div class="kpi k1"><div class="ic">${ico("clock")}</div><div><b class="mono">${d.late}</b><span>حالة تأخر</span></div></div>
    </div>
    <div class="card mt"><div class="row2"><h3 class="sec" style="margin:0">${ico("users")} الغائبون (${ab.length})</h3>
      <div class="acts">${ab.length && c.isCoord ? `<a class="btn sm" href="messages.html?d=${day}">${ico("send")}رسائل الغياب</a>` : ""}${ab.length ? `<button class="btn sm sec" id="abx">${ico("file")}تصدير</button>` : ""}</div></div>
      ${ab.length ? `<div class="tw mt"><table class="tbl"><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>العذر</th></tr></thead><tbody>${ab.map((r, i) => `<tr><td class="mono">${i + 1}</td>
        <td><a href="student.html?id=${r.student_id}">${esc(r.name)}</a></td><td>${esc(r.label)}${r.locked ? "" : ' <span class="badge warn">غير مثبت</span>'}</td>
        <td><span class="badge ${r.status === "absent_unexcused" ? "bad" : "warn"}">${STATUS[r.status]}</span></td><td>${r.excuse ? `<span class="badge ${XS[r.excuse][1]}">${XS[r.excuse][0]}</span>` : "—"}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="sub">${d.sections.some((x) => x.saved) ? "لا غائبين مسجلين." : "لم يبدأ التحضير بعد."}</p>`}</div>
    <div id="dx"></div>
    <div class="grid mt" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="card"><h3 class="sec" style="margin-top:0">آخر سبعة أيام</h3><div class="bars">${d.week.map((x) => `<div class="br"><span>${esc(fmtShortDay(x.day))}</span><span><i style="width:${(100 * x.absent) / maxW}%" title="غياب ${x.absent}"></i><i class="l" style="width:${(100 * x.late) / maxW}%;margin-top:3px" title="تأخر ${x.late}"></i></span><small class="mono">${x.absent}/${x.late}</small></div>`).join("")}</div>
        <p class="sub"><span class="badge">الأزرق: غياب</span> <span class="badge warn">الذهبي: تأخر</span></p></div>
      <div class="card"><h3 class="sec" style="margin-top:0">أكثر أسباب التأخر (أسبوع)</h3>${d.top_reasons.length ? d.top_reasons.map((r) => `<div class="row2"><span>${esc(r.name)}</span><b class="mono">${r.count}</b></div>`).join("") : '<p class="sub">لا حالات تأخر.</p>'}</div>
    </div>`;
    var ABX = ab;
  }
  if (!html) html = empty("inbox", "لا مهام مسندة إليك في انضباطي", "يُسند منسق الغياب فصول تسجيل الغياب أو التأخر من «إدارة التكليفات». راجعه إن كنت مكلفاً.");
  main.innerHTML = html;
  if ($("#abx")) $("#abx").onclick = () => exportCSV("الغائبون", ["الطالب", "رقم الطالب", "الفصل", "الحالة", "العذر"], ABX.map((r) => [r.name, r.no, r.label, STATUS[r.status], r.excuse || ""]));
  if (c.oversee) { try { const x = await rpc("ind_dashboard_extra");
    $("#dx").innerHTML = `<div class="grid mt" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <a class="card" href="excuses.html" style="text-decoration:none"><b class="mono" style="font-size:1.6rem">${x.excuses_new}</b><br><span class="sub">عذر جديد بانتظار المراجعة</span></a>
      <a class="card" href="notifications.html?tab=log" style="text-decoration:none"><b class="mono" style="font-size:1.6rem">${x.notif_queued} · ${x.notif_failed}</b><br><span class="sub">رسالة معلقة · فاشلة</span></a>
      <a class="card" href="escalations.html" style="text-decoration:none"><b class="mono" style="font-size:1.6rem">${x.escalations_active}</b><br><span class="sub">${x.rules_active ? "إجراء نظامي لم يُطبع" : "الإجراءات النظامية غير مفعّلة"}</span></a>
      <div class="card"><b>الأكثر غياباً</b>${x.top_absent.slice(0, 3).map((s) => `<div class="row2"><a href="student.html?id=${s.id}">${esc(s.name)}</a><b class="mono">${s.n}</b></div>`).join("") || '<p class="sub">—</p>'}</div>
      <div class="card"><b>الأكثر تأخراً</b>${x.top_late.slice(0, 3).map((s) => `<div class="row2"><a href="student.html?id=${s.id}">${esc(s.name)}</a><b class="mono">${s.n}</b></div>`).join("") || '<p class="sub">—</p>'}</div></div>`; } catch (_) {} }
});

// ============================== التحضير اليومي ==============================
PAGES.attendance = () => boot("attendance.html", async (main, c) => {
  const meta = await rpc("ind_meta", { p_task: c.oversee ? "view" : "absence" });
  if (!meta.sections.length) { main.innerHTML = empty("users", "لا فصول مسندة إليك لتسجيل الغياب", "راجع منسق الغياب لإسناد فصولك."); return; }
  const qs = new URLSearchParams(location.search);
  main.innerHTML = `<div class="card"><div id="pick"></div><div id="cls" class="mt"></div></div><div class="card mt"><div id="body">${empty("check", "اختر الفصل لعرض قائمة الطلاب", "يظهر جميع الطلاب «حاضرين»، وتحدد الغائبين فقط.")}</div></div>`;
  let state = null, dirty = false, cardsDay = null, cardSeq = 0;
  const AT = { none: ["x", "لم يُحضَّر"], saved: ["clock", "حُضِّر · بانتظار التثبيت"], locked: ["lock", "مثبت"] };
  const loadCards = async (day) => {
    cardsDay = day; const my = ++cardSeq, host = $("#cls");
    if (!day || (meta.attendance?.weekend || []).includes(dow(day))) { host.innerHTML = ""; return; }
    let rows; try { rows = await rpc("ind_day_status", { p_day: day, p_grade: null }); } catch (_) { host.innerHTML = ""; return; }
    if (my !== cardSeq) return;
    const k = (r) => (r.locked ? "locked" : r.saved ? "saved" : "none"), n = (x) => rows.filter((r) => k(r) === x).length, cur = picker.get().section;
    host.innerHTML = rows.length ? `<div class="lgd" role="group" aria-label="حالة التحضير">${["none", "saved", "locked"].map((x) => `<span class="lg at-${x}"><i></i>${AT[x][1]}<b>${n(x)}</b></span>`).join("")}</div>
      <div class="atgrid">${rows.map((r) => { const x = k(r); return `<button type="button" class="at-c at-${x} ${r.id === cur ? "cur" : ""}" data-id="${r.id}" aria-label="${esc(r.label)} — ${AT[x][1]}"><b>${esc(r.label)}</b><span class="stb">${ico(AT[x][0])}${AT[x][1]}</span><small>${r.students} طالب${r.saved ? ` · غائب ${r.excused + r.unexcused}` : ""}</small></button>`; }).join("")}</div>` : "";
    $$(".at-c", host).forEach((b) => (b.onclick = () => { if (dirty && !confirm("لديك تغييرات لم تُحفظ. هل تريد تجاهلها؟")) return; picker.set(b.dataset.id); }));
  };
  const body = $("#body");
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  const picker = sectionPicker($("#pick"), meta, { day: qs.get("d"), section: qs.get("s"), onChange: (v) => {
    if (dirty && !confirm("لديك تغييرات لم تُحفظ. هل تريد تجاهلها؟")) return; if (v.day !== cardsDay) loadCards(v.day); else $$(".at-c").forEach((b) => b.classList.toggle("cur", b.dataset.id === v.section)); load(v); } });
  const counts = () => { const n = { present: 0, absent_excused: 0, absent_unexcused: 0 }; state.students.forEach((s) => n[s.status]++); return n; };
  const paintTally = () => { const n = counts(); $("#tally").innerHTML = `<span>الإجمالي <b class="mono">${state.students.length}</b></span><span class="p">حاضر <b class="mono">${n.present}</b></span><span class="e">غائب بعذر <b class="mono">${n.absent_excused}</b></span><span class="u">غائب بدون عذر <b class="mono">${n.absent_unexcused}</b></span>`;
    $("#dirty").textContent = dirty ? "تغييرات لم تُحفظ" : state.saved ? `حُفظ ${fmtT(state.saved_at)}${state.saved_by ? " · " + state.saved_by : ""}` : "لم يُحفظ تحضير هذا الفصل بعد"; $("#dirty").className = dirty ? "dirty" : "sub"; };
  async function load(v) {
    dirty = false;
    if (!v.section || !v.day) { body.innerHTML = empty("check", "اختر الفصل والتاريخ", ""); return; }
    if ((meta.attendance?.weekend || []).includes(dow(v.day))) { body.innerHTML = empty("calendar", "يوم إجازة أسبوعية", "اختر يوماً دراسياً."); return; }
    history.replaceState(null, "", `?s=${v.section}&d=${v.day}`);
    body.innerHTML = loading("جارٍ جلب طلاب الفصل من النواة الرقمية…");
    try { state = await rpc("ind_roster", { p_section: v.section, p_day: v.day }); } catch (e) { body.innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; return; }
    const ro = !state.can_edit;
    body.innerHTML = `<div class="row2"><div><h3 style="margin:0">${esc(state.section.grade_name)} – ${esc(state.section.name)}</h3><p class="sub" style="margin:2px 0">${esc(fmtDay(state.day))} · ${esc(fmtHijri(state.day))}</p></div>
      <div class="acts">${lockBadge(state.locked)}${state.locked && c.isCoord ? `<a class="btn sm sec" href="locks.html?d=${state.day}">${ico("unlock")}إلغاء التثبيت</a>` : ""}</div></div>
      ${state.locked ? `<p class="note">التحضير مثبت${state.locked_by ? " بواسطة " + esc(state.locked_by) : ""}${state.locked_at ? " · " + esc(fmtT(state.locked_at)) : ""}. يُعرض للقراءة فقط.</p>` : ro ? '<p class="note">عرض للاطلاع فقط.</p>' : ""}
      <div id="tally" class="tally"></div>
      <div class="row2" style="margin-bottom:8px"><input type="search" id="flt" placeholder="بحث سريع باسم الطالب أو رقمه" style="max-width:360px" aria-label="بحث في القائمة">
      ${ro ? "" : '<button class="btn sm sec" id="allp">إعادة الجميع حاضرين</button>'}</div>
      ${state.students.length ? `<ol class="roster" id="rl">${state.students.map((s, i) => `<li data-id="${s.id}" data-st="${s.status}"><span class="n">${i + 1}</span><div><b>${esc(s.name)}</b><small class="mono">${esc(s.no || "")} · ${esc(state.section.grade_name)} – ${esc(state.section.name)}</small></div>
        <div class="seg" role="group" aria-label="حالة ${esc(s.name)}">${["present", "absent_excused", "absent_unexcused"].map((k) => `<button type="button" data-v="${k}" aria-pressed="${s.status === k}" ${ro ? "disabled" : ""}>${STATUS[k]}</button>`).join("")}</div></li>`).join("")}</ol>`
        : empty("users", "لا طلاب مسجلون في هذا الفصل في النواة الرقمية", "تُدار قوائم الطلاب من سجل المتعلمين في النواة.")}
      <div class="savebar"><span id="dirty"></span>${ro ? "" : `<div class="acts"><button class="btn" id="save">${ico("check")}حفظ التحضير</button>${state.saved || state.students.length ? `<button class="btn sec" id="saveLock">${ico("lock")}حفظ وتثبيت</button>` : ""}</div>`}</div>`;
    paintTally();
    const rl = $("#rl");
    if (rl && !ro) rl.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; const li = b.closest("li"), st = state.students.find((x) => x.id === li.dataset.id);
      st.status = b.dataset.v; li.dataset.st = st.status; $$("button", li).forEach((x) => x.setAttribute("aria-pressed", x === b)); dirty = true; paintTally(); });
    $("#flt").oninput = (e) => { const q = e.target.value.trim(); $$("#rl li").forEach((li) => { const s = state.students.find((x) => x.id === li.dataset.id); li.hidden = q && !(s.name.includes(q) || String(s.no || "").includes(q)); }); };
    const ap = $("#allp"); if (ap) ap.onclick = () => { state.students.forEach((s) => (s.status = "present")); $$("#rl li").forEach((li) => { li.dataset.st = "present"; $$("button", li).forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === "present")); }); dirty = true; paintTally(); };
    const doSave = async (andLock) => {
      const btns = $$(".savebar button"); btns.forEach((b) => (b.disabled = true));
      try {
        const abs = state.students.filter((s) => s.status !== "present").map((s) => ({ student_id: s.id, status: s.status }));
        if (andLock) { const ok = await confirmBox("حفظ التحضير وتثبيته", `سيُحفظ التحضير (${abs.length} غائب) ويُثبَّت، ولن تتمكن من تعديله بعد التثبيت إلا عبر منسق الغياب.`, { okText: "حفظ وتثبيت" }); if (!ok) return; }
        const r = await rpc("ind_save_attendance", { p_section: state.section.id, p_day: state.day, p_absences: abs, p_reason: null });
        dirty = false;
        if (andLock) { const l = await rpc("ind_lock", { p_day: state.day, p_scope: "list", p_sections: [state.section.id] }); toast(l.locked.length ? "حُفظ التحضير وثُبّت" : "حُفظ التحضير"); }
        else toast(`حُفظ التحضير · ${r.absent} غائب`);
        await load({ section: state.section.id, day: state.day }); loadCards(state.day);
      } catch (e) { toast(mapErr(e), true); } finally { btns.forEach((b) => (b.disabled = false)); }
    };
    const sv = $("#save"); if (sv) sv.onclick = () => doSave(false);
    const sl = $("#saveLock"); if (sl) sl.onclick = () => doSave(true);
  }
  picker.fire();
}, { role: "absence" });

// ============================== التثبيت ==============================
PAGES.locks = () => boot("locks.html", async (main, c) => {
  const meta = await rpc("ind_meta", { p_task: c.oversee ? "view" : "absence" });
  const qs = new URLSearchParams(location.search);
  const canLock = c.isCoord || c.absence;
  main.innerHTML = `<div class="card"><div class="pickbar"><div><label for="ld">التاريخ</label><input type="date" id="ld" max="${meta.today}" value="${esc(qs.get("d") || lastSchoolDay(meta))}"><div class="dayhint" id="ldh"></div></div>
    <div><label for="lg">الصف</label><select id="lg"><option value="">جميع الصفوف</option>${meta.grades.map((g) => `<option value="${g.code}">${esc(g.name)}</option>`).join("")}</select></div></div>
    <div class="acts" id="la"></div></div><div id="lb" class="mt"></div>`;
  const D = $("#ld"), G = $("#lg");
  const load = async () => {
    $("#ldh").textContent = fmtHijri(D.value); history.replaceState(null, "", "?d=" + D.value);
    $("#lb").innerHTML = loading();
    let rows; try { rows = await rpc("ind_day_status", { p_day: D.value, p_grade: G.value || null }); } catch (e) { $("#lb").innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; return; }
    const pickable = (s) => (c.isCoord || s.mine);
    $("#la").innerHTML = canLock ? `<button class="btn sm" id="lSel" disabled>${ico("lock")}تثبيت المحدد</button>${c.isCoord ? `<button class="btn sm sec" id="lAll">${ico("lock")}تثبيت جميع الفصول${G.value ? " (الصف)" : ""}</button><button class="btn sm sec" id="uSel" disabled>${ico("unlock")}إلغاء تثبيت المحدد</button><button class="btn sm sec" id="uAll">${ico("unlock")}إلغاء تثبيت الجميع${G.value ? " (الصف)" : ""}</button><a class="btn sm" href="messages.html?d=${D.value}">${ico("send")}رسائل الغياب لهذا اليوم</a>` : ""}<span class="sub" id="nsel"></span>` : "";
    const stt = (r) => (r.locked ? "locked" : r.saved ? "saved" : "none");
    const cnt = (k) => rows.filter((r) => stt(r) === k).length;
    const STB = { locked: ["lock", "مثبت"], none: ["x", "لم يتم التحضير"], saved: ["check", "تم التحضير ولم يُثبَّت"] };
    $("#lb").innerHTML = rows.length ? `<div class="row2" style="margin-bottom:10px"><div class="lgd" role="group" aria-label="تصفية الفصول حسب الحالة">${[["locked", "مثبت"], ["none", "لم يتم التحضير"], ["saved", "تم التحضير ولم يُثبَّت"]].map(([k, t]) => `<button type="button" class="lg lg-${k}" data-f="${k}" aria-pressed="false"><i></i>${t}<b>${cnt(k)}</b></button>`).join("")}</div>${canLock ? '<label class="chk"><input type="checkbox" id="ckAll">تحديد الكل</label>' : ""}</div>
      <div class="secgrid">${rows.map((s) => { const k = stt(s); return `<div class="sec-c ${k} ${s.saved ? "" : "unsaved"}" data-st="${k}"><div class="row2"><b>${esc(s.label)}</b><span class="stb">${ico(STB[k][0])}${STB[k][1]}</span></div>
        <div class="meta">${s.saved ? `حُفظ ${esc(fmtT(s.saved_at))}` : "لم يُحفظ التحضير"}${s.locked_at ? ` · ثُبّت ${esc(fmtT(s.locked_at))}` : ""}</div>
        <div class="meta">${s.students} طالب · بعذر ${s.excused} · بدون عذر ${s.unexcused}</div>
        <div class="row2">${canLock && pickable(s) ? `<label class="chk"><input type="checkbox" data-s="${s.id}" data-l="${s.locked ? 1 : 0}">تحديد</label>` : "<span></span>"}<a class="btn sm sec" href="attendance.html?s=${s.id}&d=${D.value}">فتح</a></div></div>`; }).join("")}</div>`
      : empty("lock", "لا فصول ضمن نطاقك", "");
    const sel = () => $$("[data-s]:checked").map((x) => x.dataset.s);
    const upd = () => { const n = sel().length; if ($("#nsel")) $("#nsel").textContent = n ? `${n} محدد` : ""; if ($("#lSel")) $("#lSel").disabled = !n; if ($("#uSel")) $("#uSel").disabled = !n; };
    $$("[data-s]").forEach((x) => (x.onchange = upd));
    const ca = $("#ckAll"); if (ca) ca.onchange = () => { $$(".sec-c:not([hidden]) [data-s]").forEach((x) => (x.checked = ca.checked)); upd(); };
    const fl = new Set(); $$(".lg").forEach((b) => (b.onclick = () => { const k = b.dataset.f; fl.has(k) ? fl.delete(k) : fl.add(k); b.setAttribute("aria-pressed", fl.has(k)); $$(".sec-c").forEach((x) => (x.hidden = fl.size > 0 && !fl.has(x.dataset.st))); }));
    const label = (ids) => rows.filter((r) => ids.includes(r.id)).map((r) => r.label);
    const report = (r) => { const m = []; if (r.locked?.length) m.push(`ثُبّت ${r.locked.length}`); if (r.already?.length) m.push(`${r.already.length} مثبت مسبقاً`); if (r.skipped_unsaved?.length) m.push(`تُخطي ${r.skipped_unsaved.length} لم يُحفظ تحضيره`); if (r.unlocked) m.push(`أُلغي تثبيت ${r.unlocked.length}`); toast(m.join(" · ") || "لا تغيير"); };
    const lock = async (scope, ids) => {
      const unsaved = rows.filter((r) => !r.saved && !r.locked && (scope !== "list" || ids.includes(r.id)));
      let include = false;
      if (unsaved.length && c.isCoord) {
        const ok = await confirmBox("فصول لم يُحفظ تحضيرها", `هذه الفصول لم يُحفظ لها تحضير: <b>${esc(unsaved.map((r) => r.label).join("، "))}</b>.<br>تثبيتها يعني اعتماد جميع طلابها حاضرين. هل تريد تثبيتها أيضاً؟ (اختر «رجوع» لتثبيت المحفوظ فقط)`, { okText: "نعم، ثبّتها حاضرين" });
        include = !!ok;
      } else {
        const ok = await confirmBox(scope === "list" ? "تثبيت الفصول المحددة" : "تثبيت جميع الفصول", `${scope === "list" ? esc(label(ids).join("، ")) : G.value ? "جميع فصول الصف المختار" : "جميع فصول المدرسة"} بتاريخ ${esc(fmtBoth(D.value))}.${unsaved.length ? "<br>الفصول التي لم يُحفظ تحضيرها ستُتخطى." : ""}`, { okText: "تثبيت" });
        if (!ok) return;
      }
      try { report(await rpc("ind_lock", { p_day: D.value, p_scope: scope, p_sections: scope === "list" ? ids : null, p_grade: G.value || null, p_include_unsaved: include })); await load(); } catch (e) { toast(mapErr(e), true); }
    };
    const unlock = async (scope, ids) => {
      const ok = await confirmBox("إلغاء التثبيت", `${scope === "list" ? esc(label(ids).join("، ")) : G.value ? "جميع فصول الصف المختار" : "جميع الفصول المثبتة"} بتاريخ ${esc(fmtBoth(D.value))}. سيُعاد فتح السجل للتعديل ثم يلزم إعادة تثبيته.`, { okText: "إلغاء التثبيت", danger: true, reason: { label: "سبب الإجراء", required: true } });
      if (!ok) return;
      try { report(await rpc("ind_unlock", { p_day: D.value, p_reason: ok.reason, p_scope: scope, p_sections: scope === "list" ? ids : null, p_grade: G.value || null })); await load(); } catch (e) { toast(mapErr(e), true); }
    };
    if ($("#lSel")) $("#lSel").onclick = () => lock("list", sel());
    if ($("#lAll")) $("#lAll").onclick = () => lock(G.value ? "grade" : "all");
    if ($("#uSel")) $("#uSel").onclick = () => unlock("list", sel());
    if ($("#uAll")) $("#uAll").onclick = () => unlock(G.value ? "grade" : "all");
  };
  D.onchange = load; G.onchange = load; load();
}, { role: "absence" });

// ============================== التأخر ==============================
PAGES.lateness = () => boot("lateness.html", async (main, c) => {
  const meta = await rpc("ind_meta", { p_task: c.lateness ? "lateness" : "view" });
  const canRec = c.lateness && meta.sections.length;
  const L = meta.lateness;
  main.innerHTML = `${canRec ? `<div class="card"><h3 class="sec" style="margin-top:0">تسجيل حالة تأخر</h3>
      <p class="sub">بداية الدوام ${esc(fmtHM(L.day_start))} · يبدأ احتساب التأخر بعد ${esc(fmtHM(L.late_after))}${+L.grace_minutes ? ` + ${L.grace_minutes} دقيقة سماح` : ""}</p>
      <div class="subnav" style="margin-bottom:10px"><a href="#" data-m="search" class="on">${ico("search")}البحث المباشر</a><a href="#" data-m="class">${ico("users")}اختيار من الفصل</a></div>
      <div id="mSearch"></div><div id="mClass" hidden></div>
      <div id="frm" class="mt"></div></div>` : ""}
    <div class="card mt"><div class="row2"><h3 class="sec" style="margin:0">سجل التأخر</h3><div class="acts"><input type="date" id="vd" max="${meta.today}" value="${lastSchoolDay(meta)}" aria-label="تاريخ السجل"><button class="btn sm sec" id="xp">${ico("file")}تصدير</button></div></div><div id="vl" class="mt"></div></div>`;
  let list = [];
  const loadList = async () => { $("#vl").innerHTML = loading(); try { list = await rpc("ind_lateness_list", { p_day: $("#vd").value }); } catch (e) { $("#vl").innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; return; }
    $("#vl").innerHTML = list.length ? `<div class="tw"><table class="tbl"><thead><tr><th>الطالب</th><th>الفصل</th><th>الوصول</th><th>الدقائق</th><th>السبب</th><th>المدخل</th>${c.isCoord ? "<th></th>" : ""}</tr></thead><tbody>${list.map((l) => `<tr ${l.voided ? 'style="opacity:.55;text-decoration:line-through"' : ""}><td><b>${esc(l.name)}</b><br><small class="mono">${esc(l.no || "")}</small></td><td>${esc(l.grade_name)} – ${esc(l.section)}</td><td class="mono">${esc(fmtHM(l.arrival))}</td><td class="mono">${l.minutes}</td><td>${esc(l.reason)}${l.reason_text ? `<br><small>${esc(l.reason_text)}</small>` : ""}</td><td><small>${esc(l.by || "")}<br>${esc(fmtT(l.created_at))}</small></td>${c.isCoord ? `<td>${l.voided ? `<small title="${esc(l.void_reason || "")}">ملغى</small>` : `<button class="btn sm sec" data-void="${l.id}">إلغاء</button>`}</td>` : ""}</tr>`).join("")}</tbody></table></div>`
      : empty("clock", "لا حالات تأخر مسجلة في هذا اليوم", "");
    $$("[data-void]").forEach((b) => (b.onclick = async () => { const ok = await confirmBox("إلغاء سجل التأخر", "يبقى السجل محفوظاً بعلامة «ملغى» في سجل العمليات.", { okText: "إلغاء السجل", danger: true, reason: { label: "سبب الإلغاء", required: true } }); if (!ok) return;
      try { await rpc("ind_void_lateness", { p_id: b.dataset.void, p_reason: ok.reason }); toast("أُلغي السجل"); loadList(); } catch (e) { toast(mapErr(e), true); } }));
  };
  $("#vd").onchange = loadList;
  $("#xp").onclick = () => exportCSV("التأخر-" + $("#vd").value, ["الطالب", "الرقم", "الصف", "الفصل", "التاريخ", "وقت الوصول", "دقائق التأخر", "السبب", "تفاصيل", "المدخل", "وقت التسجيل", "الحالة"],
    list.map((l) => [l.name, l.no, l.grade_name, l.section, $("#vd").value, l.arrival, l.minutes, l.reason, l.reason_text, l.by, fmtT(l.created_at), l.voided ? "ملغى" : "قائم"]));
  if (canRec) {
    const form = (st) => {
      const reqId = uuid();
      $("#frm").innerHTML = `<div class="item"><div class="row2"><div><b>${esc(st.name)}</b><br><small>${esc(st.grade_name)} – ${esc(st.section)} · ${esc(st.no || "")}</small></div><button class="btn sm sec" id="fx">تغيير الطالب</button></div>
        <div class="fg mt"><div><label for="fd">التاريخ</label><input type="date" id="fd" max="${meta.today}" value="${lastSchoolDay(meta)}"></div>
        <div><label for="ft">وقت وصول الطالب *</label><input type="time" id="ft" value="${nowHM()}" required><div class="dayhint" id="fm"></div></div>
        <div><label for="fr">سبب التأخر *</label><select id="fr"><option value="">اختر السبب</option>${meta.reasons.map((r) => `<option value="${r.id}" data-o="${r.is_other ? 1 : 0}">${esc(r.name)}</option>`).join("")}</select></div>
        <div id="fow" hidden><label for="fo">السبب الذي ذكره الطالب *</label><input id="fo" maxlength="300"></div></div>
        <p class="err" id="fe" role="alert"></p><div class="acts"><button class="btn" id="fs">${ico("check")}حفظ سجل التأخر</button></div></div>`;
      const mins = () => { const [h, m] = ($("#ft").value || "0:0").split(":").map(Number), [th, tm] = L.late_after.split(":").map(Number), [bh, bm] = L.day_start.split(":").map(Number);
        const a = h * 60 + m, thr = th * 60 + tm + (+L.grace_minutes || 0), base = L.calc_mode === "from_start" ? bh * 60 + bm : thr; return a <= thr ? 0 : a - base; };
      const showM = () => { const n = mins(); $("#fm").textContent = n ? `مدة التأخر: ${n} دقيقة` : "قبل بداية احتساب التأخر"; };
      $("#ft").oninput = showM; showM();
      $("#fr").onchange = () => { const o = $("#fr").selectedOptions[0]?.dataset.o === "1"; $("#fow").hidden = !o; if (o) $("#fo").focus(); };
      $("#fx").onclick = () => { $("#frm").innerHTML = ""; };
      $("#fs").onclick = async () => {
        const o = $("#fr").selectedOptions[0]?.dataset.o === "1", e = $("#fe"); e.textContent = "";
        if (!$("#ft").value) return (e.textContent = ERR.arrival_required); if (!$("#fr").value) return (e.textContent = ERR.reason_required);
        if (o && !$("#fo").value.trim()) return (e.textContent = ERR.other_reason_required);
        $("#fs").disabled = true;
        const day = $("#fd").value;
        try { const r = await rpc("ind_record_lateness", { p_student: st.id, p_day: day, p_arrival: $("#ft").value, p_reason: $("#fr").value, p_reason_text: o ? $("#fo").value.trim() : null, p_request_id: reqId });
          toast(`سُجّل تأخر ${st.name} · ${r.minutes} دقيقة`); $("#frm").innerHTML = ""; if ($("#vd").value === day) loadList(); }
        catch (err) { e.textContent = mapErr(err); const b = $("#fs"); if (b) b.disabled = false; }
      };
      $("#ft").focus();
    };
    const si = studentSearch($("#mSearch"), "lateness", form);
    let rosterSec = null;
    sectionPicker($("#mClass"), meta, { withDay: false, onChange: async (v) => {
      rosterSec = v.section; const box = $("#mClassList") || $("#mClass").appendChild(Object.assign(document.createElement("div"), { id: "mClassList" }));
      if (!v.section) { box.innerHTML = ""; return; } box.innerHTML = loading();
      const sec = meta.sections.find((x) => x.id === v.section);
      try { const all = await rpc("ind_section_lateness_roster", { p_section: v.section });
        if (rosterSec !== v.section) return;
        box.innerHTML = all.length ? `<div class="pill-l">${all.map((s, i) => `<button type="button" class="btn sm sec" data-i="${i}">${esc(s.name)}</button>`).join("")}</div>` : empty("users", "لا طلاب في الفصل", "");
        $$("[data-i]", box).forEach((b) => (b.onclick = () => form({ ...all[+b.dataset.i], grade_name: meta.grades.find((g) => g.code === sec.grade)?.name || "", section: sec.name })));
      } catch (e) { box.innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; }
    } });
    $$("[data-m]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const m = a.dataset.m; $$("[data-m]").forEach((x) => x.classList.toggle("on", x === a)); $("#mSearch").hidden = m !== "search"; $("#mClass").hidden = m !== "class"; if (m === "search") si.focus(); }));
  }
  loadList();
}, { role: "lateness" });

// ============================== إدارة التكليفات ==============================
PAGES.assignments = () => boot("assignments.html", async (main) => {
  const meta = await rpc("ind_meta", { p_task: "view" });
  let staff = [], rows = [];
  const draw = async () => {
    [staff, rows] = await Promise.all([rpc("ind_staff_list"), rpc("ind_assignments_list")]);
    const act = rows.filter((r) => r.status === "active");
    const cover = (task) => { const s = new Set(act.filter((r) => r.task === task).flatMap((r) => r.sections.map((x) => x.id))); return meta.sections.filter((x) => !s.has(x.id)); };
    main.innerHTML = `<div class="row2"><p class="sub" style="margin:0">مهمة الغياب مستقلة عن مهمة التأخر، ويرى كل مدخل فصوله فقط.</p><button class="btn" id="add">${ico("plus")}إضافة تكليف</button></div>
      <div class="grid mt">${["absence", "lateness"].map((t) => { const u = cover(t); return `<div class="card"><b>${ico(t === "absence" ? "check" : "clock")} ${TASK[t]}</b><p class="sub" style="margin:4px 0">${act.filter((r) => r.task === t).length} مكلف · ${u.length ? `${u.length} فصل بلا مكلف` : "جميع الفصول مغطاة"}</p>${u.length ? `<div class="pill-l">${u.map((x) => `<span>${esc(x.label)}</span>`).join("")}</div>` : ""}</div>`; }).join("")}</div>
      ${rows.length ? `<div class="tw mt"><table class="tbl"><thead><tr><th>المستخدم</th><th>المهمة</th><th>الفصول المسندة</th><th>بداية التكليف</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${esc(r.staff)}</b>${r.has_account ? "" : '<br><span class="badge warn">بلا حساب دخول في النواة</span>'}</td><td>${TASK[r.task]}</td><td><div class="pill-l">${r.sections.map((s) => `<span>${esc(s.label)}</span>`).join("")}</div></td><td>${esc(fmtBoth(r.starts_on))}</td><td>${r.status === "active" ? '<span class="badge ok">فعّال</span>' : '<span class="badge">موقوف</span>'}</td>
        <td><div class="acts">${r.status === "active" ? `<button class="btn sm sec" data-e="${r.id}">تعديل</button><button class="btn sm sec" data-st="${r.id}" data-v="stopped">إيقاف</button>` : `<button class="btn sm sec" data-st="${r.id}" data-v="active">إعادة تفعيل</button>`}</div></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="mt">${empty("users", "لا تكليفات بعد", "أضف تكليفاً لكل مدخل بيانات وحدد فصوله ومهمته.")}</div>`}`;
    $("#add").onclick = () => edit(null);
    $$("[data-e]").forEach((b) => (b.onclick = () => edit(rows.find((r) => r.id === b.dataset.e))));
    $$("[data-st]").forEach((b) => (b.onclick = async () => { const stop = b.dataset.v === "stopped";
      if (stop && !(await confirmBox("إيقاف التكليف", "لن يتمكن المستخدم من التسجيل في هذه الفصول بعد الإيقاف.", { okText: "إيقاف", danger: true }))) return;
      try { await rpc("ind_assignment_status", { p_id: b.dataset.st, p_status: b.dataset.v }); toast(stop ? "أُوقف التكليف" : "أُعيد تفعيل التكليف"); draw(); } catch (e) { toast(mapErr(e), true); } }));
  };
  const edit = (r) => {
    const md = modal(`<h3>${r ? "تعديل تكليف" : "إضافة تكليف"}</h3>
      <label for="as">المستخدم</label><select id="as" ${r ? "disabled" : ""}><option value="">اختر المنسوب</option>${staff.map((s) => `<option value="${s.id}" ${r?.staff_id === s.id ? "selected" : ""}>${esc(s.name)}${s.has_account ? "" : " (بلا حساب دخول)"}</option>`).join("")}</select>
      <label for="at">المهمة</label><select id="at" ${r ? "disabled" : ""}>${Object.entries(TASK).map(([k, v]) => `<option value="${k}" ${r?.task === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label for="ad">تاريخ بداية التكليف</label><input type="date" id="ad" value="${esc(r?.starts_on || meta.today)}">
      <label>الفصول المسندة</label><div class="card" style="max-height:260px;overflow:auto;padding:10px">${meta.grades.map((g) => { const ss = meta.sections.filter((x) => x.grade === g.code); return ss.length ? `<div><b class="sub">${esc(g.name)}</b><br>${ss.map((x) => `<label class="chk"><input type="checkbox" value="${x.id}" ${r?.sections.some((y) => y.id === x.id) ? "checked" : ""}>${esc(x.name)}</label>`).join("")}</div>` : ""; }).join("")}</div>
      <label for="an">ملاحظة (اختياري)</label><input id="an" maxlength="200" value="${esc(r?.note || "")}">
      <p class="err" id="ae" role="alert"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`, true);
    $("#no", md.el).onclick = md.close;
    const save = async (shared) => {
      const secs = $$("input[type=checkbox]:checked", md.el).map((x) => x.value), e = $("#ae", md.el);
      if (!$("#as", md.el).value) return (e.textContent = "اختر المنسوب."); if (!secs.length) return (e.textContent = ERR.sections_required);
      try { const res = await rpc("ind_assignment_save", { p_id: r?.id || null, p_staff: $("#as", md.el).value, p_task: $("#at", md.el).value, p_sections: secs, p_starts: $("#ad", md.el).value, p_note: $("#an", md.el).value, p_allow_shared: shared });
        if (res.ok === false && res.conflicts) {
          const ok = await confirmBox("فصول مسندة لآخرين", `هذه الفصول مسندة لمنسوب آخر في المهمة نفسها:<br>${res.conflicts.map((x) => `• ${esc(x.section)} ← ${esc(x.staff)}`).join("<br>")}<br>هل الإسناد المشترك مقصود؟`, { okText: "نعم، إسناد مشترك" });
          if (ok) return save(true); return;
        }
        md.close(); toast("حُفظ التكليف"); draw();
      } catch (err) { e.textContent = mapErr(err); }
    };
    $("#ok", md.el).onclick = () => save(false);
  };
  await draw();
}, { role: "coord" });

// ============================== الإعدادات ==============================
PAGES.settings = () => boot("settings.html", async (main, c) => {
  const list = [];
  if (c.isCoord) list.push(["late", "إعدادات التأخر", "clock"], ["reasons", "أسباب التأخر", "list"], ["att", "إعدادات التحضير", "check"], ["exc", "الأعذار", "file"], ["rewards", "نقاط الانتظام", "star"]);
  if (c.isPortal || c.isAdmin) list.push(["roles", "الأدوار", "users"]);
  if (!list.length) { main.innerHTML = empty("gear", "لا إعدادات متاحة لدورك", ""); return; }
  tabs(main, list, async (k, body) => {
    const meta = await rpc("ind_meta", { p_task: "view" });
    if (k === "late") {
      const L = meta.lateness;
      body.innerHTML = `<div class="card"><div class="fg"><div><label for="s1">بداية الدوام الرسمي</label><input type="time" id="s1" value="${esc(L.day_start)}"></div>
        <div><label for="s2">يبدأ احتساب التأخر بعد</label><input type="time" id="s2" value="${esc(L.late_after)}"></div>
        <div><label for="s3">دقائق السماح الإضافية</label><input type="number" id="s3" min="0" max="120" value="${+L.grace_minutes || 0}"></div>
        <div><label for="s4">آلية احتساب الدقائق</label><select id="s4"><option value="from_threshold" ${L.calc_mode !== "from_start" ? "selected" : ""}>من وقت بداية احتساب التأخر</option><option value="from_start" ${L.calc_mode === "from_start" ? "selected" : ""}>من بداية الدوام</option></select></div></div>
        <label class="chk mt"><input type="checkbox" id="s5" ${L.notify_enabled ? "checked" : ""}>تفعيل إشعارات التأخر لأولياء الأمور (تعمل بعد ربط واتساب)</label>
        <p class="sub" id="ex"></p><div class="acts"><button class="btn" id="sv">حفظ</button></div></div>`;
      const ex = () => { const [a, b] = $("#s2").value.split(":").map(Number), g = +$("#s3").value || 0, arr = a * 60 + b + g + 8, [s1h, s1m] = $("#s1").value.split(":").map(Number);
        const n = $("#s4").value === "from_start" ? arr - (s1h * 60 + s1m) : 8; $("#ex").textContent = `مثال: طالب وصل ${fmtHM(`${Math.floor(arr / 60)}:${arr % 60}`)} يُحتسب تأخره ${n} دقيقة.`; };
      $$("input,select", body).forEach((x) => (x.oninput = ex)); ex();
      $("#sv").onclick = async () => { try { await rpc("ind_set_lateness_settings", { p: { day_start: $("#s1").value, late_after: $("#s2").value, grace_minutes: +$("#s3").value, calc_mode: $("#s4").value, notify_enabled: $("#s5").checked } }); toast("حُفظت الإعدادات وسُجّل التغيير"); } catch (e) { toast(mapErr(e), true); } };
    }
    if (k === "reasons") {
      const R = await rpc("ind_reasons_all");
      body.innerHTML = `<div class="card"><div class="row2"><p class="sub" style="margin:0">«سبب آخر» يُلزم مدخل البيانات بكتابة السبب. السبب المستخدم لا يُحذف بل يُعطّل.</p><button class="btn sm" id="na">${ico("plus")}إضافة سبب</button></div>
        <div class="tw mt"><table class="tbl"><thead><tr><th>السبب</th><th>الترتيب</th><th>الاستخدام</th><th>الحالة</th><th></th></tr></thead><tbody>${R.map((r) => `<tr><td>${esc(r.name)}${r.is_other ? ' <span class="badge info">نص إلزامي</span>' : ""}</td><td class="mono">${r.sort_order}</td><td class="mono">${r.uses}</td><td>${r.is_active ? '<span class="badge ok">مفعّل</span>' : '<span class="badge">معطّل</span>'}</td><td><div class="acts"><button class="btn sm sec" data-ed="${r.id}">تعديل</button><button class="btn sm sec" data-tg="${r.id}">${r.is_active ? "تعطيل" : "تفعيل"}</button></div></td></tr>`).join("")}</tbody></table></div></div>`;
      const ed = (r) => { const md = modal(`<h3>${r ? "تعديل سبب" : "إضافة سبب"}</h3><label for="rn">الاسم</label><input id="rn" maxlength="80" value="${esc(r?.name || "")}"><label for="ro">الترتيب</label><input id="ro" type="number" value="${r?.sort_order ?? 50}"><p class="err" id="re"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`);
        $("#no", md.el).onclick = md.close; $("#ok", md.el).onclick = async () => { try { await rpc("ind_reason_save", { p_id: r?.id || null, p_name: $("#rn", md.el).value, p_active: r ? r.is_active : true, p_sort: +$("#ro", md.el).value }); md.close(); toast("حُفظ"); $$("[data-t=reasons]")[0].click(); } catch (e) { $("#re", md.el).textContent = mapErr(e); } }; };
      $("#na").onclick = () => ed(null);
      $$("[data-ed]").forEach((b) => (b.onclick = () => ed(R.find((r) => r.id === b.dataset.ed))));
      $$("[data-tg]").forEach((b) => (b.onclick = async () => { const r = R.find((x) => x.id === b.dataset.tg); try { await rpc("ind_reason_save", { p_id: r.id, p_name: r.name, p_active: !r.is_active, p_sort: r.sort_order }); $$("[data-t=reasons]")[0].click(); } catch (e) { toast(mapErr(e), true); } }));
    }
    if (k === "att") {
      const A = meta.attendance, days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      body.innerHTML = `<div class="card"><label for="bd">أقصى عدد أيام للتسجيل بأثر رجعي (لمدخلي البيانات)</label><input type="number" id="bd" min="0" max="365" value="${+A.max_backdate_days}" style="max-width:160px">
        <p class="sub">المنسق غير مقيد بهذه المدة. لا يُسمح أبداً بالتسجيل في فصل مثبت أو بتاريخ مستقبلي.</p>
        <label>أيام الإجازة الأسبوعية</label><div>${days.map((d, i) => `<label class="chk"><input type="checkbox" value="${i}" ${A.weekend.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div>
        <div class="acts mt"><button class="btn" id="sv">حفظ</button></div></div>`;
      $("#sv").onclick = async () => { try { await rpc("ind_set_attendance_settings", { p: { max_backdate_days: +$("#bd").value, weekend: $$("input[type=checkbox]:checked", body).map((x) => +x.value) } }); toast("حُفظت الإعدادات"); } catch (e) { toast(mapErr(e), true); } };
    }
    if (k === "exc") {
      const E = (await rpc("ind_settings_get")).excuses;
      body.innerHTML = `<div class="card"><label class="chk"><input type="checkbox" id="e1" ${E.attachment_required ? "checked" : ""}>إرفاق ملف العذر إلزامي</label>
        <div class="fg"><div><label for="e2">مهلة تقديم العذر بعد يوم الغياب (يوماً)</label><input type="number" id="e2" min="1" max="120" value="${+E.max_days_after}"></div>
        <div><label for="e3">صلاحية رابط ولي الأمر (يوماً)</label><input type="number" id="e3" min="1" max="120" value="${+E.link_valid_days}"></div></div>
        <div class="acts mt"><button class="btn" id="sv">حفظ</button></div></div>`;
      $("#sv").onclick = async () => { try { await rpc("ind_set_excuse_settings", { p: { attachment_required: $("#e1").checked, max_days_after: +$("#e2").value, link_valid_days: +$("#e3").value } }); toast("حُفظت الإعدادات"); } catch (e) { toast(mapErr(e), true); } };
    }
    if (k === "rewards") {
      const o = await rpc("ind_rewards_overview", { p_limit: 20 }), R = o.settings;
      body.innerHTML = `<div class="card"><p class="sub">يستحق الطالب نقاطاً عند إكمال أسبوع دراسي كامل دون غياب، وتُسجَّل في دفتر نقاط «قيمي» (رعاية المتعلمين) بمعرّفه المركزي، ولا تُكرر للأسبوع نفسه. يُحتسب الأسبوع بعد تثبيت جميع أيامه لكل الفصول، ويُعكس الاستحقاق بقيد موثق إذا سُجّل غياب لاحق.</p>
        ${o.qiyami ? "" : '<p class="note">نظام «قيمي» غير مثبت في القاعدة؛ تُحفظ الاستحقاقات معلقة.</p>'}
        <label class="chk"><input type="checkbox" id="r1" ${R.enabled ? "checked" : ""}>تفعيل الاحتساب التلقائي</label>
        <div class="fg"><div><label for="r2">النقاط لكل أسبوع</label><input type="number" id="r2" min="1" max="50" value="${+R.points || 5}"></div></div>
        <label class="chk"><input type="checkbox" id="r3" ${R.lateness_blocks ? "checked" : ""}>التأخر يمنع الاستحقاق</label>
        <div class="acts mt"><button class="btn" id="sv">حفظ</button></div></div>
        <div class="card mt"><h3 class="sec" style="margin-top:0">الأسابيع</h3>${o.weeks.length ? `<div class="tw"><table class="tbl"><thead><tr><th>الأسبوع</th><th>أيام الدراسة</th><th>الحالة</th><th>مُنحت</th><th>معلقة</th><th>أُلغيت</th><th></th></tr></thead><tbody>${o.weeks.map((w) => `<tr><td>${esc(fmtBoth(w.week_start))}</td><td class="mono">${w.days}</td><td>${w.final ? '<span class="badge ok">مكتمل</span>' : '<span class="badge warn">غير مكتمل التثبيت</span>'}</td><td class="mono">${w.awarded}</td><td class="mono">${w.pending}</td><td class="mono">${w.reversed}</td><td>${w.final && R.enabled ? `<button class="btn sm sec" data-w="${w.week_start}">احتساب</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : '<p class="sub">لا أسابيع بعد.</p>'}</div>`;
      $("#sv").onclick = async () => { if ($("#r1").checked && !R.enabled && !(await confirmBox("تفعيل نقاط الانتظام", "ستُضاف النقاط إلى أرصدة الطلاب في «قيمي» وتظهر في لوحاته.", { okText: "تفعيل" }))) return;
        try { await rpc("ind_set_reward_settings", { p: { enabled: $("#r1").checked, points: +$("#r2").value, lateness_blocks: $("#r3").checked } }); toast("حُفظت الإعدادات"); $$("[data-t=rewards]")[0].click(); } catch (e) { toast(mapErr(e), true); } };
      $$("[data-w]").forEach((b) => (b.onclick = async () => { try { const r = await rpc("ind_rewards_run", { p_day: b.dataset.w }); toast(r.skipped ? "الأسبوع غير مكتمل أو الاحتساب معطّل" : `مُنح ${r.awarded} طالباً`); $$("[data-t=rewards]")[0].click(); } catch (e) { toast(mapErr(e), true); } }));
    }
    if (k === "roles") {
      const S = await rpc("ind_staff_list");
      const roles = c.isAdmin ? ["coordinator", "affairs", "portal_admin"] : ["coordinator", "affairs"];
      body.innerHTML = `<div class="card"><p class="sub">الحسابات من النواة الرقمية. مدخلو البيانات لا يحتاجون دوراً هنا: صلاحيتهم من «إدارة التكليفات». مدير النواة يملك صلاحيات المنسق تلقائياً.</p>
        <input type="search" id="rq" placeholder="بحث بالاسم" style="max-width:320px"><div class="tw mt"><table class="tbl"><thead><tr><th>المنسوب</th>${roles.map((r) => `<th>${ROLE[r]}</th>`).join("")}</tr></thead><tbody>
        ${S.map((s) => `<tr data-n="${esc(s.name)}"><td><b>${esc(s.name)}</b><br><small>${esc(s.job_title || "")}${s.has_account ? "" : " · بلا حساب دخول"}</small></td>${roles.map((r) => `<td><input type="checkbox" aria-label="${ROLE[r]} – ${esc(s.name)}" data-sid="${s.id}" data-r="${r}" ${s.roles.includes(r) ? "checked" : ""}></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
      $("#rq").oninput = (e) => $$("tr[data-n]", body).forEach((tr) => (tr.hidden = !tr.dataset.n.includes(e.target.value.trim())));
      $$("[data-r]", body).forEach((x) => (x.onchange = async () => { try { await rpc("ind_set_role", { p_staff: x.dataset.sid, p_role: x.dataset.r, p_on: x.checked }); toast(x.checked ? "مُنح الدور" : "سُحب الدور"); } catch (e) { x.checked = !x.checked; toast(mapErr(e), true); } }));
    }
  });
}, { role: "admin" });

// ============================== سجل العمليات ==============================
const ACT = { attendance_recorded: "تسجيل غياب", attendance_saved: "حفظ تحضير (الجميع حاضر)", attendance_modified: "تعديل غياب", lock: "تثبيت", relock: "إعادة تثبيت", unlock: "إلغاء تثبيت",
  lateness_recorded: "تسجيل تأخر", lateness_voided: "إلغاء تأخر", lateness_settings_changed: "تعديل إعدادات التأخر", attendance_settings_changed: "تعديل إعدادات التحضير",
  reason_added: "إضافة سبب تأخر", reason_changed: "تعديل سبب تأخر", assignment_created: "إضافة تكليف", assignment_changed: "تعديل تكليف", assignment_stopped: "إيقاف تكليف", assignment_resumed: "إعادة تكليف",
  role_granted: "منح دور", role_revoked: "سحب دور", access_denied: "محاولة وصول غير مصرح" };
PAGES.audit = () => boot("audit.html", async (main) => {
  main.innerHTML = `<div class="card"><div class="row2"><select id="af" style="max-width:260px"><option value="">كل العمليات</option><option value="attendance">التحضير</option><option value="attendance_lock">التثبيت</option><option value="lateness">التأخر</option><option value="settings">الإعدادات</option><option value="lateness_reason">أسباب التأخر</option><option value="assignment">التكليفات</option><option value="role">الأدوار</option></select><span class="sub">السجل للقراءة فقط ولا يقبل التعديل أو الحذف.</span></div><div id="al" class="mt"></div><div class="acts mt"><button class="btn sec" id="more" hidden>عرض المزيد</button></div></div>`;
  let rows = [];
  const diff = (a) => { const o = a.old, n = a.new; if (!o && !n) return ""; const s = (v) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
    if (o && n && typeof o === "object" && !Array.isArray(o)) return Object.keys({ ...o, ...n }).filter((k) => s(o[k]) !== s(n[k])).map((k) => `${k}: ${s(o[k])} ← ${s(n[k])}`).join("\n");
    return (o ? "قبل: " + s(o) + "\n" : "") + (n ? "بعد: " + s(n) : ""); };
  const paint = () => { $("#al").innerHTML = rows.length ? `<div class="tw"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التغييرات</th><th>السبب</th></tr></thead><tbody>${rows.map((a) => `<tr><td><small>${esc(fmtT(a.at))}</small></td><td>${esc(a.actor)}</td><td>${a.action === "access_denied" ? '<span class="badge bad">' : '<span class="badge">'}${esc(ACT[a.action] || a.action)}</span><br><small class="mono">${esc(a.entity)}</small></td><td><div class="diff">${esc(diff(a))}</div></td><td>${esc(a.reason || "")}</td></tr>`).join("")}</tbody></table></div>` : empty("list", "لا عمليات مسجلة", ""); };
  const load = async (more) => { const r = await rpc("ind_audit_list", { p_limit: 100, p_entity: $("#af").value || null, p_before: more && rows.length ? rows[rows.length - 1].id : null }); rows = more ? rows.concat(r) : r; $("#more").hidden = r.length < 100; paint(); };
  $("#af").onchange = () => load(false); $("#more").onclick = () => load(true); await load(false);
}, { role: "admin" });
