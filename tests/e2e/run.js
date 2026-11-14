// اختبار واجهات انضباطي على خادم المعاينة المحلي (tests/e2e/server.js) بمتصفح حقيقي.
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs"), path = require("path");
const BASE = "http://localhost:8787", OUT = process.env.OUT || "/tmp/shots", U = (n) => "00000000-0000-0000-0000-0000000000f" + n;
const MOCK = fs.readFileSync(path.join(__dirname, "mock-supabase.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, n) => { console.log((c ? "PASS: " : "FAIL: ") + n); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const open = async (user, w = 1180, h = 900) => {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, locale: "ar-SA", timezoneId: "Asia/Riyadh" });
    await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: "text/javascript", body: MOCK }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route(/supabase\.co\/functions\/v1\/(.*)/, async (r) => { const u = r.request().url().split("/functions/v1/")[1]; r.fulfill({ response: await r.fetch({ url: BASE + "/fn/" + u }) }); });
    await ctx.addInitScript((u) => { u ? localStorage.setItem("preview_user", u) : localStorage.removeItem("preview_user"); }, user);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message + " @ " + (e.stack || "").split("\n").slice(1, 3).join(" "))); p.on("dialog", (d) => d.accept()); p.errs = errs; return p;
  };
  const shot = async (p, n) => { await p.waitForTimeout(700); return p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };
  const D = "2026-11-12";

  // 1) مدخل الغياب: التحضير
  let p = await open(U(2), 1024, 1300);   // مقاس iPad تقريباً
  await p.goto(`${BASE}/attendance.html?s=00000000-0000-0000-0000-000000000c11&d=${D}`); await p.waitForSelector("#rl li");
  ok((await p.$$("#rl li")).length === 12, "قائمة 12 طالباً في الفصل");
  ok((await p.$$eval("#rl li", (l) => l.every((x) => x.dataset.st === "present"))), "الجميع حاضر افتراضياً");
  ok((await p.$$eval("#ps option", (o) => o.length)) === 3, "المدخل يرى فصليه فقط");
  await p.click('#rl li:nth-child(2) button[data-v="absent_excused"]');
  await p.click('#rl li:nth-child(5) button[data-v="absent_unexcused"]');
  await p.click('#rl li:nth-child(7) button[data-v="absent_unexcused"]'); await p.waitForTimeout(300);
  ok(await p.$eval("#rl li:nth-child(5)", (e) => getComputedStyle(e).backgroundColor !== getComputedStyle(document.querySelector("#rl li:nth-child(1)")).backgroundColor), "تلوين صف الغائب كاملاً");
  ok((await p.textContent("#tally")).includes("غائب بدون عذر 2"), "تحديث الأعداد فوراً");
  await shot(p, "01-attendance-entry");
  await p.click("#save"); await p.waitForSelector(".toast"); await p.waitForTimeout(400);
  ok((await p.textContent("#dirty")).includes("حُفظ"), "الحفظ ثم إعادة التحميل من الخادم");
  ok((await p.$$eval('#rl li[data-st="absent_unexcused"]', (l) => l.length)) === 2, "الغياب محفوظ في القاعدة");
  await p.click("#saveLock"); await p.click(".md #ok"); await p.waitForSelector(".lockst.on");
  ok(await p.$eval('#rl li button', (b) => b.disabled), "بعد التثبيت: القائمة للقراءة فقط");
  ok(!(await p.$("#save")), "لا زر حفظ بعد التثبيت");
  await shot(p, "02-attendance-locked");
  ok(p.errs.length === 0, "لا أخطاء JavaScript (مدخل الغياب): " + p.errs.join(" | "));

  // 2) المدخل نفسه يحاول فتح فصل غير مسند عبر الرابط
  await p.goto(`${BASE}/attendance.html?s=00000000-0000-0000-0000-000000000c31&d=${D}`); await p.waitForTimeout(800);
  ok((await p.textContent("#body")).includes("اختر") || (await p.$$("#rl li")).length === 0, "لا تُعرض قائمة فصل غير مسند");
  // 3) الصفحات المحظورة على المدخل تعيده إلى الرئيسية
  await p.goto(`${BASE}/assignments.html`); await p.waitForURL(/dashboard/); ok(true, "المدخل لا يصل إلى إدارة التكليفات");
  await p.waitForSelector(".task-c"); await shot(p, "03-dashboard-entry");

  // 4) المنسق: لوحة، تثبيت، إلغاء تثبيت بسبب
  p = await open(U(1));
  await p.goto(`${BASE}/dashboard.html`); await p.waitForSelector(".kgrid"); await shot(p, "04-dashboard-coord");
  const navOrder = await p.$$eval(".dnav-in a", (a) => a.map((x) => x.getAttribute("href")));
  ok(navOrder.slice(0, 6).join() === "dashboard.html,attendance.html,locks.html,messages.html,excuses.html,lateness.html" && navOrder.slice(-2).join() === "settings.html,notifications.html", "ترتيب القائمة: التحضير، التثبيت، رسائل الغياب، الأعذار، التأخر … الإعدادات، الإشعارات");
  const dtxt = await p.textContent("#main");
  ok(dtxt.includes("لم يكتمل تحضيرها") && dtxt.includes("حُضّرت ولم تُثبَّت") && dtxt.includes("إحصائيات الغياب"), "الرئيسية: الفصول غير المكتملة وغير المثبتة والإحصائيات");
  ok((await p.$$("#main table tbody tr")).length >= 1 && (await p.textContent("#main table")).includes("الفصل"), "الرئيسية: قائمة الغائبين مع الفصل");
  ok(!!(await p.$('#main a[href^="messages.html?d="]')), "الرئيسية: رابط رسائل الغياب");
  await p.goto(`${BASE}/locks.html?d=${D}`); await p.waitForSelector(".secgrid");
  ok((await p.$$(".sec-c")).length === 6, "المنسق يرى جميع الفصول (6)");
  ok(!!(await p.$(`#la a[href="messages.html?d=${D}"]`)), "شاشة التثبيت: زر رسائل الغياب لليوم");
  await shot(p, "05-locks-coord");
  await p.click('[data-s="00000000-0000-0000-0000-000000000c11"]'); await p.click("#uSel");
  await p.click(".md #ok"); ok((await p.textContent(".md #ce")) === "السبب مطلوب.", "سبب إلغاء التثبيت إلزامي في الواجهة");
  await p.fill(".md #cr", "تصحيح غياب طالب حضر متأخراً"); await p.click(".md #ok"); await p.waitForTimeout(700);
  ok((await p.$$(".sec-c.locked")).length === 0, "أُلغي التثبيت");
  await p.click("#lAll"); await p.waitForSelector(".md"); await p.click(".md #ok"); await p.waitForTimeout(700);
  ok((await p.$$(".sec-c.locked")).length === 6, "تثبيت جميع الفصول بعد تأكيد غير المحفوظ");
  await p.goto(`${BASE}/audit.html`); await p.waitForSelector("#al table"); await shot(p, "06-audit");
  ok((await p.textContent("#al")).includes("تصحيح غياب طالب حضر متأخراً"), "السبب ظاهر في سجل العمليات");
  await p.goto(`${BASE}/assignments.html`); await p.waitForSelector("table"); await shot(p, "07-assignments");
  await p.click("#add"); await p.selectOption(".md #as", "00000000-0000-0000-0000-0000000000e7"); await p.selectOption(".md #at", "absence");
  await p.click('.md input[value="00000000-0000-0000-0000-000000000c11"]'); await p.click(".md #ok"); await p.waitForSelector(".md h3:has-text('فصول مسندة لآخرين')");
  ok(true, "التحذير من التعارض في الإسناد"); await shot(p, "08-assign-conflict"); await p.locator(".ov").last().locator("#no").click(); await p.locator(".ov").last().locator("#no").click();
  await p.goto(`${BASE}/settings.html?tab=late`); await p.waitForSelector("#s1"); await shot(p, "09-settings");
  ok(p.errs.length === 0, "لا أخطاء JavaScript (المنسق): " + p.errs.join(" | "));

  // 5) مدخل التأخر
  p = await open(U(4), 1024, 1100);
  await p.goto(`${BASE}/lateness.html`); await p.waitForSelector("#mSearch input");
  await p.fill("#mSearch input", "عبدالله"); await p.waitForSelector("#mSearch .res button");
  await p.click("#mSearch .res button"); await p.fill("#ft", "07:18");
  ok((await p.textContent("#fm")).includes("8"), "حساب 8 دقائق في الواجهة");
  await p.fill("#fd", D);
  await p.selectOption("#fr", { label: "سبب آخر" }); await p.click("#fs");
  ok((await p.textContent("#fe")).includes("اكتب السبب"), "سبب آخر إلزامي في الواجهة");
  await p.fill("#fo", "موعد في المستشفى"); await p.click("#fs"); await p.waitForSelector(".toast");
  await p.fill("#vd", D); await p.dispatchEvent("#vd", "change"); await p.waitForSelector("#vl table");
  ok((await p.textContent("#vl")).includes("موعد في المستشفى"), "سجل التأخر يظهر في القائمة");
  await p.click('[data-m="class"]'); await p.selectOption("#mClass #ps", "00000000-0000-0000-0000-000000000c21"); await p.waitForSelector("#mClassList button");
  await shot(p, "10-lateness");
  ok(p.errs.length === 0, "لا أخطاء JavaScript (التأخر): " + p.errs.join(" | "));

  // 6) شؤون الطلاب: اطلاع فقط، ومنسوب بلا تكليف، وزائر
  p = await open(U(5)); await p.goto(`${BASE}/attendance.html?s=00000000-0000-0000-0000-000000000c31&d=${D}`); await p.waitForSelector("#rl li, #body .empty");
  ok(!(await p.$("#save")), "شؤون الطلاب: لا حفظ"); await shot(p, "11-affairs-readonly");
  p = await open(U(7)); await p.goto(`${BASE}/dashboard.html`); await p.waitForTimeout(800);
  p = await open(null); await p.goto(`${BASE}/dashboard.html`); await p.waitForURL(/login/); ok(true, "الزائر يُحوَّل إلى الدخول"); await shot(p, "12-login");
  await p.goto(`${BASE}/index.html`); await shot(p, "13-index");
  // 7) المرحلتان 5 و6: إشعارات الغياب، ورابط ولي الأمر، والعذر، والاعتماد، والملف، والإجراءات
  p = await open(U(1));
  await p.goto(`${BASE}/messages.html?d=${D}`); await p.waitForSelector("#nd");
  ok((await p.inputValue("#nd")) === D, "صفحة رسائل الغياب تفتح على تاريخ التثبيت");
  await p.fill("#nd", D); await p.dispatchEvent("#nd", "change"); await p.waitForSelector("#ca");
  ok((await p.textContent("#nl")).includes("لا رقم"), "تمييز من لا رقم لولي أمره");
  await p.check("#ca"); await shot(p, "15a-before-queue"); await p.click("#qq"); await p.click(".md #ok"); await p.waitForSelector(".toast");
  ok((await p.textContent(".toast")).includes("بالطابور"), "إدراج إشعارات الغياب في الطابور");
  await shot(p, "15-notify-compose");
  await p.goto(`${BASE}/notifications.html?tab=log`); await p.waitForSelector("#ll table");
  ok((await p.textContent("#ll")).includes("بانتظار الإرسال") && !(await p.textContent("#ll")).includes("قبلها واتساب"), "لا يُدّعى الإرسال قبل الربط");
  await shot(p, "16-notify-log");
  const sid = require("child_process").execFileSync("psql", ["-U", "postgres", "-d", "indibati_e2e", "-tAc", `select student_id from ind_attendance_records where day = '${D}' and student_id in (select student_id from student_guardians) order by student_id limit 1`], { encoding: "utf8" }).trim();
  await p.goto(`${BASE}/student.html?id=${sid}`); await p.waitForSelector("#gl"); await p.click("#gl"); await p.waitForSelector(".md input[readonly]");
  const link = await p.inputValue(".md input[readonly]"); ok(/guardian\.html\?t=[0-9a-f]{64}$/.test(link), "إنشاء رابط ولي الأمر الآمن");
  await shot(p, "17-student-file");
  const g = await open(null, 430, 1000);
  await g.goto(`${BASE}/guardian.html?t=${link.split("?t=")[1]}`); await g.waitForSelector(".abs-l, .card");
  ok(!(await g.url()).includes("?t="), "إزالة الرمز من شريط العنوان");
  const hasAbs = await g.$("[data-i]");
  if (hasAbs) {
    await g.click("[data-i]"); await g.selectOption(".md #gr", { index: 1 }); await g.fill(".md #gd", "كان مريضاً");
    await g.setInputFiles(".md #gf", { name: "excuse.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await g.click(".md #ok"); await g.waitForSelector(".toast"); ok((await g.textContent(".toast")).includes("وصل"), "ولي الأمر يقدم العذر بمرفق");
  } else ok(false, "لا غياب للطالب في البوابة");
  await shot(g, "18-guardian");
  ok(g.errs.length === 0, "لا أخطاء JavaScript (ولي الأمر): " + g.errs.join(" | "));
  const g2 = await open(null); await g2.goto(`${BASE}/guardian.html?t=${"0".repeat(64)}`); await g2.waitForSelector(".err"); ok((await g2.textContent(".err")).includes("غير صالح"), "رفض الرابط غير الصالح");
  await p.goto(`${BASE}/dashboard.html`); await p.waitForSelector('.dnav-in a[href="excuses.html"] .bdg');
  ok((await p.textContent('.dnav-in a[href="excuses.html"] .bdg')) === "1", "شارة الأعذار: عذر واحد لم يُبت فيه");
  await p.goto(`${BASE}/excuses.html`); await p.waitForSelector("[data-o]"); await p.click("[data-o]"); await p.waitForSelector(".md [data-d=approved]");
  await shot(p, "19-excuse-review"); await p.click(".md [data-d=approved]"); await p.waitForSelector(".toast");
  await p.goto(`${BASE}/student.html?id=${sid}`); await p.waitForSelector(".kgrid");
  ok((await p.textContent(".kgrid")).includes("1غياب بعذر") || (await p.$eval(".kgrid .kpi.k3 b", (b) => b.textContent)) === "1", "الاعتماد يحدّث التصنيف في الملف");
  await p.goto(`${BASE}/escalations.html?tab=rules`); await p.waitForSelector("[data-s]");
  const tr = p.locator("tr[data-id]").first(); await tr.locator("[data-k=days]").fill("1"); await tr.locator("[data-k=mode]").selectOption("all"); await tr.locator("[data-k=active]").check();
  await tr.locator("[data-s]").click(); await p.click(".md #ok"); await p.waitForSelector(".toast");
  await p.goto(`${BASE}/escalations.html?tab=due`); await p.waitForSelector("#tabbody table");
  ok((await p.$$("#tabbody tbody tr")).length >= 1, "إصدار الإجراءات تلقائياً بعد تفعيل القاعدة"); await shot(p, "20-escalations");
  const href = await p.getAttribute("#tabbody a[href^='print.html']", "href");
  await p.goto(`${BASE}/${href}`); await p.waitForSelector(".official"); await shot(p, "21-print");
  ok(p.errs.length === 0, "لا أخطاء JavaScript (المرحلتان 5 و6): " + p.errs.join(" | "));
  // 8) المرحلة 7: التقارير ونقاط الانتظام
  p = await open(U(1));
  await p.goto(`${BASE}/reports.html`); await p.waitForSelector("#rk");
  await p.selectOption("#rk", "absence_list"); await p.selectOption("#rp", "term"); await p.click("#go"); await p.waitForSelector("#rptOut .official");
  ok((await p.$$("#rptOut tbody tr")).length >= 3 && (await p.$("header #rptOut")) === null, "عرض تقرير الغياب منذ بداية العام");
  await shot(p, "22-report");
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click("#xl")]);
  ok(!!dl, "تصدير التقرير إلى Excel/CSV");
  await p.goto(`${BASE}/settings.html?tab=rewards`); await p.waitForSelector("#r1"); await shot(p, "23-rewards");
  ok(p.errs.length === 0, "لا أخطاء JavaScript (المرحلة 7): " + p.errs.join(" | "));
  // جوال
  p = await open(U(2), 390, 844); await p.goto(`${BASE}/attendance.html?s=00000000-0000-0000-0000-000000000c12&d=2026-11-11`); await p.waitForSelector("#rl li"); await shot(p, "14-mobile");
  await br.close(); console.log(fails ? `${fails} FAILED` : "ALL_E2E_PASSED"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
