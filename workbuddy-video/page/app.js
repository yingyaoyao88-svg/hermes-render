// 时间驱动的渲染器：window.renderAt(t) 根据时间轴把页面画成第 t 秒的样子。
// 所有动画都由 t 计算，不依赖真实时钟，所以逐帧截图是确定的。
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  let TL = null;

  // ---------- 状态计算 ----------
  function locate(t) {
    const scenes = TL.scenes;
    let si = scenes.findIndex((s) => t < s.end);
    if (si < 0) si = scenes.length - 1;
    const scene = scenes[si];
    let li = -1;
    scene.lines.forEach((l, i) => { if (t >= l.start) li = i; });
    return { si, scene, li };
  }

  function stateAt(t) {
    const { si, scene, li } = locate(t);
    const S = {}, since = {}, lineOf = {};
    const apply = (obj, time, idx) => {
      for (const k in obj) {
        const v = obj[k];
        if (v === null) { if (k in S) { delete S[k]; since[k] = time; lineOf[k] = idx; } continue; }
        if (!same(S[k], v)) { S[k] = v; since[k] = time; lineOf[k] = idx; }
      }
    };
    apply(scene.base || {}, scene.start, -1);
    for (let i = 0; i <= li; i++) apply(scene.lines[i].state || {}, scene.lines[i].start, i);
    return { S, since, lineOf, si, scene, li };
  }

  // 某个 key 在最近一次变化之前的值
  function prevVal(st, k) {
    if (!(k in st.since)) return undefined;
    return stateAt(st.since[k] - 1e-3).S[k];
  }

  // ---------- 工具 ----------
  const rectOf = (sel) => {
    const el = sel && $(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const fadeIn = (t, t0, d = 0.35) => ease((t - t0) / d);

  const SEGS = [
    { t: "帮我把", tag: "目标", u: 1 },
    { t: "这份成绩单", tag: "材料", u: 1 },
    { t: "整理成 Excel", tag: "目标", u: 1 },
    { t: "，筛选出不及格的学生、标注成绩区间", tag: "格式", u: 2 },
    { t: "，最后加一行全班的平均分。", tag: "要求", u: 3 },
  ];
  const STUDENTS = [["张三", 92], ["李四", 58], ["王五", 76], ["赵六", 65], ["孙七", 88], ["周八", 45], ["吴九", 69], ["郑十", 81]];
  const band = (s) => s >= 90 ? "优秀 90+" : s >= 80 ? "良好 80-89" : s >= 70 ? "中等 70-79" : s >= 60 ? "及格 60-69" : "不及格 <60";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  function lineEnd(st, idx) {
    const lines = st.scene.lines;
    return idx >= 0 && lines[idx] ? lines[idx].end : st.scene.end;
  }

  // ---------- 各部分渲染 ----------
  function renderApp(t, st) {
    const S = st.S;
    // 主题
    const theme = S.theme || "light";
    $("#window").dataset.theme = theme;
    $$("#themeRow .sw span").forEach((s) => s.classList.toggle("on", s.dataset.v === theme));

    // 模式切换
    let mode = 0;
    if (S.modeCycle) mode = Math.floor((t - st.since.modeCycle) / 1.3) % 3;
    $$("#modes .m").forEach((m, i) => m.classList.toggle("on", i === mode));

    // 输入框打字
    const box = $("#inputText");
    const ty = S.type;
    if (!ty) {
      box.innerHTML = '<span class="ph">描述你要完成的任务，例如：帮我整理这份表格…</span>';
    } else if (ty.plain) {
      const k = clamp((t - st.since.type) / Math.max(0.5, (lineEnd(st, st.lineOf.type) - st.since.type) * 0.75));
      const n = Math.round(ty.plain.length * k);
      box.innerHTML = esc(ty.plain.slice(0, n)) + (k < 1 || Math.floor(t * 2) % 2 ? '<span class="caret"></span>' : "");
    } else {
      const upto = ty.upto;
      const k = ty.done ? 1 : clamp((t - st.since.type) / Math.max(0.5, (lineEnd(st, st.lineOf.type) - st.since.type) * 0.8));
      const cur = SEGS.filter((s) => s.u === upto).reduce((a, s) => a + s.t.length, 0);
      let budget = Math.round(cur * k), html = "";
      for (const s of SEGS) {
        if (s.u > upto) break;
        let txt = s.t;
        if (s.u === upto) { txt = s.t.slice(0, Math.max(0, budget)); budget -= s.t.length; }
        if (!txt) continue;
        const done = s.u < upto || k >= 1;
        html += done ? `<span class="seg t-${s.tag}">${esc(txt)}</span>` : esc(txt);
      }
      box.innerHTML = html + (k < 1 ? '<span class="caret"></span>' : "");
    }

    // 四要素标签
    const tags = $("#tagsRow");
    if (S.tags) {
      tags.innerHTML = ["目标", "材料", "格式", "要求"].map((n, i) =>
        `<span class="tag t-${n}" style="opacity:${fadeIn(t, st.since.tags + i * 0.25)}">✓ ${n}</span>`).join("");
    } else tags.innerHTML = "";

    // 工作空间 / 附件
    $("#wsName").textContent = S.ws || "选择工作空间";
    $("#wsBtn").classList.toggle("set", !!S.ws);
    const pick = $("#wsPick");
    pick.style.display = S.wsPick ? "flex" : "none";
    if (S.wsPick) pick.style.opacity = fadeIn(t, st.since.wsPick + 1.2, 0.4);
    const att = $("#attach");
    att.style.display = S.attach ? "flex" : "none";
    if (S.attach) att.style.opacity = fadeIn(t, st.since.attach + 1.4, 0.4);

    // 菜单跟随按钮定位
    const ws = $("#wsBtn"), plus = $("#plusBtn"), mb = $("#modelBtn"), mm = $("#modelMenu");
    $("#wsMenu").style.top = ws.offsetTop + ws.offsetHeight + 8 + "px";
    $("#plusMenu").style.top = plus.offsetTop + plus.offsetHeight + 8 + "px";
    mm.style.top = mb.offsetTop - mm.offsetHeight - 8 + "px";

    // 菜单
    const menus = { workspace: "#wsMenu", model: "#modelMenu", plus: "#plusMenu", more: "#moreMenu", avatar: "#avatarMenu" };
    for (const [name, sel] of Object.entries(menus)) {
      const el = $(sel);
      let o = 0;
      if (S.menu === name) {
        const delay = S.cursor && st.since.cursor === st.since.menu ? 0.75 : 0;
        o = fadeIn(t, st.since.menu + delay, 0.25);
      }
      el.style.opacity = o;
      el.style.transform = `translateY(${(1 - o) * 8}px)`;
    }

    // 错误提示
    const toast = $("#toast");
    const to = S.toast ? fadeIn(t, st.since.toast, 0.3) : 0;
    toast.style.opacity = to;
    toast.style.transform = `translateX(-50%) translateY(${(1 - to) * -16}px)`;

    // 视图切换
    const chat = S.view === "chat";
    const pv = prevVal(st, "view");
    let co = chat ? 1 : 0;
    if ("view" in st.since && pv !== S.view) {
      const k = fadeIn(t, st.since.view, 0.45);
      co = chat ? k : 1 - k;
    }
    $("#chat").style.opacity = co;
    $("#home").style.opacity = 1 - co;
    $("#h-new").style.display = chat ? "block" : "none";
    $$("#history .h").forEach((h) => h.classList.toggle("active", chat && h.id === "h-new"));
    if (chat || co > 0) renderChat(t, st);
  }

  function renderChat(t, st) {
    const S = st.S;
    const c = S.chat || 0;
    // 执行步骤
    let prog = 0; // 0..3 完成步骤数
    if (c === 0) prog = 0;
    else if (c === 1) prog = clamp((t - st.since.chat) / Math.max(1, (lineEnd(st, st.lineOf.chat) - st.since.chat)), 0, 1) * 2.99;
    else prog = 3;
    $$("#steps .step").forEach((el, i) => {
      el.classList.toggle("done", prog >= i + 1);
      el.classList.toggle("doing", prog >= i && prog < i + 1 && c >= 0);
      el.querySelector(".s").textContent = prog >= i + 1 ? "✓" : "";
      el.style.opacity = c === 0 && i > 0 ? 0.35 : 1;
    });
    $("#done1").style.display = c >= 2 ? "block" : "none";
    $("#u2").style.display = c >= 3 ? "block" : "none";
    $("#a2").style.display = c >= 3 ? "block" : "none";
    if (c >= 3) {
      $("#u2").style.opacity = fadeIn(t, st.since.chat, 0.3);
      $("#a2").style.opacity = fadeIn(t, st.since.chat + 0.6, 0.3);
    }
    // 修改意见输入
    const ct = $("#chatText");
    if (S.reviseType) {
      const msg = "把不及格的标准改成低于 60 分";
      const k = clamp((t - st.since.reviseType - 0.8) / 2.8);
      ct.innerHTML = esc(msg.slice(0, Math.round(msg.length * k))) + '<span class="caret" style="display:inline-block;width:2px;height:20px;background:#4f6bff;vertical-align:-4px"></span>';
    } else ct.innerHTML = '<span class="ph">继续提需求或修改意见…</span>';

    // 预览面板
    const pw = S.preview ? (prevVal(st, "preview") ? 1 : ease((t - st.since.preview) / 0.6)) : 0;
    $("#preview").style.width = pw * 640 + "px";
    const rev = S.rev || 1;
    const line = rev === 2 ? 60 : 70;
    const avg = STUDENTS.reduce((a, s) => a + s[1], 0) / STUDENTS.length;
    $("#table").innerHTML = "<tr><th>姓名</th><th>成绩</th><th>成绩区间</th><th>是否及格</th></tr>" +
      STUDENTS.map(([n, s]) => `<tr class="${s < line ? "fail" : ""}"><td>${n}</td><td>${s}</td><td>${band(s)}</td><td>${s < line ? "✗ 不及格" : "✓"}</td></tr>`).join("") +
      `<tr class="avg"><td>全班平均</td><td>${avg.toFixed(1)}</td><td colspan="2">—</td></tr>`;
    const flash = rev === 2 ? 1 - clamp((t - st.since.rev) / 1.2) : 0;
    $("#table").style.boxShadow = flash > 0 ? `0 0 0 ${4 * flash}px rgba(255,216,77,${flash})` : "none";
    $("#ver").textContent = rev === 2 ? "v2 · 已覆盖" : "v1";
    $("#crit").textContent = `不及格标准：低于 ${line} 分 · 共 ${STUDENTS.filter((s) => s[1] < line).length} 人`;
    const w = $("#warn");
    const wo = S.warn ? fadeIn(t, st.since.warn, 0.3) : 0;
    w.style.opacity = wo; w.style.height = wo > 0 ? "auto" : "0"; w.style.padding = wo > 0 ? "10px 14px" : "0 14px";
    $("#fileTree").style.opacity = S.files ? fadeIn(t, st.since.files, 0.4) : 0;
  }

  // 镜头：把目标元素放大并尽量居中
  function camFor(z) {
    if (!z) return { s: 1, x: 0, y: 0 };
    const [sel, s] = z;
    const el = $(sel);
    if (!el) return { s: 1, x: 0, y: 0 };
    const vp = $("#viewport").getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left - vp.left + r.width / 2, cy = r.top - vp.top + r.height / 2;
    const W = vp.width, H = vp.height;
    return { s, x: clamp(W / 2 - cx * s, W - W * s, 0), y: clamp(H / 2 - cy * s, H - H * s, 0) };
  }

  function renderCamera(t, st) {
    const cam = $("#cam");
    cam.style.transform = "none";
    const cur = camFor(st.S.zoom);
    let c = cur;
    if ("zoom" in st.since) {
      const prev = camFor(prevVal(st, "zoom"));
      const k = ease((t - st.since.zoom) / 0.8);
      c = { s: lerp(prev.s, cur.s, k), x: lerp(prev.x, cur.x, k), y: lerp(prev.y, cur.y, k) };
    }
    cam.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.s})`;
  }

  function renderSpot(t, st) {
    const S = st.S, spot = $("#spot"), call = $("#callout");
    const pad = 10;
    const grow = (r) => {
      if (!r) return null;
      // 聚光框限制在窗口范围内
      const x1 = Math.max(r.x - pad, 166), y1 = Math.max(r.y - pad, 98);
      const x2 = Math.min(r.x + r.w + pad, 1754), y2 = Math.min(r.y + r.h + pad, 948);
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    };
    const cur = grow(rectOf(S.focus));
    const pf = "focus" in st.since ? prevVal(st, "focus") : undefined;
    const prev = grow(rectOf(pf));
    const k = "focus" in st.since ? ease((t - st.since.focus) / 0.6) : 1;
    let r = null, o = 0;
    if (cur && prev) { r = lerpRect(prev, cur, k); o = 1; }
    else if (cur) { r = cur; o = k; }
    else if (prev) { r = prev; o = 1 - k; }
    // 镜头移动时焦点跟随（rectOf 已包含镜头变换，这里只需要平滑）
    if (r) {
      Object.assign(spot.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
    }
    spot.style.opacity = o;

    // 标注气泡
    if (S.label && cur) {
      let html = esc(S.label);
      if (S.big) html = `<span class="big">${esc(S.big)}</span>` + html;
      if (S.phone) html += `<div class="extra">📱 <small>远程</small> ➜ 💻</div>`;
      if (call.dataset.html !== html) { call.innerHTML = html; call.dataset.html = html; }
      const lo = fadeIn(t, Math.max(st.since.label ?? 0, st.since.focus ?? 0) + 0.25, 0.35);
      const b = call.getBoundingClientRect();
      const fr = lerpRect(prev || cur, cur, k);
      let x, y;
      if (fr.w > 450 && fr.h > 450) { x = fr.x + 30; y = fr.y + fr.h - b.height - 30; }
      else if (fr.x + fr.w + 24 + b.width < 1900) { x = fr.x + fr.w + 24; y = fr.y + Math.min(fr.h / 2 - b.height / 2, 40); }
      else if (fr.x - 24 - b.width > 20) { x = fr.x - 24 - b.width; y = fr.y + Math.min(fr.h / 2 - b.height / 2, 40); }
      else { x = fr.x + fr.w / 2 - b.width / 2; y = fr.y - b.height - 20; if (y < 90) y = fr.y + fr.h + 20; }
      x = clamp(x, 20, 1900 - b.width); y = clamp(y, 90, 960 - b.height);
      call.style.left = x + "px"; call.style.top = y + "px";
      call.style.opacity = lo;
      call.style.transform = `translateY(${(1 - lo) * 10}px)`;
    } else {
      call.style.opacity = 0;
    }
  }

  function renderCursor(t, st) {
    const S = st.S, cur = $("#cursor"), rip = $("#ripple");
    const home = { x: 1180, y: 780 };
    let p = null, o = 1;
    if (S.wander) {
      const a = t - st.since.wander;
      p = { x: 1000 + Math.sin(a * 0.9) * 520 - 180, y: 480 + Math.sin(a * 1.7 + 1) * 250 };
      o = fadeIn(t, st.since.wander, 0.3);
    } else if (S.cursor) {
      const tr = rectOf(S.cursor);
      const target = tr ? center(tr) : home;
      const pc = prevVal(st, "cursor");
      const pr = pc && rectOf(pc);
      const from = pr ? center(pr) : { x: target.x + 160, y: target.y + 140 };
      const k = ease((t - st.since.cursor) / 0.7);
      p = { x: lerp(from.x, target.x, k), y: lerp(from.y, target.y, k) };
      o = pr ? 1 : fadeIn(t, st.since.cursor, 0.3);
    } else {
      const pc = prevVal(st, "cursor");
      const pr = pc && rectOf(pc);
      if (pr) { p = center(pr); o = 1 - fadeIn(t, st.since.cursor, 0.3); }
    }
    if (p) {
      cur.style.left = p.x - 6 + "px"; cur.style.top = p.y - 4 + "px";
      cur.style.opacity = o;
    } else cur.style.opacity = 0;

    // 点击波纹
    let ro = 0;
    if (S.click && p && S.cursor) {
      const tc = Math.max(st.since.click, st.since.cursor + 0.7);
      const a = (t - tc) / 0.5;
      if (a >= 0 && a <= 1) {
        ro = 1 - a;
        rip.style.left = p.x + "px"; rip.style.top = p.y + "px";
        rip.style.transform = `scale(${0.3 + a * 0.9})`;
      }
    }
    rip.style.opacity = ro;
  }

  function renderMarkers(t, st) {
    const on = st.S.markers;
    [["#mk1", "#inputBox"], ["#mk2", "#wsBtn"], ["#mk3", "#modelBtn"]].forEach(([m, sel], i) => {
      const el = $(m);
      if (!on) { el.style.opacity = 0; return; }
      const r = rectOf(sel);
      const o = fadeIn(t, st.since.markers + i * 0.45, 0.3);
      el.style.left = r.x - 26 + "px"; el.style.top = r.y - 26 + "px";
      el.style.opacity = o; el.style.transform = `scale(${0.6 + 0.4 * o})`;
    });
    const qs = ["#nav-skill", "#modes", "#plusBtn", "#modelBtn", "#wsBtn"];
    $$(".qm").forEach((el, i) => {
      if (!st.S.confused) { el.style.opacity = 0; return; }
      const r = rectOf(qs[i]);
      const o = fadeIn(t, st.since.confused + 0.4 + i * 0.35, 0.3);
      el.style.left = r.x + r.w - 20 + "px"; el.style.top = r.y - 44 + Math.sin((t + i) * 3) * 4 + "px";
      el.style.opacity = o; el.style.transform = `scale(${0.5 + 0.5 * o})`;
    });
  }

  function renderDiagram(t, st) {
    const S = st.S, d = $("#diagram");
    const on = !!S.diagram;
    let o = on ? fadeIn(t, st.since.diagram, 0.4) : ("diagram" in st.since ? 1 - fadeIn(t, st.since.diagram, 0.4) : 0);
    d.style.opacity = o;
    if (o <= 0) return;
    const step = S.diagStep || 3;
    const t2 = step >= 2 ? (step === 2 ? st.since.diagStep : 0) : Infinity;
    // 机器人移动到“下载”文件夹里
    const dl = $("#dlFolder"), pc = $(".pc");
    const pr = pc.getBoundingClientRect(), fr = dl.getBoundingClientRect();
    const bot = $("#bot");
    const bx = fr.left - pr.left + fr.width / 2 - 30, by = fr.top - pr.top + fr.height - 64;
    bot.style.left = bx + "px"; bot.style.top = by + "px";
    $(".files").style.opacity = step >= 2 ? fadeIn(t, t2, 0.4) : 0;
    const lk = step >= 3 ? fadeIn(t, step === 3 ? st.since.diagStep : 0, 0.4) : 0;
    $$(".fd .lock").forEach((l) => { l.style.opacity = lk; });
    $$(".fd:not(.dl)").forEach((f) => { f.style.opacity = 1 - 0.55 * (step >= 2 ? fadeIn(t, t2, 0.4) : 0); });
    $("#shield").style.opacity = lk;
  }

  function renderCards(t, st) {
    const S = st.S, layer = $("#cards");
    const card = S.card, prev = "card" in st.since ? prevVal(st, "card") : undefined;
    let show = card, o = 1;
    if (card && !prev) o = fadeIn(t, st.since.card, 0.45);
    if (!card && prev) { show = prev; o = 1 - fadeIn(t, st.since.card, 0.45); }
    if (!show) o = 0;
    layer.style.opacity = o;
    $$(".card").forEach((c) => { c.style.display = c.id === "c-" + show ? "flex" : "none"; });
    if (!show) return;
    const el = $("#c-" + show);
    const cs = S.cardStep || 0;
    const tIn = card === show ? st.since.card : 0;
    el.querySelectorAll("[data-step]").forEach((x) => {
      const n = +x.dataset.step;
      let v = 0;
      if (cs >= n) v = cs === n ? fadeIn(t, Math.max(st.since.cardStep ?? 0, tIn), 0.45) : 1;
      if (!card) v = 1;
      x.style.opacity = v;
      x.style.transform = `translateY(${(1 - v) * 24}px)`;
    });
    if (show === "four") {
      el.querySelectorAll(".q").forEach((q) => {
        const n = +q.dataset.q;
        const appear = fadeIn(t, (st.since.card ?? 0) + 0.3 + n * 0.25, 0.4);
        const hot = cs === n;
        q.style.opacity = card ? appear * (cs === 0 || hot ? 1 : 0.45) : 1;
        q.style.transform = `translateY(${(1 - appear) * 30}px) scale(${hot ? 1.08 : 1})`;
        q.style.borderColor = hot ? "var(--c)" : "rgba(255,255,255,.12)";
        q.style.background = hot ? "color-mix(in srgb, var(--c) 22%, transparent)" : "rgba(255,255,255,.07)";
      });
    }
  }

  function renderChrome(t, st) {
    const ch = $("#chapter");
    ch.textContent = st.scene.chapter || "";
    ch.style.opacity = st.scene.chapter ? 1 : 0;
    // 字幕
    const sub = $("#subtitle span");
    const line = st.li >= 0 ? st.scene.lines[st.li] : null;
    if (line && t <= line.end + 0.25) {
      sub.textContent = line.text;
      sub.style.opacity = 1;
    } else sub.style.opacity = 0;
    $("#progress").style.width = (t / TL.duration) * 1920 + "px";
  }

  window.renderAt = function (t) {
    const st = stateAt(t);
    renderApp(t, st);
    renderCamera(t, st);
    renderDiagram(t, st);
    renderSpot(t, st);
    renderMarkers(t, st);
    renderCursor(t, st);
    renderCards(t, st);
    renderChrome(t, st);
  };

  window.initTimeline = function (tl) { TL = tl; };
})();
