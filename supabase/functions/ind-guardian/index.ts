// انضباطي · رفع مرفقات عذر الغياب من بوابة ولي الأمر (دون حساب، بالرمز الآمن فقط).
// يتحقق من الرمز، ومن نوع الملف الفعلي (البايتات الأولى) لا من الامتداد فقط، والحجم، ثم يرفع إلى حاوية خاصة
// في مجلد الطالب نفسه. لا يعيد إلا مسار الملف، ويُربط بالعذر في دالة ind_g_submit_excuse.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGINS = (Deno.env.get("IND_ALLOWED_ORIGINS") ?? "https://i3zalmadeni.github.io").split(",");
const MAX = 5 * 1024 * 1024, PER_HOUR = 10;

const cors = (o: string | null) => ({
  "access-control-allow-origin": o && ORIGINS.includes(o) ? o : ORIGINS[0],
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  vary: "origin",
});
// التعرف على النوع من التوقيع الثنائي
function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  const h = (n: number) => [...b.slice(0, n)].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (h(4) === "25504446") return { mime: "application/pdf", ext: "pdf" };
  if (h(3) === "ffd8ff") return { mime: "image/jpeg", ext: "jpg" };
  if (h(8) === "89504e470d0a1a0a") return { mime: "image/png", ext: "png" };
  if (h(4) === "52494646" && new TextDecoder().decode(b.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

Deno.serve(async (req) => {
  const c = cors(req.headers.get("origin"));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...c, "content-type": "application/json; charset=utf-8" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: c });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const form = await req.formData();
    const token = String(form.get("token") ?? ""), file = form.get("file");
    if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "invalid_link" }, 401);
    const { data: student, error } = await db.rpc("ind_svc_link_student", { p_token: token });
    if (error || !student) return json({ error: "invalid_link" }, 401);
    if (!(file instanceof File)) return json({ error: "file_required" }, 400);
    if (file.size > MAX) return json({ error: "file_too_large" }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const t = sniff(bytes);
    if (!t) return json({ error: "file_type" }, 415);
    // حد للرفع لكل طالب في الساعة منعاً للإغراق
    const { data: list } = await db.storage.from("ind-excuses").list(student, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    const recent = (list ?? []).filter((o) => o.created_at && Date.now() - new Date(o.created_at).getTime() < 3600e3).length;
    if (recent >= PER_HOUR) return json({ error: "rate_limited" }, 429);
    const path = `${student}/${crypto.randomUUID()}.${t.ext}`;
    const up = await db.storage.from("ind-excuses").upload(path, bytes, { contentType: t.mime, upsert: false });
    if (up.error) return json({ error: "upload_failed" }, 500);
    return json({ path, mime: t.mime, size: file.size });
  } catch (e) {
    console.error(e);
    return json({ error: "internal_error" }, 500);
  }
});
