// خادم معاينة محلي: يخدم site/ ويحاكي استدعاءات Supabase RPC بتنفيذها على Postgres المحلي باسم المستخدم المختار.
// للتطوير والاختبار فقط. الاستخدام: node tests/e2e/server.js  (PGHOST/PGPORT/PGDATABASE)
const http = require("http"), fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "../../site"), PORT = +process.env.PORT || 8787;
const psql = (sql) => execFileSync("psql", ["-U", "postgres", "-d", process.env.PGDATABASE || "indibati_e2e", "-tAq", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const SIG = {};
for (const line of psql(`select p.proname || '|' || coalesce(array_to_string(p.proargnames, ','), '') || '|' || coalesce((select string_agg(format_type(t, null), ',' order by o) from unnest(p.proargtypes) with ordinality u(t, o)), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ind\\_%'`).trim().split("\n")) {
  const [n, a, t] = line.split("|"); SIG[n] = Object.fromEntries((a ? a.split(",") : []).map((x, i) => [x, (t || "").split(",")[i]]));
}
const lit = (v) => (v === null || v === undefined ? "null" : `'${(typeof v === "object" ? JSON.stringify(v) : String(v)).replace(/'/g, "''")}'`);
const arr = (v, t) => (Array.isArray(v) ? `array[${v.map(lit).join(",")}]::${t}` : `${lit(v)}::${t}`);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  if (req.url.startsWith("/rpc/")) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const fn = req.url.slice(5).split("?")[0], args = JSON.parse(body || "{}"), sig = SIG[fn];
      if (!sig) { res.writeHead(404); return res.end(JSON.stringify({ message: "function not found" })); }
      const a = Object.entries(args).filter(([k]) => k in sig).map(([k, v]) => `${k} => ${sig[k].endsWith("[]") ? arr(v, sig[k]) : `${lit(v)}::${sig[k]}`}`).join(", ");
      const user = req.headers["x-user"] || "";
      try {
        const out = psql(`select set_config('request.jwt.claim.sub', ${lit(user)}, false); set role ${user ? "authenticated" : "anon"}; select coalesce(to_jsonb(public.${fn}(${a}))::text, 'null');`).trim().split("\n").pop();
        res.writeHead(200, { "content-type": "application/json" }); res.end(out);
      } catch (e) { const m = (e.stderr || "").match(/ERROR:\s+(.*)/); res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ message: m ? m[1].trim() : "error" })); }
    }); return;
  }
  // محاكاة دوال الحافة محلياً
  if (req.url.startsWith("/fn/ind-notify/status")) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ configured: false, webhook: false })); }
  if (req.url.startsWith("/fn/ind-guardian")) {
    let body = Buffer.alloc(0); req.on("data", (c) => (body = Buffer.concat([body, c]))); req.on("end", () => {
      const t = (body.toString("latin1").match(/name="token"\r\n\r\n([0-9a-f]{64})/) || [])[1];
      const st = t ? psql(`set role service_role; select ind_svc_link_student(${lit(t)});`).trim().split("\n").pop() : "";
      if (!st) { res.writeHead(401); return res.end(JSON.stringify({ error: "invalid_link" })); }
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ path: st + "/" + Date.now() + ".pdf", mime: "application/pdf" }));
    }); return;
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log("preview on http://localhost:" + PORT));
