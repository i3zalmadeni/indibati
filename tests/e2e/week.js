// اختبار التحضير الأسبوعي على خادم المعاينة المحلي (tests/e2e/server.js) بمتصفح حقيقي.
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs"), path = require("path");
const BASE = "http://localhost:8787", OUT = process.env.OUT || "/tmp/shots", U = (n) => "00000000-0000-0000-0000-0000000000f" + n;
const MOCK = fs.readFileSync(path.join(__dirname, "mock-supabase.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, n) => { console.log((c ? "PASS: " : "FAIL: ") + n); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const open = async (user, w = 1180, h = 900) => {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, locale: "ar-SA-u-ca-gregory-nu-latn", timezoneId: "Asia/Riyadh" });
    await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: "text/javascript", body: MOCK }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route(/supabase\.co\/functions\/v1\/(.*)/, async (r) => { const u = r.request().url().split("/functions/v1/")[1]; r.fulfill({ response: await r.fetch({ url: BASE + "/fn/" + u }) }); });
    await ctx.addInitScript((u) => { u ? localStorage.setItem("preview_user", u) : localStorage.removeItem("preview_user"); }, user);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message + " @ " + (e.stack || "").split("\n").slice(1, 3).join(" "))); p.on("dialog", (d) => d.accept()); p.errs = errs; return p;
  };
  const shot = async (p, n) => { await p.waitForTimeout(700); return p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };
  let p;
  // 9) التحضير الأسبوعي (المدير ومنسق الغياب)
  const C11 = "00000000-0000-0000-0000-000000000c11", WURL = `${BASE}/attendance.html?v=week&s=${C11}&w=2026-11-15`;
  p = await open(U(1), 1180, 1000);
  await p.goto(`${BASE}/attendance.html`); await p.waitForSelector(".modetabs");
  ok((await p.$$(".modetabs a")).length === 2, "المنسق يرى تبويب التحضير الأسبوعي");
  await p.goto(WURL); await p.waitForSelector("#wk tbody tr");
  ok((await p.$$("#wk tbody tr")).length === 12, "الأسبوعي: جميع طلاب الفصل (12)");
  const heads = await p.$$eval("#wk thead .wk-d", (t) => t.map((x) => x.querySelector("b").textContent));
  ok(heads.join("،") === "الأحد،الاثنين،الثلاثاء،الأربعاء،الخميس", "الأسبوعي: من الأحد إلى الخميس");
  ok(await p.$$eval("#wk thead .wk-d", (t) => t.every((x) => x.querySelector(".wk-dt").textContent.trim() && x.querySelector("small").textContent.trim())), "الأسبوعي: التاريخ الميلادي والهجري تحت اسم اليوم");
  ok((await p.$$eval("#wk thead .wk-d", (t) => t[4].textContent)).includes("لم يحن بعد") && (await p.$$eval('#wk button.wk-c[data-d="2026-11-19"]', (b) => b.length)) === 0, "الأسبوعي: اليوم المستقبلي مقفل ولا خانات فيه");
  ok(await p.$eval("#wsave", (b) => b.disabled), "الأسبوعي: زر الحفظ معطل قبل أي تغيير");
  const cellSel = (n, d) => `#wk tbody tr:nth-child(${n}) button[data-d="${d}"]`;
  await p.click(cellSel(2, "2026-11-15"));  // حاضر -> بعذر
  await p.click(cellSel(3, "2026-11-16")); await p.click(cellSel(3, "2026-11-16"));  // -> بدون عذر
  await p.click(cellSel(3, "2026-11-17")); await p.click(cellSel(3, "2026-11-17"));
  ok((await p.getAttribute(cellSel(2, "2026-11-15"), "data-st")) === "absent_excused" && (await p.getAttribute(cellSel(3, "2026-11-16"), "data-st")) === "absent_unexcused", "الأسبوعي: التبديل بين الحاضر وبعذر وبدون عذر");
  ok((await p.textContent('#wk tbody tr:nth-child(3) [data-t]')).trim() === "2", "الأسبوعي: مجموع غياب الطالب في الأسبوع");
  ok((await p.textContent("#wdirty")).includes("3 من الأيام"), "الأسبوعي: عدد الأيام المتغيرة");
  await shot(p, "24-week-edit");
  await p.click("#wsave"); await p.waitForSelector(".toast"); await p.waitForTimeout(500);
  ok((await p.getAttribute(cellSel(3, "2026-11-16"), "data-st")) === "absent_unexcused" && (await p.textContent("#wdirty")).includes("لا تغييرات"), "الأسبوعي: الحفظ ثم إعادة التحميل من الخادم");
  await p.goto(`${BASE}/attendance.html?s=${C11}&d=2026-11-16`); await p.waitForSelector("#rl li");
  ok((await p.$$eval('#rl li[data-st="absent_unexcused"]', (l) => l.length)) === 1, "الأسبوعي: يظهر الغياب نفسه في التحضير اليومي");
  // تعديل بعد الحفظ
  await p.goto(WURL); await p.waitForSelector("#wk tbody tr");
  await p.click(cellSel(3, "2026-11-16"));   // بدون عذر -> حاضر
  await p.click("#wsave"); await p.waitForSelector(".toast"); await p.waitForTimeout(500);
  ok((await p.getAttribute(cellSel(3, "2026-11-16"), "data-st")) === "present", "الأسبوعي: تعديل تحضير محفوظ");
  // الجميع حاضر على يوم لم يُحضَّر ينشئ جلسة حفظ
  await p.click('button[data-all="2026-11-18"]'); await p.click("#wsave"); await p.waitForSelector(".toast"); await p.waitForTimeout(500);
  ok((await p.$$eval("#wk thead .wk-d", (t) => t[3].textContent)).includes("محفوظ"), "الأسبوعي: «الجميع حاضر» يحفظ اليوم");
  // يوم مثبت للقراءة فقط
  await p.evaluate((id) => rpc("ind_lock", { p_day: "2026-11-16", p_scope: "list", p_sections: [id] }), C11);
  await p.goto(WURL); await p.waitForSelector("#wk tbody tr");
  ok(await p.$eval(cellSel(2, "2026-11-16"), (b) => b.disabled) && !(await p.$('button[data-all="2026-11-16"]')) && !!(await p.$('a[href="locks.html?d=2026-11-16"]')), "الأسبوعي: اليوم المثبت للقراءة فقط مع رابط إلغاء التثبيت");
  await shot(p, "25-week-locked");
  // الانتقال بين الأسابيع
  await p.click("#wPrev"); await p.waitForSelector("#wk tbody tr"); await p.waitForTimeout(300);
  ok((await p.inputValue("#wDate")) === "2026-11-08", "الأسبوعي: الأسبوع السابق");
  await p.click("#wNow"); await p.waitForTimeout(500);
  ok((await p.inputValue("#wDate")) === "2026-11-15" && await p.$eval("#wNext", (b) => b.disabled), "الأسبوعي: هذا الأسبوع ولا انتقال لأسبوع مستقبلي");
  ok(p.errs.length === 0, "لا أخطاء JavaScript (التحضير الأسبوعي): " + p.errs.join(" | "));
  // مدخل الغياب لا يرى التبويب ولا يفتح الأسبوعي
  p = await open(U(2), 1024, 1000); await p.goto(WURL); await p.waitForSelector("#pick");
  ok(!(await p.$(".modetabs")) && !(await p.$("#wk")), "المدخل لا يرى التحضير الأسبوعي");
  p = await open(U(1), 390, 844); await p.goto(WURL); await p.waitForSelector("#wk tbody tr");
  ok((await p.textContent("#shT")).includes("الأسبوعي"), "الأسبوعي: عنوان التبويب الفرعي");
  ok(await p.$eval(".tw", (e) => e.scrollWidth > e.clientWidth) && (await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), "الأسبوعي (جوال): الجدول يتمرر داخل بطاقته دون تمرير الصفحة");
  await shot(p, "26-week-mobile");
  await br.close(); console.log(fails ? `${fails} FAILED` : "ALL_WEEK_E2E_PASSED"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
