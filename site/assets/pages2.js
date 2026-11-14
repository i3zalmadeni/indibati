/* صفحات المرحلتين 5 و6: الأعذار، والملف الانضباطي، ومركز الإشعارات، والإجراءات النظامية. */

// ============================== الأعذار ==============================
PAGES.excuses = () => boot("excuses.html", async (main, c) => {
  main.innerHTML = `<div class="card"><div class="row2"><div class="acts" id="ef">${[["", "الكل"], ["submitted", "مقدمة"], ["under_review", "قيد المراجعة"], ["approved", "معتمدة"], ["rejected", "غير معتمدة"]].map(([k, n], i) => `<button class="btn sm ${i === 1 ? "" : "sec"}" data-s="${k}">${n}</button>`).join("")}</div>
    <span class="sub">ولي الأمر لا يغيّر السجل الرسمي؛ اعتماد العذر هنا يحوّل الغياب إلى «بعذر» ويُسجَّل.</span></div><div id="el" class="mt"></div></div>`;
  let st = "submitted";
  const load = async () => {
    $("#el").innerHTML = loading();
    const rows = await rpc("ind_excuses_list", { p_status: st || null });
    $("#el").innerHTML = rows.length ? `<div class="tw"><table class="tbl"><thead><tr><th>الطالب</th><th>يوم الغياب</th><th>السبب</th><th>المرفقات</th><th>التقديم</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr>
      <td><a href="student.html?id=${x.student_id}"><b>${esc(x.name)}</b></a><br><small>${esc(x.grade_name || "")} – ${esc(x.section || "")}</small></td>
      <td>${esc(fmtBoth(x.day))}<br><small>${x.recorded ? STATUS[x.recorded] : "—"}</small></td><td><b>${esc(x.reason)}</b>${x.details ? `<br><small>${esc(x.details)}</small>` : ""}</td>
      <td class="mono">${x.files}</td><td><small>${esc(fmtT(x.submitted_at))}</small></td><td>${badge(EXC, x.status)}${x.review_note ? `<br><small>${esc(x.review_note)}</small>` : ""}</td>
      <td><button class="btn sm sec" data-o="${x.id}">${c.isCoord && ["submitted", "under_review"].includes(x.status) ? "مراجعة" : "عرض"}</button></td></tr>`).join("")}</tbody></table></div>`
      : empty("file", "لا أعذار في هذه الحالة", "تصل الأعذار من رابط ولي الأمر المرسل مع إشعار الغياب.");
    $$("[data-o]").forEach((b) => (b.onclick = () => open(rows.find((x) => x.id === b.dataset.o))));
  };
  const open = async (x) => {
    const files = await rpc("ind_excuse_files", { p_id: x.id }), can = c.isCoord && ["submitted", "under_review"].includes(x.status);
    const md = modal(`<h3>عذر غياب ${esc(x.name)}</h3><p class="sub">${esc(fmtBoth(x.day))} · المسجل: ${x.recorded ? STATUS[x.recorded] : "—"} · ${badge(EXC, x.status)}</p>
      <div class="item"><b>${esc(x.reason)}</b>${x.details ? `<p style="white-space:pre-wrap;margin:6px 0 0">${esc(x.details)}</p>` : ""}</div>
      ${files.length ? `<div class="acts">${files.map((f, i) => `<button class="btn sm sec" data-f="${esc(f.path)}">${ico("file")}المرفق ${i + 1}</button>`).join("")}</div>` : '<p class="sub">بلا مرفقات.</p>'}
      ${can ? `<label for="rn">ملاحظة المراجعة (مطلوبة عند عدم الاعتماد)</label><textarea id="rn" maxlength="500"></textarea><label class="chk"><input type="checkbox" id="nt" checked>إشعار ولي الأمر بالنتيجة</label><p class="err" id="re"></p>
        <div class="acts mt"><button class="btn" data-d="approved">${ico("check")}اعتماد</button><button class="btn sec" data-d="rejected">عدم اعتماد</button>${x.status === "submitted" ? '<button class="btn sec" data-d="under_review">قيد المراجعة</button>' : ""}<button class="btn sec" id="cx">إغلاق</button></div>`
        : `<div class="acts mt"><button class="btn sec" id="cx">إغلاق</button></div>`}`);
    $("#cx", md.el).onclick = md.close;
    $$("[data-f]", md.el).forEach((b) => (b.onclick = async () => { const { data, error } = await sb.storage.from("ind-excuses").createSignedUrl(b.dataset.f, 120); if (error || !data) return toast("لا تملك صلاحية فتح المرفق.", true); window.open(data.signedUrl, "_blank", "noopener"); }));
    $$("[data-d]", md.el).forEach((b) => (b.onclick = async () => {
      try { await rpc("ind_excuse_review", { p_id: x.id, p_decision: b.dataset.d, p_note: $("#rn", md.el).value, p_notify: $("#nt", md.el).checked });
        md.close(); toast(b.dataset.d === "approved" ? "اعتُمد العذر وحُدّث التصنيف" : "حُفظ القرار"); load(); } catch (e) { $("#re", md.el).textContent = mapErr(e); }
    }));
  };
  $$("#ef [data-s]").forEach((b) => (b.onclick = () => { st = b.dataset.s; $$("#ef [data-s]").forEach((x) => x.classList.toggle("sec", x !== b)); load(); }));
  load();
}, { role: "oversee" });

// ============================== الملف الانضباطي ==============================
PAGES.student = () => boot("student.html", async (main, c) => {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    main.innerHTML = `<div class="card"><h3 class="sec" style="margin-top:0">ابحث عن طالب</h3><div id="ss"></div></div><div id="top" class="mt"></div>`;
    studentSearch($("#ss"), "view", (s) => (location.href = "student.html?id=" + s.id));
    if (c.oversee) { const x = await rpc("ind_dashboard_extra");
      $("#top").innerHTML = `<div class="grid"><div class="card"><h3 class="sec" style="margin-top:0">الأكثر غياباً هذا العام</h3>${x.top_absent.map((s) => `<div class="row2"><a href="student.html?id=${s.id}">${esc(s.name)}</a><b class="mono">${s.n}</b></div>`).join("") || '<p class="sub">لا غياب.</p>'}</div>
        <div class="card"><h3 class="sec" style="margin-top:0">الأكثر تأخراً هذا العام</h3>${x.top_late.map((s) => `<div class="row2"><a href="student.html?id=${s.id}">${esc(s.name)}</a><b class="mono">${s.n} · ${s.minutes} د</b></div>`).join("") || '<p class="sub">لا تأخر.</p>'}</div></div>`; }
    return;
  }
  const f = await rpc("ind_student_file", { p_student: id }), s = f.student, A = f.absence, L = f.lateness;
  document.title = s.name + " – الملف الانضباطي – انضباطي";
  main.innerHTML = `<div class="card"><div class="row2"><div><h2 style="margin:0">${esc(s.name)}</h2><p class="sub" style="margin:4px 0">${esc(s.grade || "")} – ${esc(s.section || "")} · رقم الطالب <span class="mono">${esc(s.no || "")}</span></p>
      <p class="sub" style="margin:0">جوال ولي الأمر: ${s.has_phone ? `<span class="badge ok">${s.phone_source === "core" ? "مسجل في النواة الرقمية" : "مسجل برقم ولي الأمر"}</span>` : '<span class="badge bad">لا يوجد رقم في النواة</span>'}</p></div>
    <div class="acts">${f.can_link ? `<button class="btn sm sec" id="gl">${ico("copy")}رابط ولي الأمر</button>` : ""}<button class="btn sm sec" onclick="print()">${ico("print")}طباعة</button></div></div></div>
    <div class="kgrid mt">
      <div class="kpi k3"><div class="ic">${ico("file")}</div><div><b class="mono">${A.excused}</b><span>غياب بعذر</span></div></div>
      <div class="kpi k5"><div class="ic">${ico("x")}</div><div><b class="mono">${A.unexcused}</b><span>غياب بدون عذر</span></div></div>
      <div class="kpi k0"><div class="ic">${ico("calendar")}</div><div><b class="mono">${A.week}</b><span>غياب هذا الأسبوع</span></div></div>
      <div class="kpi k2"><div class="ic">${ico("chart")}</div><div><b class="mono">${A.consecutive_max}</b><span>أطول غياب متصل</span></div></div>
      <div class="kpi k1"><div class="ic">${ico("clock")}</div><div><b class="mono">${L.count}</b><span>مرة تأخر · ${L.minutes} دقيقة</span></div></div>
      <div class="kpi k4"><div class="ic">${ico("flag")}</div><div><b class="mono">${f.escalations.filter((e) => e.status === "active").length}</b><span>إجراء نظامي</span></div></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="card"><h3 class="sec" style="margin-top:0">سجل الغياب (العام الحالي)</h3>${A.days.length ? `<div class="tw"><table class="tbl"><tbody>${A.days.map((d) => `<tr><td>${esc(fmtBoth(d.day))}</td><td><span class="badge ${d.status === "absent_unexcused" ? "bad" : "warn"}">${STATUS[d.status]}</span></td></tr>`).join("")}</tbody></table></div>` : '<p class="sub">لا غياب مسجل.</p>'}</div>
      <div class="card"><h3 class="sec" style="margin-top:0">سجل التأخر</h3>${L.rows.length ? `<div class="tw"><table class="tbl"><thead><tr><th>التاريخ</th><th>الوصول</th><th>الدقائق</th><th>السبب</th></tr></thead><tbody>${L.rows.map((r) => `<tr><td>${esc(fmtShortDay(r.day))}</td><td class="mono">${esc(fmtHM(r.arrival))}</td><td class="mono">${r.minutes}</td><td>${esc(r.reason)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="sub">لا تأخر مسجل.</p>'}</div>
      <div class="card"><h3 class="sec" style="margin-top:0">الأعذار</h3>${f.excuses.length ? f.excuses.map((x) => `<div class="row2"><span>${esc(fmtShortDay(x.day))} · ${esc(x.reason)}</span>${badge(EXC, x.status)}</div>`).join("") : '<p class="sub">لا أعذار مقدمة.</p>'}</div>
      <div class="card"><h3 class="sec" style="margin-top:0">الإشعارات الصادرة</h3>${f.notifications.length ? f.notifications.map((n) => `<div class="row2"><span>${esc(NKIND[n.kind] || n.kind)} · <small>${esc(fmtT(n.at))}</small></span>${badge(NST, n.status)}</div>`).join("") : '<p class="sub">لا إشعارات.</p>'}</div>
      <div class="card"><h3 class="sec" style="margin-top:0">الإجراءات النظامية</h3>${f.escalations.length ? f.escalations.map((e) => `<div class="row2"><span>${esc(e.label)} · ${e.days} أيام · <small>${esc(fmtT(e.at))}</small></span><span>${e.status === "active" ? `<a class="btn sm sec" href="print.html?e=${e.id}" target="_blank">طباعة</a>` : '<span class="badge">مسحوب</span>'}</span></div>`).join("") : '<p class="sub">لا إجراءات.</p>'}</div>
    </div>`;
  const gl = $("#gl"); if (gl) gl.onclick = async () => { try { const r = await rpc("ind_guardian_link", { p_student: id });
    const md = modal(`<h3>رابط ولي الأمر</h3><p class="sub">رابط آمن خاص بهذا الطالب، صالح حتى ${esc(fmtT(r.expires_at))}. يعرض لولي الأمر غياب ابنه وتأخره ويتيح تقديم العذر. لا يظهر الرابط مرة أخرى.</p><input readonly dir="ltr" value="${esc(r.url)}" onclick="this.select()"><div class="acts mt"><button class="btn" id="cp">${ico("copy")}نسخ</button><button class="btn sec" id="cx">إغلاق</button></div>`);
    $("#cp", md.el).onclick = () => copyText(r.url); $("#cx", md.el).onclick = md.close; } catch (e) { toast(mapErr(e), true); } };
}, { title: "الملف الانضباطي" });

// ============================== مركز الإشعارات ==============================
PAGES.notifications = () => boot("notifications.html", async (main, c) => {
  const list = [["log", "سجل الرسائل", "list"]];
  if (c.isCoord || c.isPortal) list.push(["templates", "القوالب", "file"], ["config", "الإعدادات والربط", "gear"]);
  const status = await notifyStatus();
    tabs(main, list, async (k, body) => {
    const banner = status && status.configured ? "" : `<p class="note">${ico("info")} لم يُربط WhatsApp Business بعد. الرسائل تُحفظ في الطابور بحالة «بانتظار الإرسال» ولا يُدّعى إرسالها، وتُرسل فور الربط.</p>`;
    if (k === "log") {
      body.innerHTML = `${banner}<div class="card"><div class="pickbar"><div><label for="ls">الحالة</label><select id="ls"><option value="">الكل</option>${Object.entries(NST).map(([k2, v]) => `<option value="${k2}">${v[0]}</option>`).join("")}</select></div>
        <div><label for="lk">النوع</label><select id="lk"><option value="">الكل</option>${Object.entries(NKIND).map(([k2, v]) => `<option value="${k2}">${v}</option>`).join("")}</select></div>
        <div class="acts" style="align-self:end">${c.isCoord && status && status.configured ? `<button class="btn sm" id="sn">${ico("send")}إرسال الطابور</button>` : ""}<button class="btn sm sec" id="xp">${ico("file")}تصدير</button></div></div><div id="ll"></div></div>`;
      let rows = [];
      let seq = 0;
      const load = async () => { const my = ++seq; $("#ll", body).innerHTML = loading(); const r0 = await rpc("ind_notifications_list", { p_status: $("#ls", body).value || null, p_kind: $("#lk", body).value || null, p_limit: 500 }); if (my !== seq) return; rows = r0;
        $("#ll", body).innerHTML = rows.length ? `<div class="tw"><table class="tbl"><thead><tr><th>الطالب</th><th>ولي الأمر</th><th>النوع</th><th>الإنشاء</th><th>الإرسال</th><th>الحالة</th><th>معرّف المزود</th>${c.isCoord ? "<th></th>" : ""}</tr></thead><tbody>${rows.map((n) => `<tr>
          <td>${esc(n.student)}</td><td>${esc(n.guardian || "—")}</td><td>${esc(NKIND[n.kind] || n.kind)}</td><td><small>${esc(fmtT(n.created_at))}<br>${esc(n.by || "آلي")}</small></td><td><small>${esc(fmtT(n.sent_at))}</small></td>
          <td>${badge(NST, n.status)}${n.error ? `<br><small class="err">${esc(n.error)}</small>` : ""}</td><td><small class="mono" dir="ltr">${esc(n.provider_message_id || "")}</small></td>
          ${c.isCoord ? `<td><div class="acts">${n.status === "failed" ? `<button class="btn sm sec" data-r="${n.id}">إعادة</button>` : ""}${["queued", "no_phone", "failed"].includes(n.status) ? `<button class="btn sm sec" data-c="${n.id}">حذف</button>` : ""}</div></td>` : ""}</tr>`).join("")}</tbody></table></div>` : empty("bell", "لا رسائل", "");
        $$("[data-r]", body).forEach((b) => (b.onclick = async () => { try { await rpc("ind_notification_retry", { p_id: b.dataset.r }); load(); } catch (e) { toast(mapErr(e), true); } }));
        $$("[data-c]", body).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("حذف الرسالة", "لن تُرسل هذه الرسالة.", { okText: "حذف", danger: true }))) return; try { await rpc("ind_notification_cancel", { p_id: b.dataset.c }); load(); } catch (e) { toast(mapErr(e), true); } }));
      };
      $("#ls", body).onchange = load; $("#lk", body).onchange = load;
      $("#xp", body).onclick = () => exportCSV("الإشعارات", ["الطالب", "ولي الأمر", "النوع", "الإنشاء", "الإرسال", "الحالة", "السبب", "معرف المزود"], rows.map((n) => [n.student, n.guardian, NKIND[n.kind], fmtT(n.created_at), fmtT(n.sent_at), NST[n.status]?.[0], n.error, n.provider_message_id]));
      const sn = $("#sn", body); if (sn) sn.onclick = () => sendNow().then(load);
      load();
    }
    if (k === "templates") {
      const T = await rpc("ind_templates_list"), canEdit = c.isAdmin || c.isPortal;
      body.innerHTML = `<div class="card"><p class="sub">النص هنا للمعاينة والسجل. الإرسال الفعلي يتم عبر قالب معتمد مسبقاً في WhatsApp Manager باسمه ومتغيراته بالترتيب. المتغيرات: {student} {date} {link} {arrival} {reason} {count} {days} {level} {result} {note}.</p>
        ${T.map((t) => `<div class="item"><div class="row2"><b>${esc(t.name)}</b><span>${t.wa_template ? `<span class="badge ok" dir="ltr">${esc(t.wa_template)}</span>` : '<span class="badge warn">غير مربوط بقالب معتمد</span>'} ${t.is_active ? "" : '<span class="badge">معطّل</span>'}</span></div>
          <div class="diff" style="max-width:none;margin-top:6px">${esc(t.body)}</div>${canEdit ? `<div class="acts mt"><button class="btn sm sec" data-e="${t.code}">تعديل</button></div>` : ""}</div>`).join("")}</div>`;
      $$("[data-e]", body).forEach((b) => (b.onclick = () => { const t = T.find((x) => x.code === b.dataset.e);
        const md = modal(`<h3>${esc(t.name)}</h3><label for="tb">النص</label><textarea id="tb" rows="9">${esc(t.body)}</textarea>
          <div class="fg"><div><label for="tw">اسم القالب المعتمد في WhatsApp</label><input id="tw" dir="ltr" value="${esc(t.wa_template || "")}"></div><div><label for="tl">اللغة</label><input id="tl" dir="ltr" value="${esc(t.wa_lang)}"></div></div>
          <label for="tp">ترتيب المتغيرات في القالب (مفصولة بفاصلة)</label><input id="tp" dir="ltr" value="${esc(t.wa_params.join(","))}"><label class="chk"><input type="checkbox" id="ta" ${t.is_active ? "checked" : ""}>مفعّل</label>
          <p class="err" id="te"></p><div class="acts mt"><button class="btn" id="ok">حفظ</button><button class="btn sec" id="no">رجوع</button></div>`, true);
        $("#no", md.el).onclick = md.close;
        $("#ok", md.el).onclick = async () => { try { await rpc("ind_template_save", { p_code: t.code, p_body: $("#tb", md.el).value, p_wa_template: $("#tw", md.el).value, p_wa_lang: $("#tl", md.el).value, p_wa_params: $("#tp", md.el).value.split(",").map((x) => x.trim()).filter(Boolean), p_active: $("#ta", md.el).checked }); md.close(); toast("حُفظ القالب"); $$("[data-t=templates]")[0].click(); } catch (e) { $("#te", md.el).textContent = mapErr(e); } }; }));
    }
    if (k === "config") {
      const meta = await rpc("ind_meta", { p_task: "view" }), cfg = await rpc("ind_settings_get");
      body.innerHTML = `${banner}<div class="card"><h3 class="sec" style="margin-top:0">حالة الربط</h3>
        <p>${status && status.configured ? '<span class="badge ok">WhatsApp Business مربوط</span>' : '<span class="badge warn">غير مربوط</span>'} ${status && status.webhook ? '<span class="badge ok">Webhook مفعّل</span>' : '<span class="badge warn">Webhook غير مفعّل</span>'}</p>
        <p class="sub">يضبط مدير البوابة الأسرار في Supabase › Edge Functions › Secrets: <span dir="ltr" class="mono">WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET</span>، ثم يضيف عنوان الـ Webhook في تطبيق Meta: <span dir="ltr" class="mono">${esc(FN("ind-notify"))}/webhook</span></p></div>
        <div class="card mt" id="nsCard">${loading()}</div>`;
      const L = meta.lateness;
      $("#nsCard", body).innerHTML = `<h3 class="sec" style="margin-top:0">الإشعارات الآلية</h3>
        <label class="chk"><input type="checkbox" id="c1" ${L.notify_enabled ? "checked" : ""} disabled>إشعار فوري عند تسجيل التأخر (يُضبط من الإعدادات ← التأخر)</label>
        <div class="fg"><div><label for="c2">إشعار تكرار التأخر بعد كل (مرة)، 0 للتعطيل</label><input type="number" id="c2" min="0" max="50"></div><div><label for="c3">خلال آخر (يوماً)</label><input type="number" id="c3" min="1" max="200"></div></div>
        <label class="chk"><input type="checkbox" id="c4">إرسال إشعارات الإجراءات النظامية تلقائياً عند بلوغ الحد</label>
        ${c.isAdmin || c.isPortal ? `<label for="c5">رابط بوابة ولي الأمر</label><input id="c5" dir="ltr">` : ""}
        <div class="acts mt"><button class="btn" id="sv">حفظ</button></div>`;
      const ns = cfg.notifications;
      if (ns) { $("#c2", body).value = ns.lateness_repeat_threshold; $("#c3", body).value = ns.lateness_repeat_window_days; $("#c4", body).checked = !!ns.escalation_notify; if ($("#c5", body)) $("#c5", body).value = ns.portal_url || ""; }
      $("#sv", body).onclick = async () => { try { await rpc("ind_set_notification_settings", { p: { lateness_repeat_threshold: +$("#c2", body).value, lateness_repeat_window_days: +$("#c3", body).value, escalation_notify: $("#c4", body).checked, portal_url: $("#c5", body)?.value } }); toast("حُفظت الإعدادات"); } catch (e) { toast(mapErr(e), true); } };
    }
  });
}, { role: "oversee" });

// ============================== رسائل الغياب ==============================
// قائمة غائبي اليوم في نطاق، ثم إدراج رسالة فردية لكل ولي أمر برابط آمن لتقديم العذر
async function sendNow() {
  const { data: { session } } = await sb.auth.getSession();
  try { const r = await fetch(FN("ind-notify") + "/send?limit=100", { method: "POST", headers: { authorization: "Bearer " + session.access_token, apikey: APP_CONFIG.supabaseKey } });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "فشل الطلب");
    toast(j.configured ? `قبل واتساب ${j.sent} · فشل ${j.failed}` : j.note, !j.configured); } catch (e) { toast(mapErr(e), true); }
}
async function notifyStatus() { try { const r = await fetch(FN("ind-notify") + "/status"); return r.ok ? await r.json() : null; } catch (_) { return null; } }
PAGES.messages = () => boot("messages.html", async (main, c) => {
  const status = await notifyStatus();
  const banner = status && status.configured ? "" : `<p class="note">${ico("info")} لم يُربط الإرسال بعد. الرسائل تُحفظ في الطابور بحالة «بانتظار الإرسال» ولا يُدّعى إرسالها، وتُرسل فور الربط.</p>`;
  const body = main;
  const meta = await rpc("ind_meta", { p_task: "view" });
  body.innerHTML = `${banner}<div class="card"><div class="pickbar"><div><label for="nd">التاريخ</label><input type="date" id="nd" max="${meta.today}" value="${esc(new URLSearchParams(location.search).get("d") || lastSchoolDay(meta))}"></div>
    <div><label for="ng">الصف</label><select id="ng"><option value="">جميع الصفوف</option>${meta.grades.map((g) => `<option value="${g.code}">${esc(g.name)}</option>`).join("")}</select></div>
    <div><label for="ns">الفصل</label><select id="ns"><option value="">جميع الفصول</option></select></div></div><div id="nl"></div></div>`;
  const G = $("#ng", body), S = $("#ns", body), D = $("#nd", body);
  const fillS = () => { S.innerHTML = '<option value="">جميع الفصول</option>' + meta.sections.filter((x) => !G.value || x.grade === G.value).map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join(""); };
  let seq = 0;
  const load = async () => {
    const my = ++seq;
    $("#nl", body).innerHTML = loading();
    const rows = await rpc("ind_notice_candidates", { p_day: D.value, p_scope: S.value ? "list" : G.value ? "grade" : "all", p_sections: S.value ? [S.value] : null, p_grade: G.value || null });
    if (my !== seq) return;
    if (!rows.length) { $("#nl", body).innerHTML = empty("check", "لا غائبين مسجلين في هذا النطاق", "تأكد من حفظ التحضير أولاً."); return; }
    if (my !== seq) return;
    const tpl = (await rpc("ind_templates_list")).find((t) => t.code === "absence");
    if (my !== seq) return;
    const PEND = ["queued", "no_phone", "failed"], live = (r) => r.notice && r.notice.status !== "cancelled", pend = rows.filter((r) => live(r) && PEND.includes(r.notice.status));
    $("#nl", body).innerHTML = `<div class="row2"><label class="chk"><input type="checkbox" id="ca">تحديد جميع من لم يُشعَر</label><span class="sub">${rows.length} غائب · ${rows.filter((r) => !r.has_phone).length} بلا رقم جوال</span></div>
      <div class="tw"><table class="tbl"><thead><tr><th></th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>ولي الأمر</th><th>الإشعار</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.notice && r.notice.status !== "cancelled" ? "" : `<input type="checkbox" data-st="${r.student_id}" aria-label="${esc(r.name)}">`}</td>
      <td><a href="student.html?id=${r.student_id}">${esc(r.name)}</a></td><td>${esc(r.label)}</td><td><span class="badge ${r.status === "absent_unexcused" ? "bad" : "warn"}">${STATUS[r.status]}</span></td>
      <td>${esc(r.guardian || "ولي أمر الطالب")} ${r.has_phone ? (r.phone_source === "core" ? '<span class="badge">رقم النواة</span>' : "") : '<span class="badge bad">لا رقم</span>'}</td><td><span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap">${live(r) ? badge(NST, r.notice.status) : "—"}${live(r) && PEND.includes(r.notice.status) ? `<button class="btn sm sec" style="flex-direction:row;padding:4px 10px" data-del="${r.notice.id}" title="حذف الإشعار المعلق" aria-label="حذف إشعار ${esc(r.name)}">${ico("x")}حذف</button>` : ""}</span></td></tr>`).join("")}</tbody></table></div>
      <div class="savebar"><span class="sub" id="nc">لم يُحدد أحد</span><div class="acts">${pend.length ? `<button class="btn sec" id="dp">${ico("x")}حذف المعلقة (${pend.length})</button>` : ""}<button class="btn sec" id="pv">معاينة الرسالة</button><button class="btn" id="qq" disabled>${ico("send")}إدراج في الطابور</button>${status && status.configured ? `<button class="btn sec" id="sn">إرسال الطابور الآن</button>` : ""}</div></div>`;
    const sel = () => $$("[data-st]:checked", body).map((x) => x.dataset.st);
    const upd = () => { const n = sel().length; $("#nc", body).textContent = n ? `${n} محدد · رسالة فردية لكل ولي أمر` : "لم يُحدد أحد"; $("#qq", body).disabled = !n; };
    $$("[data-st]", body).forEach((x) => (x.onchange = upd));
    $("#ca", body).onchange = (e) => { $$("[data-st]", body).forEach((x) => (x.checked = e.target.checked)); upd(); };
    $("#pv", body).onclick = () => { const ex = rows[0]; const txt = (tpl?.body || "").replace("{student}", ex.name).replace("{date}", fmtBoth(D.value)).replace("{link}", "‹رابط آمن خاص بالطالب›");
      const md = modal(`<h3>معاينة رسالة الغياب</h3><div class="item" style="white-space:pre-wrap">${esc(txt)}</div><p class="sub">المعاينة لأول طالب. تُرسل عبر القالب المعتمد في WhatsApp${tpl?.wa_template ? ` (<span dir="ltr">${esc(tpl.wa_template)}</span>)` : " — لم يُربط بعد"}.</p><div class="acts mt"><button class="btn sec" id="cx">إغلاق</button></div>`); $("#cx", md.el).onclick = md.close; };
    $("#qq", body).onclick = async () => { const ids = sel();
      if (!(await confirmBox("إدراج إشعارات الغياب", `سيُنشأ ${ids.length} إشعار فردي، لكل منها رابط آمن خاص بالطالب.`, { okText: "إدراج" }))) return;
      try { const r = await rpc("ind_queue_absence_notices", { p_day: D.value, p_students: ids }); toast(`بالطابور ${r.queued} · بلا رقم ${r.no_phone} · مكرر ${r.duplicates}`); load(); } catch (e) { toast(mapErr(e), true); } };
    const del = async (ids, title) => {
      if (!(await confirmBox(title, `${ids.length === 1 ? "لن يُرسل هذا الإشعار" : `لن تُرسل ${ids.length} إشعارات`}، ويمكن إدراجه من جديد لاحقاً. يبقى أثر الحذف في سجل العمليات.`, { okText: "حذف", danger: true }))) return;
      const res = await Promise.allSettled(ids.map((id) => rpc("ind_notification_cancel", { p_id: id })));
      const bad = res.filter((x) => x.status === "rejected").length;
      toast(bad ? `حُذف ${ids.length - bad} · تعذر ${bad}` : `حُذف ${ids.length} إشعار`, !!bad); load();
    };
    $$("[data-del]", body).forEach((b) => (b.onclick = () => del([b.dataset.del], "حذف الإشعار المعلق")));
    const dp = $("#dp", body); if (dp) dp.onclick = () => del(pend.map((r) => r.notice.id), "حذف جميع الإشعارات المعلقة");
    const sn = $("#sn", body); if (sn) sn.onclick = () => sendNow().then(load);
  };
  G.onchange = () => { fillS(); load(); }; S.onchange = load; D.onchange = load; fillS(); load();
}, { role: "coord" });

// ============================== الإجراءات النظامية ==============================
PAGES.escalations = () => boot("escalations.html", async (main, c) => {
  tabs(main, [["due", "الإجراءات الصادرة", "flag"], ["rules", "الحدود والقواعد", "gear"]], async (k, body) => {
    if (k === "due") {
      const rows = await rpc("ind_escalations_list", { p_status: "active" }), R = await rpc("ind_escalation_rules_list");
      body.innerHTML = `${R.some((r) => r.is_active) ? "" : `<p class="note">${ico("info")} القواعد معطّلة حتى تُراجع الحدود وطريقة احتسابها مع اللائحة السارية في وزارة التعليم. فعّلها من «الحدود والقواعد».</p>`}
        <div class="card">${rows.length ? `<div class="tw"><table class="tbl"><thead><tr><th>الطالب</th><th>الفصل</th><th>الإجراء</th><th>أيام الغياب</th><th>تاريخ الإصدار</th><th>إشعار ولي الأمر</th><th></th></tr></thead><tbody>${rows.map((e) => `<tr>
          <td><a href="student.html?id=${e.student_id}">${esc(e.name)}</a></td><td>${esc(e.grade_name || "")} – ${esc(e.section || "")}</td><td><b>${esc(e.label)}</b></td><td class="mono">${e.days}</td><td><small>${esc(fmtT(e.created_at))}</small></td>
          <td>${e.notice ? badge(NST, e.notice) : "—"}</td><td><a class="btn sm ${e.printed_at ? "sec" : ""}" href="print.html?e=${e.id}" target="_blank">${ico("print")}${e.printed_at ? "إعادة الطباعة" : "طباعة"}</a></td></tr>`).join("")}</tbody></table></div>`
          : empty("flag", "لا إجراءات صادرة", "تُنشأ آلياً عند بلوغ الطالب حد الغياب في قاعدة مفعّلة.")}</div>`;
    }
    if (k === "rules") {
      const R = await rpc("ind_escalation_rules_list");
      body.innerHTML = `<div class="card"><p class="sub">الأرقام المبدئية حددتها المدرسة، وقد لا تكون النص النظامي الأحدث. لا تفعّل القاعدة قبل مراجعة اللائحة السارية.</p>
        <div class="tw"><table class="tbl"><thead><tr><th>المستوى</th><th>الإجراء</th><th>عدد الأيام</th><th>ما يُحتسب</th><th>طريقة العد</th><th>إشعار ولي الأمر</th><th>مفعّلة</th>${c.isCoord ? "<th></th>" : ""}</tr></thead><tbody>${R.map((r) => `<tr data-id="${r.id}">
          <td class="mono">${r.level}</td><td><input data-k="label" value="${esc(r.label)}" ${c.isCoord ? "" : "disabled"}></td><td><input data-k="days" type="number" min="1" value="${r.days}" style="max-width:90px" ${c.isCoord ? "" : "disabled"}></td>
          <td><select data-k="mode" ${c.isCoord ? "" : "disabled"}><option value="unexcused" ${r.count_mode === "unexcused" ? "selected" : ""}>الغياب بدون عذر</option><option value="all" ${r.count_mode === "all" ? "selected" : ""}>كل الغياب</option></select></td>
          <td><select data-k="pattern" ${c.isCoord ? "" : "disabled"}><option value="total" ${r.pattern === "total" ? "selected" : ""}>متفرقة (إجمالي)</option><option value="consecutive" ${r.pattern === "consecutive" ? "selected" : ""}>متصلة</option></select></td>
          <td><input type="checkbox" data-k="notify" ${r.notify ? "checked" : ""} ${c.isCoord ? "" : "disabled"}></td><td><input type="checkbox" data-k="active" ${r.is_active ? "checked" : ""} ${c.isCoord ? "" : "disabled"}></td>
          ${c.isCoord ? `<td><button class="btn sm" data-s="${r.id}">حفظ</button></td>` : ""}</tr>`).join("")}</tbody></table></div></div>`;
      $$("[data-s]", body).forEach((b) => (b.onclick = async () => { const tr = b.closest("tr"), v = (k2) => $(`[data-k=${k2}]`, tr);
        if (v("active").checked && !(await confirmBox("تفعيل القاعدة", "هل روجعت الحدود وطريقة احتسابها مع اللائحة السارية؟ عند التفعيل يُعاد تقييم غياب جميع الطلاب وتصدر الإجراءات المستحقة.", { okText: "نعم، فعّل" }))) return;
        try { await rpc("ind_escalation_rule_save", { p_id: tr.dataset.id, p_label: v("label").value, p_days: +v("days").value, p_mode: v("mode").value, p_pattern: v("pattern").value, p_notify: v("notify").checked, p_active: v("active").checked }); toast("حُفظت القاعدة"); } catch (e) { toast(mapErr(e), true); } }));
    }
  });
}, { role: "oversee" });

// ============================== طباعة الإشعار الرسمي ==============================
PAGES.print = () => boot("print.html", async (main) => {
  const id = new URLSearchParams(location.search).get("e"), d = await rpc("ind_escalation_print", { p_id: id });
  document.title = d.rule.label + " – " + d.student.name;
  main.innerHTML = `<article class="card official"><div class="row2 ohd"><div><b>المملكة العربية السعودية</b><br>وزارة التعليم<br>${esc(d.school?.department || "")}${d.school?.office ? "<br>" + esc(d.school.office) : ""}<br>${esc(d.school?.name || "مدرسة لبيد بن ربيعة المتوسطة")}</div>
      <div style="text-align:left"><small>التاريخ: ${esc(fmtBoth(d.today))}</small></div></div>
    <h2 style="text-align:center;margin:18px 0">${esc(d.rule.label)}</h2>
    <p>المكرم ولي أمر الطالب: <b>${esc(d.student.name)}</b> &nbsp; الصف: ${esc(d.student.grade || "")} – ${esc(d.student.section || "")} &nbsp; رقم الطالب: <span class="mono">${esc(d.student.no || "")}</span></p>
    <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
    <p>نحيطكم علماً بأن عدد أيام غياب ابنكم ${d.rule.count_mode === "unexcused" ? "بدون عذر" : ""} ${d.rule.pattern === "consecutive" ? "المتصلة" : ""} بلغ (<b>${d.days}</b>) أيام خلال العام الدراسي الحالي، وعليه صدر بحقه <b>${esc(d.rule.label)}</b>. نأمل متابعة انتظام الطالب ومراجعة المدرسة.</p>
    <h3 class="sec">أيام الغياب المسجلة</h3><table class="tbl"><thead><tr><th>#</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${d.absences.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(fmtBoth(a.day))}</td><td>${STATUS[a.status]}</td></tr>`).join("")}</tbody></table>
    <div class="grid mt" style="grid-template-columns:1fr 1fr 1fr;text-align:center;margin-top:40px"><div>منسق الغياب<br><br>..................</div><div>وكيل شؤون الطلاب<br><br>..................</div><div>مدير المدرسة<br><br>..................</div></div>
    <p class="sub" style="margin-top:28px">اطلعت على الإشعار — ولي الأمر: .................................. التوقيع: .................. التاريخ: ..................</p></article>
    <div class="acts mt no-print"><button class="btn" onclick="print()">${ico("print")}طباعة</button></div>`;
}, { title: "طباعة إشعار رسمي", role: "oversee" });

// ============================== التقارير ==============================
const REPORTS = [
  ["الحضور والغياب", [["attendance_daily", "تقرير الحضور اليومي"], ["absence_list", "تقرير الغياب (يومي/أسبوعي/فصلي)"], ["absence_excused", "تقرير الغياب بعذر"], ["absence_unexcused", "تقرير الغياب بدون عذر"], ["absence_summary", "ملخص الغياب لكل طالب"], ["absence_repeat", "الطلاب المتكرر غيابهم"]]],
  ["التأخر", [["lateness_list", "تقرير التأخر (يومي/أسبوعي/فصلي)"], ["lateness_summary", "ملخص التأخر لكل طالب"], ["lateness_repeat", "الطلاب المتكرر تأخرهم"], ["lateness_reasons", "أكثر أسباب التأخر"]]],
  ["المتابعة", [["notifications", "تقرير الإشعارات المرسلة"], ["excuses", "تقرير الأعذار"], ["escalations", "تقرير الإجراءات النظامية"], ["rewards", "تقرير نقاط الانتظام"]]],
];
PAGES.reports = () => boot("reports.html", async (main) => {
  const meta = await rpc("ind_meta", { p_task: "view" }), yi = await rpc("ind_year_info"), t = meta.today, d = (n) => new Date(d12(t) - n * 864e5).toISOString().slice(0, 10);
  const ws = new Date(d12(t) - dow(t) * 864e5).toISOString().slice(0, 10);
  const PRE = { today: [lastSchoolDay(meta), lastSchoolDay(meta)], week: [ws, t], month: [t.slice(0, 8) + "01", t], d30: [d(30), t], term: [(yi && yi.starts_on) || d(120), t] };
  main.innerHTML = `<div class="card no-print"><div class="pickbar">
      <div style="grid-column:span 2"><label for="rk">التقرير</label><select id="rk">${REPORTS.map(([g, l]) => `<optgroup label="${g}">${l.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <div><label for="rp">الفترة</label><select id="rp"><option value="today">آخر يوم دراسي</option><option value="week" selected>هذا الأسبوع</option><option value="month">هذا الشهر</option><option value="d30">آخر 30 يوماً</option><option value="term">منذ بداية العام</option><option value="custom">مخصصة</option></select></div>
      <div><label for="rf">من</label><input type="date" id="rf"></div><div><label for="rt">إلى</label><input type="date" id="rt" max="${t}"></div></div>
    <div class="pickbar"><div><label for="rg">الصف</label><select id="rg"><option value="">جميع الصفوف</option>${meta.grades.map((g) => `<option value="${g.code}">${esc(g.name)}</option>`).join("")}</select></div>
      <div><label for="rs">الفصل</label><select id="rs"><option value="">جميع الفصول</option></select></div>
      <div><label for="rq">بحث عن طالب</label><input type="search" id="rq" placeholder="الاسم أو الرقم"></div>
      <div id="rmw" hidden><label for="rm">الحد الأدنى للتكرار</label><input type="number" id="rm" min="1" value="3"></div></div>
    <div class="acts"><button class="btn" id="go">${ico("chart")}عرض التقرير</button><button class="btn sec" id="xl" disabled>${ico("file")}تصدير Excel</button><button class="btn sec" id="pd" disabled>${ico("print")}طباعة / PDF</button></div></div>
    <div id="rptOut" class="mt"></div>`;
  const K = $("#rk"), P = $("#rp"), F = $("#rf"), T = $("#rt"), G = $("#rg"), S = $("#rs");
  const preset = () => { if (P.value !== "custom") { [F.value, T.value] = PRE[P.value]; } };
  const fillS = () => { S.innerHTML = '<option value="">جميع الفصول</option>' + meta.sections.filter((x) => !G.value || x.grade === G.value).map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join(""); };
  P.onchange = preset; F.onchange = T.onchange = () => (P.value = "custom"); G.onchange = fillS; K.onchange = () => ($("#rmw").hidden = !/repeat/.test(K.value));
  preset(); fillS();
  let last = null;
  const name = () => K.selectedOptions[0].textContent;
  $("#go").onclick = async () => {
    $("#rptOut").innerHTML = loading();
    try { last = await rpc("ind_report", { p_kind: K.value, p_from: F.value, p_to: T.value, p_grade: G.value || null, p_section: S.value || null, p_q: $("#rq").value || null, p_min: +$("#rm").value || 3 }); }
    catch (e) { $("#rptOut").innerHTML = `<p class="err">${esc(mapErr(e))}</p>`; return; }
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const scope = [G.value ? G.selectedOptions[0].textContent : "", S.value ? S.selectedOptions[0].textContent : ""].filter(Boolean).join(" · ");
    $("#rptOut").innerHTML = `<article class="card official" style="max-width:none"><div class="row2 ohd"><div><b>المملكة العربية السعودية · وزارة التعليم</b><br>مدرسة لبيد بن ربيعة المتوسطة · انضباطي</div><div style="text-align:left"><small>صدر ${esc(fmtBoth(t))}</small></div></div>
      <h2 style="margin:14px 0 4px">${esc(name())}</h2><p class="sub">من ${esc(fmtBoth(last.from))} إلى ${esc(fmtBoth(last.to))}${scope ? " · " + esc(scope) : ""} · ${last.rows.length} سجل</p>
      ${last.rows.length ? `<div class="tw"><table class="tbl"><thead><tr><th>#</th>${last.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${last.rows.map((r, i) => `<tr><td class="mono">${i + 1}</td>${r.map((v) => `<td>${isDate(v) ? esc(fmtShortDay(v)) : esc(v ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : empty("chart", "لا بيانات في هذه الفترة", "")}</article>`;
    $("#xl").disabled = $("#pd").disabled = !last.rows.length;
  };
  $("#xl").onclick = async () => {
    if (!window.XLSX) { await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); }).catch(() => null); }
    if (!window.XLSX) return exportCSV(name(), last.columns, last.rows);
    const ws2 = XLSX.utils.aoa_to_sheet([[name()], [`من ${last.from} إلى ${last.to}`], [], last.columns, ...last.rows]); ws2["!views"] = [{ RTL: true }];
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws2, "التقرير"); XLSX.writeFile(wb, `${name()}-${last.from}-${last.to}.xlsx`);
  };
  $("#pd").onclick = () => print();
}, { role: "oversee" });
