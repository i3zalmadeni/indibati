/* ===== تبديل الدور الموحّد: لوحة المعلم / لوحة منسق النظام =====
   مكوّن واحد متطابق في كل أنظمة النواة الرقمية. يضيف قسم «التبديل بين الأدوار» إلى قائمة الصورة (#ubUP)
   في شريط المستخدم الموحّد، وشارة صغيرة بالدور تحت الصورة. لا يظهر إلا لمن يملك صلاحية منسق النظام.
   التبديل يغيّر العرض فقط؛ الصلاحيات الحقيقية يتحقق منها الخادم كما هي.

   الاستخدام في كل نظام:
     const v = RoleSwitch.view("indibati", uid, canSwitch);      // "coord" | "teacher" (الافتراضي لمن يملك التبديل: coord)
     ... يبني النظام قائمته وصفحاته بحسب v ...
     RoleSwitch.mount({ sys: "indibati", uid, can: canSwitch, view: v, home: { coord: "dashboard.html", teacher: "dashboard.html" } });
   أو onSwitch: (v) => {...} بدل home للأنظمة ذات الصفحة الواحدة. */
(function () {
  if (window.RoleSwitch) return;
  const K = (sys, uid) => "dc_view_" + sys + "_" + (uid || "");
  const IC = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    coord: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  };
  const CSS = `.ub-um .rv-box{padding:4px 0 6px;margin-bottom:4px;border-bottom:1px solid var(--line,#e2edf1)}
.ub-um .rv-h{padding:4px 12px 6px;font-size:.74rem;font-weight:800;color:var(--muted,#71859a)}
.ub-um a.rv-o{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;color:var(--ink,#0d2b45);text-decoration:none;font-weight:700;font-size:.9rem;min-height:44px}
.ub-um a.rv-o::after{display:none}.ub-um a.rv-o:hover{background:var(--soft,#eef8fa);color:var(--ink,#0d2b45)}
.ub-um a.rv-o:focus-visible{outline:3px solid #f0b34a;outline-offset:-2px}
.ub-um .rv-i{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--soft,#eef8fa);color:var(--brand,#0e7c86);flex:none}
.ub-um .rv-i svg{width:18px;height:18px}
.ub-um a.rv-o .rv-tx{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.ub-um a.rv-o .rv-tx small{font-weight:500;font-size:.74rem;color:var(--muted,#71859a)}
.ub-um a.rv-o .rv-ck{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:.8rem;font-weight:800;border:2px solid var(--line,#d5e3e9);color:#fff;flex:none}
.ub-um a.rv-o.on{background:var(--soft,#eef8fa)}
.ub-um a.rv-o.on .rv-ck{background:var(--brand,#0e7c86);border-color:var(--brand,#0e7c86)}
.ub-u{position:relative}
.ub-u .rv-tag{position:absolute;bottom:-6px;inset-inline-start:2px;font-size:.6rem;font-weight:800;line-height:1;padding:3px 6px;border-radius:999px;background:#fff;color:var(--brand,#0e7c86);box-shadow:0 1px 3px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap}
.ub-u .rv-tag.c{background:#f0b34a;color:#3b2a00}
.ub-um a.rv-me{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;color:var(--ink,#0d2b45);text-decoration:none;font-weight:700;font-size:.9rem;min-height:40px}
.ub-um a.rv-me:hover{background:var(--soft,#eef8fa)}.ub-um a.rv-me::after{display:none}
.ub-p.rv-fb .ub-mh{padding:8px 12px 6px;font-size:.78rem;color:var(--muted,#71859a);border-bottom:1px solid var(--line,#e2edf1);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ub-p.ub-um.rv-fb{width:min(270px,calc(100vw - 24px));padding:6px}
@media (max-width:560px){.ub-um a.rv-o .rv-tx small{display:none}}`;
  const RS = (window.RoleSwitch = {
    view(sys, uid, can) { if (!can) return "teacher"; let v = null; try { v = localStorage.getItem(K(sys, uid)); } catch (_) {} return v === "teacher" ? "teacher" : "coord"; },
    save(sys, uid, v) { try { localStorage.setItem(K(sys, uid), v); } catch (_) {} },
    // o: { sys, uid, can, view, coordLabel, teacherLabel, coordDesc, teacherDesc, home: { coord, teacher } | onSwitch(v) }
    mount(o) {
      RS.o = o;
      if (!document.getElementById("rv-css")) { const s = document.createElement("style"); s.id = "rv-css"; s.textContent = CSS; document.head.appendChild(s); }
      // شريط مستخدم قديم بلا قائمة للصورة (الصورة رابط): نبني القائمة نفسها لمن يملك التبديل، وفيها رابط الصورة الأصلي
      const ensure = () => {
        let up = document.getElementById("ubUP"); if (up || !o.can) return up;
        const u = document.querySelector(".ub-u"); if (!u || !u.parentNode) return null;
        const wrap = document.createElement("div"); wrap.className = "ub-n"; u.parentNode.insertBefore(wrap, u); wrap.appendChild(u);
        up = document.createElement("div"); up.className = "ub-p ub-um rv-fb"; up.id = "ubUP"; up.setAttribute("role", "menu"); up.hidden = true;
        const nm = u.getAttribute("title") || "", href = u.getAttribute("href") || "#";
        up.innerHTML = `<div class="ub-mh"></div><a class="rv-me" role="menuitem" href=""><span class="rv-i">${IC.user}</span><span>${o.meLabel || "ملفي"}</span></a>`;
        up.querySelector(".ub-mh").textContent = nm; up.querySelector(".rv-me").setAttribute("href", href);
        wrap.appendChild(up); if (!u.id) u.id = "ubU"; u.setAttribute("aria-haspopup", "true"); u.setAttribute("aria-expanded", "false");
        u.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); const open = up.hidden; document.querySelectorAll(".ub-p").forEach((p) => (p.hidden = true)); up.hidden = !open; u.setAttribute("aria-expanded", String(open)); });
        up.addEventListener("click", (e) => e.stopPropagation());
        document.addEventListener("click", () => { up.hidden = true; u.setAttribute("aria-expanded", "false"); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !up.hidden) { up.hidden = true; u.focus(); } });
        return up;
      };
      const paint = () => {
        ensure();
        const up = document.getElementById("ubUP"), u = document.getElementById("ubU") || document.querySelector(".ub-u");
        if (up) up.querySelector(".rv-box")?.remove();
        if (u) u.querySelector(".rv-tag")?.remove();
        if (!o.can || !up) return !!up;
        const c = o.view === "coord";
        const opt = (v, t, d, i) => { const on = (v === "coord") === c; return `<a class="rv-o${on ? " on" : ""}" role="menuitemradio" aria-checked="${on}" href="#" data-rv="${v}"><span class="rv-i">${IC[i]}</span><span class="rv-tx"><b>${t}</b><small>${d}</small></span><span class="rv-ck" aria-hidden="true">${on ? "✓" : ""}</span></a>`; };
        const box = `<div class="rv-box" role="group" aria-label="الدور"><div class="rv-h">التبديل بين الأدوار</div>${opt("teacher", o.teacherLabel || "معلم", o.teacherDesc || "مهامي ومتابعاتي معلّماً", "user")}${opt("coord", o.coordLabel || "منسق النظام", o.coordDesc || "الاعتماد والمتابعة والإدارة", "coord")}</div>`;
        const mh = up.querySelector(".ub-mh"); if (mh) mh.insertAdjacentHTML("afterend", box); else up.insertAdjacentHTML("afterbegin", box);
        up.querySelectorAll("[data-rv]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); RS.switchTo(a.dataset.rv); }));
        if (u) u.insertAdjacentHTML("beforeend", `<span class="rv-tag ${c ? "c" : "t"}">${c ? "منسق" : "معلم"}</span>`);
        return true;
      };
      // الشريط قد يُرسم بعد الاستدعاء أو يُعاد رسمه: نعيد الإضافة متى غابت
      if (!paint()) { let n = 0; const t = setInterval(() => { if (paint() || ++n > 40) clearInterval(t); }, 150); }
      if (!RS._mo) { RS._mo = new MutationObserver(() => { const up = document.getElementById("ubUP"); if (RS.o && RS.o.can && up && !up.querySelector(".rv-box")) paint(); }); RS._mo.observe(document.documentElement, { childList: true, subtree: true }); }
      RS.paint = paint;
    },
    switchTo(v) {
      const o = RS.o; if (!o || !o.can || v === o.view) return;
      RS.save(o.sys, o.uid, v); o.view = v;
      document.querySelectorAll(".ub-p").forEach((p) => (p.hidden = true));
      if (o.onSwitch) { RS.paint && RS.paint(); o.onSwitch(v); return; }
      const h = (o.home && o.home[v]) || location.pathname.split("/").pop() || "index.html";
      location.href = h;
    },
  });
})();
