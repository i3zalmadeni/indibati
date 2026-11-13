// بديل محلي لمكتبة supabase-js أثناء المعاينة: المستخدم يُختار من localStorage (preview_user).
window.supabase = { createClient: () => {
  const user = () => localStorage.getItem("preview_user");
  return {
    auth: {
      getSession: async () => ({ data: { session: user() ? { user: { id: user() }, access_token: "preview" } : null } }),
      signOut: async () => { localStorage.removeItem("preview_user"); return {}; },
      signInWithPassword: async () => ({ error: { status: 400, code: "invalid_credentials" } }),
    },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }) }) },
    rpc: async (fn, args) => {
      const r = await fetch("/rpc/" + fn, { method: "POST", headers: { "content-type": "application/json", "x-user": user() || "" }, body: JSON.stringify(args || {}) });
      const j = await r.json(); return r.ok ? { data: j, error: null } : { data: null, error: j };
    },
  };
} };
