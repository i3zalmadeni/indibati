// انضباطي · مركز الإشعارات: إرسال طابور رسائل أولياء الأمور عبر WhatsApp Business Cloud API، واستقبال حالات التسليم.
//
// المسارات:
//   POST /ind-notify/send     يرسل دفعة من الطابور. يستدعيه منسق الغياب (JWT) أو مهمة مجدولة (x-cron-secret).
//   GET  /ind-notify/webhook  تحقق Meta من الـ Webhook.
//   POST /ind-notify/webhook  حالات الرسائل (sent/delivered/read/failed) بتوقيع X-Hub-Signature-256.
//
// المبادئ: لا تُعد الرسالة مرسلة إلا بعد قبول واتساب لها (معرف wamid)، ولا تُعد «وصلت» إلا من الـ Webhook.
// تُستخدم القوالب المعتمدة فقط. أرقام الجوال تُقرأ هنا من الخادم ولا تُعاد إلى أي واجهة. الأسرار من متغيرات البيئة.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const WA_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"), WA_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WA_VERIFY = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN"), WA_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");
const CRON = Deno.env.get("IND_CRON_SECRET"), GRAPH = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v21.0";
const ORIGINS = (Deno.env.get("IND_ALLOWED_ORIGINS") ?? "https://i3zalmadeni.github.io").split(",");

const cors = (o: string | null) => ({ "access-control-allow-origin": o && ORIGINS.includes(o) ? o : ORIGINS[0], "access-control-allow-headers": "authorization, apikey, content-type, x-cron-secret", "access-control-allow-methods": "GET, POST, OPTIONS", vary: "origin" });

// التاريخ بالهجري (أم القرى) مع الميلادي
const fmtDate = (iso: string) => {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  const h = d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const g = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
  return `${h} الموافق ${g}م`;
};
const fmtTime = (hm: string) => { const [h, m] = hm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "صباحاً" : "مساءً"}`; };
const shape = (vars: Record<string, string>) => ({ ...vars, date: vars.date ? fmtDate(vars.date) : "", arrival: vars.arrival ? fmtTime(vars.arrival) : "" });
const render = (body: string, v: Record<string, string>) => body.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
// رقم سعودي إلى الصيغة الدولية
const msisdn = (p: string) => { let d = String(p).replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.startsWith("05")) d = "966" + d.slice(1); if (d.startsWith("5") && d.length === 9) d = "966" + d; return /^\d{10,15}$/.test(d) ? d : null; };

async function isCoordinator(req: Request) {
  const auth = req.headers.get("authorization"); if (!auth) return false;
  const u = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await u.rpc("ind_whoami");
  return !!data?.is_coord;
}

async function sendBatch(limit: number) {
  if (!WA_ID || !WA_TOKEN) return { configured: false, sent: 0, failed: 0, note: "لم تُضبط بيانات WhatsApp Business بعد؛ تبقى الرسائل في الطابور." };
  const { data: batch, error } = await db.rpc("ind_svc_claim", { p_limit: limit });
  if (error) throw error;
  let sent = 0, failed = 0;
  for (const n of batch as any[]) {
    const v = shape(n.vars ?? {}), body = render(n.template.body, v), to = n.phone ? msisdn(n.phone) : null;
    if (!to) { await db.rpc("ind_svc_result", { p_id: n.id, p_status: n.phone ? "failed" : "no_phone", p_body: body, p_error: n.phone ? "invalid_phone" : null }); failed++; continue; }
    if (!n.template.wa_template) { await db.rpc("ind_svc_result", { p_id: n.id, p_status: "failed", p_body: body, p_error: "template_not_linked: اربط القالب بقالب معتمد في WhatsApp Manager" }); failed++; continue; }
    const params = (n.template.wa_params as string[]).map((k) => ({ type: "text", text: String(v[k] ?? "").slice(0, 1000) || "-" }));
    try {
      const r = await fetch(`https://graph.facebook.com/${GRAPH}/${WA_ID}/messages`, {
        method: "POST", headers: { authorization: `Bearer ${WA_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template",
          template: { name: n.template.wa_template, language: { code: n.template.wa_lang || "ar" }, components: params.length ? [{ type: "body", parameters: params }] : [] } }),
      });
      const j = await r.json().catch(() => ({}));
      const wamid = j?.messages?.[0]?.id;
      if (r.ok && wamid) { await db.rpc("ind_svc_result", { p_id: n.id, p_status: "sent", p_body: body, p_provider_id: wamid }); sent++; }
      else { await db.rpc("ind_svc_result", { p_id: n.id, p_status: "failed", p_body: body, p_error: (j?.error?.message ?? `http_${r.status}`).slice(0, 300) }); failed++; }
    } catch (e) {
      // خطأ شبكة: نعيدها للطابور دون ادعاء نجاح أو فشل نهائي
      await db.rpc("ind_svc_result", { p_id: n.id, p_status: "queued", p_body: body, p_error: "network: " + String(e).slice(0, 200) });
    }
  }
  return { configured: true, sent, failed, claimed: (batch as any[]).length };
}

async function validSignature(raw: string, sig: string | null) {
  if (!WA_SECRET || !sig?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WA_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = sig.slice(7); if (a.length !== hex.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ hex.charCodeAt(i); return d === 0;
}

Deno.serve(async (req) => {
  const c = cors(req.headers.get("origin"));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, "content-type": "application/json; charset=utf-8" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: c });
  const u = new URL(req.url), path = u.pathname.split("/ind-notify")[1] ?? u.pathname;
  try {
    if (path.startsWith("/webhook")) {
      if (req.method === "GET") {
        return u.searchParams.get("hub.mode") === "subscribe" && WA_VERIFY && u.searchParams.get("hub.verify_token") === WA_VERIFY
          ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
      }
      const raw = await req.text();
      if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) return new Response("invalid signature", { status: 401 });
      const body = JSON.parse(raw);
      for (const e of body.entry ?? []) for (const ch of e.changes ?? []) for (const s of ch.value?.statuses ?? []) {
        await db.rpc("ind_svc_status", { p_provider_id: s.id, p_status: s.status, p_detail: { error: s.errors?.[0]?.title ?? null, at: s.timestamp } });
      }
      return new Response("ok");
    }
    if (path.startsWith("/send") && req.method === "POST") {
      const cron = CRON && req.headers.get("x-cron-secret") === CRON;
      if (!cron && !(await isCoordinator(req))) return json({ error: "forbidden" }, 403);
      const limit = Math.min(Math.max(Number(u.searchParams.get("limit") ?? 50) || 50, 1), 100);
      return json(await sendBatch(limit));
    }
    if (path.startsWith("/status") && req.method === "GET") return json({ configured: !!(WA_ID && WA_TOKEN), webhook: !!(WA_VERIFY && WA_SECRET) });
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "internal_error" }, 500);
  }
});
