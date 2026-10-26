/* 成果展示网站 · 核心：工具函数、滚动渐显、导航、提示框、表格视图、响应式重绘 */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.has('static');                                   // 截图检查：关闭动画，直接显示最终状态
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOANIM = STATIC || RM;
  const root = document.documentElement;
  if (NOANIM) root.classList.add('noanim');
  if (STATIC) root.classList.add('static');
  window.addEventListener('error', e => {
    let b = document.getElementById('err');
    if (!b) { b = document.createElement('div'); b.id = 'err'; document.body.appendChild(b); }
    b.textContent += 'ERR ' + e.message + ' @' + (e.lineno || '') + ':' + (e.colno || '') + '\n';
  });

  /* ---------------- 工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  function S(tag, at, par) {
    const e = document.createElementNS(NS, tag);
    if (at) for (const k in at) if (at[k] != null) e.setAttribute(k, at[k]);
    if (par) par.appendChild(e);
    return e;
  }
  function T(par, x, y, s, cls, at) {
    const e = S('text', Object.assign({ x: x, y: y }, at || {}), par);
    if (cls) e.setAttribute('class', cls);
    e.textContent = s;
    return e;
  }
  function H(tag, cls, par, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (par) par.appendChild(e);
    return e;
  }
  const lin = (d0, d1, r0, r1) => {
    const f = v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
    f.inv = p => d0 + (p - r0) / (r1 - r0) * (d1 - d0);
    return f;
  };
  const rnd = (v, n) => { const k = Math.pow(10, n); return Math.sign(v) * Math.round(Math.abs(v) * k + 1e-7) / k; };
  const fx = (v, n) => rnd(v, n).toFixed(n);                       // 四舍五入，与论文口径一致
  const f3 = v => fx(v, 3);
  const minus = s => String(s).replace(/-/g, '−');
  const sgn = (v, n) => (v > 0 ? '+' : v < 0 ? '−' : '') + fx(Math.abs(v), n);
  const P = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
  // 横向条：圆角只在数据端；竖向柱：h>0 向上、h<0 向下
  function hbar(x, y, w, h, r) {
    if (w <= 0.5) return `M${x},${y}h0.5v${h}h-0.5Z`;
    r = Math.min(r, w, h / 2);
    return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`;
  }
  function vbar(x, y0, w, h, r) {
    const a = Math.abs(h);
    if (a < 0.5) return `M${x},${y0}h${w}v-0.5h-${w}Z`;
    r = Math.min(r, w / 2, a);
    if (h > 0) { const t = y0 - h; return `M${x},${y0}V${t + r}A${r},${r} 0 0 1 ${x + r},${t}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${t + r}V${y0}Z`; }
    const b = y0 + a;
    return `M${x},${y0}V${b - r}A${r},${r} 0 0 0 ${x + r},${b}H${x + w - r}A${r},${r} 0 0 0 ${x + w},${b - r}V${y0}Z`;
  }
  function svgIn(host, w, h) {
    const old = host.querySelector(':scope > svg.viz');
    const s = S('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'viz' });
    if (old) host.replaceChild(s, old); else host.insertBefore(s, host.firstChild);
    return s;
  }
  function svgPt(svg, ev) {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (ev.clientX - r.left) * vb.width / r.width, y: (ev.clientY - r.top) * vb.height / r.height };
  }
  function animIn(svg, delay) {
    svg.classList.remove('go');
    svg.getBoundingClientRect();
    if (NOANIM) svg.classList.add('go');
    else setTimeout(() => svg.classList.add('go'), delay == null ? 40 : delay);
  }
  const narrow = () => innerWidth < 640;

  /* ---------------- 提示框：鼠标悬停 / 手指轻点都能看到数值 ---------------- */
  const tipEl = $('#tip');
  let tipLeave = null;
  const tip = {
    show(ev, title, rows) {
      tipEl.textContent = '';
      if (title) H('div', 'tt', tipEl, title);
      (rows || []).forEach(r => {
        const row = H('div', 'row', tipEl);
        if (r.c) { const k = H('span', 'key', row); k.style.background = r.c; }
        H('span', 'v', row, r.v);
        if (r.l) H('span', 'l', row, r.l);
      });
      tipEl.classList.add('on');
      const w = tipEl.offsetWidth, h = tipEl.offsetHeight, touch = ev.pointerType === 'touch';
      let x = ev.clientX + 16, y = touch ? ev.clientY - h - 26 : ev.clientY + 16;
      if (x + w > innerWidth - 8) x = Math.max(8, ev.clientX - w - 16);
      if (y + h > innerHeight - 8) y = ev.clientY - h - 16;
      if (y < 66) y = ev.clientY + 26;
      tipEl.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    },
    hide() { tipEl.classList.remove('on'); if (tipLeave) { const f = tipLeave; tipLeave = null; f(); } }
  };
  // 绑定悬停：触屏上手指抬起后提示框保留，点别处或滚动时收起
  function hov(el, fn, leave) {
    const on = e => { if (tipLeave && tipLeave !== leave) { const f = tipLeave; tipLeave = null; f(); } tipLeave = leave || null; fn(e); };
    el.addEventListener('pointermove', on);
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') tip.hide(); });
  }
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.vh,.quad,.rk,.race,.wf,.lab,.prof')) tip.hide();
  }, { passive: true });
  addEventListener('scroll', () => { if (tipEl.classList.contains('on')) tip.hide(); }, { passive: true });

  /* ---------------- 表格视图（每张图都有对应的数据表） ---------------- */
  function dataTable(host, head, rows) {
    let box = host.querySelector(':scope > .dtable');
    const was = box && box.classList.contains('on');
    if (box) box.remove();
    box = H('div', 'dtable' + (was ? ' on' : ''), host);
    const tb = H('table', '', box), tr = H('tr', '', H('thead', '', tb));
    head.forEach(x => H('th', '', tr, x));
    const bd = H('tbody', '', tb);
    rows.forEach(r => { const t = H('tr', '', bd); r.forEach(x => H('td', '', t, x)); });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.dbtn[data-tbl]');
    if (!b) return;
    const host = document.getElementById(b.dataset.tbl), box = host && host.querySelector(':scope > .dtable');
    if (!box) return;
    const on = box.classList.toggle('on');
    b.textContent = on ? '图表' : '表格';
  });

  /* ---------------- 模块注册：加载即绘制，进入视野才播放入场动画；宽度变化时重绘 ---------------- */
  const MODS = [];
  function mod(id, o) { MODS.push({ id, o }); }
  function drawMod(m, first) {
    const host = m.el, w = Math.round(host.clientWidth);
    if (!first && w === m.w) return;
    m.w = w;
    m.o.draw(host, w, first);
    if (!first || m.seen) $$('svg.viz', host).forEach(s => { s.classList.add('inst', 'go'); requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('inst'))); });
  }

  /* ---------------- 启动 ---------------- */
  function start() {
    const IMG = window.__IMG || {};
    $$('img[data-img]').forEach(im => { im.src = IMG[im.dataset.img] || ''; im.decoding = 'async'; });
    const setVH = () => root.style.setProperty('--vh', (STATIC ? 900 : innerHeight) + 'px');
    setVH();
    const M = window.MEMBERS || [];
    $$('dd.members').forEach(dd => M.forEach(n => H('span', 'chipn', dd, n)));

    // 图表模块先初始化（部分模块会动态生成带渐显效果的卡片）
    MODS.forEach(m => { m.el = document.getElementById(m.id); });
    MODS.filter(m => m.el).forEach(m => { if (m.o.init) m.o.init(m.el); if (m.o.draw) drawMod(m, true); });

    // 渐显
    if (NOANIM || !('IntersectionObserver' in window)) $$('[data-r]').forEach(e => e.classList.add('in'));
    else {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }),
        { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
      $$('[data-r]').forEach(e => io.observe(e));
    }
    // 数字滚动
    const counter = e => {
      const v = +e.dataset.count, n = +(e.dataset.dec || 0);
      if (NOANIM) { e.textContent = fx(v, n); return; }
      const t0 = performance.now() + 200, dur = 1100;
      const tick = now => { const k = Math.min(1, Math.max(0, (now - t0) / dur)); e.textContent = fx(v * (1 - Math.pow(1 - k, 3)), n); if (k < 1) requestAnimationFrame(tick); };
      e.textContent = fx(0, n); requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window && !NOANIM) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { counter(en.target); io.unobserve(en.target); } }), { threshold: 0.6 });
      $$('[data-count]').forEach(e => io.observe(e));
    } else $$('[data-count]').forEach(counter);

    // 图表入场动画：进入视野时播放
    const play = m => { m.seen = true; $$('svg.viz', m.el).forEach(s => animIn(s, 30)); if (m.o.enter) m.o.enter(m.el); };
    if (NOANIM || !('IntersectionObserver' in window)) MODS.filter(m => m.el).forEach(play);
    else {
      const io = new IntersectionObserver(es => es.forEach(en => {
        const m = MODS.find(x => x.el === en.target);
        if (en.isIntersecting && m && !m.seen) { play(m); }
        if (m && m.o.visible) m.o.visible(en.isIntersecting);
      }), { threshold: 0.18 });
      MODS.filter(m => m.el).forEach(m => io.observe(m.el));
    }
    let rt = 0, lastW = innerWidth;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (innerWidth !== lastW) { lastW = innerWidth; setVH(); }
        MODS.filter(m => m.el && m.o.draw).forEach(m => drawMod(m, false));
        window.dispatchEvent(new Event('deckresize'));
      }, 160);
    });

    // 导航高亮 + 阅读进度 + 视差
    const nav = $('#nav'), links = $$('#nav .nlinks a'), secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
    const pars = $$('[data-par]'), fine = matchMedia('(pointer:fine)').matches && !NOANIM;
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const y = scrollY, vh = innerHeight;
      nav.classList.toggle('solid', y > 30);
      $('#nprog').style.width = (y / Math.max(1, document.documentElement.scrollHeight - vh) * 100) + '%';
      let k = -1;
      secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= 90) k = i; });
      links.forEach((a, i) => a.classList.toggle('on', i === k));
      const on = links[k];
      if (on && narrow()) { const bar = on.parentElement; const l = on.offsetLeft - bar.clientWidth / 2 + on.offsetWidth / 2; if (Math.abs(bar.scrollLeft - l) > 30) bar.scrollTo({ left: l, behavior: 'smooth' }); }
      if (fine) pars.forEach(im => {
        const r = im.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        im.style.setProperty('--py', (-((r.top + r.height / 2) - vh / 2) / vh * 46 - 23).toFixed(1) + 'px');
      });
      window.dispatchEvent(new Event('deckscroll'));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    // 点按钮后失焦，避免手机上留下按压态
    document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && e.pointerType !== 'keyboard' && e.detail) setTimeout(() => b.blur(), 0); });
  }

  window.DK = { $, $$, S, T, H, lin, rnd, fx, f3, minus, sgn, P, hbar, vbar, svgIn, svgPt, animIn, narrow, tip, hov, dataTable, mod, start, STATIC, NOANIM };
})();
/* 成果展示网站 · 模块（一）：共用配色与图表工具、首屏、全流程、数据清洗、权重实验室、TOPSIS */
(function () {
  'use strict';
  const { $, $$, S, T, H, lin, fx, f3, minus, sgn, P, hbar, vbar, svgIn, svgPt, animIn, narrow, tip, hov, dataTable, mod, STATIC, NOANIM } = DK;
  const D = window.DATA, IMG = window.__IMG || {};

  /* 配色：经 validate_palette.js 校验。三维度（科技/数字/绿色）全配对通过；四区域第 4 色为 CVD 下限档，配合直接标注与图例使用 */
  const C = { s1: '#1668B1', s2: '#DD7A12', s3: '#0E8A63', s4: '#D04E8C', pos: '#1668B1', neg: '#D6543F', mute: '#BCD0E4', ink: '#13263A', grey: '#8E9DAE' };
  const DIMS = ['生产保障能力', '投入支撑能力', '风险抵御韧性', '市场与结构稳定'];
  const DIMS2 = ['生产保障', '投入支撑', '风险抵御', '市场稳定'];
  const DIMC = [C.s1, C.s2, C.s3, C.s4];
  const REGS = ['东北', '黄淮海', '长三角', '西南'];
  const REGC = { '东北': C.s1, '黄淮海': C.s2, '长三角': C.s3, '西南': C.s4, '其他': C.mute };
  const PROVREG = { '上海': '长三角', '浙江': '长三角', '云南': '西南', '四川': '西南', '西藏': '西南', '贵州': '西南', '重庆': '西南',
    '吉林': '东北', '辽宁': '东北', '黑龙江': '东北', '安徽': '黄淮海', '山东': '黄淮海', '江苏': '黄淮海', '河北': '黄淮海', '河南': '黄淮海' };
  const regOf = p => PROVREG[p] || '其他';
  const FDIMC = { '科技': C.s1, '数字': C.s2, '绿色': C.s3 };

  function yGrid(g, y, ticks, x0, x1, fmt) {
    ticks.forEach(t => { S('line', { class: 'grid', x1: x0, x2: x1, y1: y(t), y2: y(t) }, g); T(g, x0 - 8, y(t) + 4.5, fmt ? fmt(t) : String(t), 'tick end'); });
  }
  function legend(host, items) {
    host.textContent = '';
    items.forEach(it => {
      const s = H('span', '', host);
      if (it.t !== 'none') {
        const k = H('i', '', s);
        if (it.t === 'line') { k.className = 'lk'; k.style.background = it.dash ? `repeating-linear-gradient(90deg,${it.c} 0 6px,transparent 6px 10px)` : it.c; }
        else if (it.t === 'dot') k.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${it.c}`;
        else { k.className = 'sw'; k.style.background = it.c; }
      }
      s.appendChild(document.createTextNode(it.l));
    });
  }
  function seg(host, labels, on, cb) {
    host.textContent = '';
    labels.forEach((l, k) => {
      const b = H('button', k === on ? 'on' : '', host, l);
      b.type = 'button';
      b.addEventListener('click', () => { $$('button', host).forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(k); });
    });
  }
  // 折线图十字准线：吸附到最近的横轴位置，提示框列出该位置所有序列
  function crosshair(svg, o) {
    const hair = S('line', { class: 'hair', y1: o.y0, y2: o.y1, opacity: 0 }, svg);
    const dg = S('g', {}, svg);
    const hit = S('rect', { class: 'hit', x: o.x0 - 14, y: o.y0, width: o.x1 - o.x0 + 28, height: o.y1 - o.y0 }, svg);
    const clear = () => { hair.setAttribute('opacity', 0); dg.textContent = ''; };
    hov(hit, ev => {
      const p = svgPt(svg, ev); let bi = 0, bd = 1e9;
      for (let i = 0; i < o.n; i++) { const d = Math.abs(o.px(i) - p.x); if (d < bd) { bd = d; bi = i; } }
      const r = o.info(bi), x = o.px(bi);
      hair.setAttribute('x1', x); hair.setAttribute('x2', x); hair.setAttribute('opacity', 1);
      dg.textContent = '';
      (r.dots || []).forEach(d => S('circle', { cx: d.x, cy: d.y, r: 5.5, fill: d.c, class: 'dot' }, dg));
      tip.show(ev, r.title, r.rows);
    }, clear);
  }
  // 散点“最近点”悬停：指针离点 24px 以内即命中
  function nearest(svg, area, getPts, info) {
    const ring = S('circle', { r: 8, fill: 'none', stroke: C.ink, 'stroke-width': 2, opacity: 0, 'pointer-events': 'none' }, svg);
    const hit = S('rect', { class: 'hit', x: area[0], y: area[1], width: area[2] - area[0], height: area[3] - area[1] }, svg);
    hov(hit, ev => {
      const p = svgPt(svg, ev), pts = getPts(); let bi = -1, bd = 576;
      for (let i = 0; i < pts.length; i++) { const dx = pts[i][0] - p.x, dy = pts[i][1] - p.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
      if (bi < 0) { ring.setAttribute('opacity', 0); tip.hide(); return; }
      ring.setAttribute('cx', pts[bi][0]); ring.setAttribute('cy', pts[bi][1]); ring.setAttribute('opacity', 1);
      const r = info(pts[bi][2]); tip.show(ev, r.title, r.rows);
    }, () => ring.setAttribute('opacity', 0));
  }
  function rangeFill(inp, c) {
    const p = (inp.value - inp.min) / (inp.max - inp.min) * 100;
    inp.style.setProperty('--p', p + '%');
    if (c) inp.style.setProperty('--c', c);
  }
  window.DKC = { C, DIMS, DIMS2, DIMC, REGS, REGC, regOf, FDIMC, yGrid, legend, seg, crosshair, nearest, rangeFill };

  /* ================================================================ 首屏：论文页沿弧线缓缓流过 */
  mod('flow', {
    init(el) {
      this.el = el;
      const keys = Object.keys(IMG).filter(k => /^t\d\d$/.test(k)).sort();
      this.cards = keys.map(k => { const d = H('div', 'pg', el); d.style.backgroundImage = `url("${IMG[k]}")`; return d; });
      this.t = 8; this.frame(this.t);
    },
    frame(t) {
      const W = this.el.clientWidth, Hh = this.el.clientHeight, n = this.cards.length, STEP = 236, total = n * STEP, off = (t * 28) % total;
      const cx = W * 0.5, cy = Hh * 0.5;
      this.cards.forEach((c, i) => {
        let x = ((i * STEP - off + total * 3) % total) - total / 2;
        const k = x / (total / 2), ax = Math.abs(k);
        c.style.transform = `translate3d(${(cx + x * 0.52).toFixed(1)}px,${(cy + ax * ax * 70).toFixed(1)}px,${(-ax * 320).toFixed(0)}px) rotateY(${(-k * 52).toFixed(1)}deg)`;
        c.style.opacity = Math.max(0, 1 - ax * 0.75).toFixed(2);
        c.style.zIndex = Math.round(1000 - ax * 100);
      });
    },
    run(on) {
      cancelAnimationFrame(this.raf);
      if (NOANIM || !on) return;
      const t0 = performance.now() - this.t * 1000;
      const loop = now => { this.t = (now - t0) / 1000; this.frame(this.t); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    },
    enter() { this.run(true); },
    visible(v) { this.run(v); }
  });

  /* ================================================================ 全流程步进器 */
  const ICONS = [
    [['ellipse', { cx: 17, cy: 7, rx: 11, ry: 4 }], ['path', { d: 'M6 7v20c0 2.2 4.9 4 11 4s11-1.8 11-4V7' }], ['path', { d: 'M6 17c0 2.2 4.9 4 11 4s11-1.8 11-4' }]],
    [['path', { d: 'M5 25a12 12 0 1 1 24 0' }], ['path', { d: 'M17 25l6-8' }], ['circle', { cx: 17, cy: 25, r: 2 }]],
    [['path', { d: 'M4 29h26' }], ['path', { d: 'M6 23l7-7 6 5 9-11' }], ['path', { d: 'M23 10h5v5' }]],
    [['circle', { cx: 14, cy: 14, r: 8.5 }], ['path', { d: 'M20.5 20.5l8 8' }]],
    [['circle', { cx: 7, cy: 17, r: 3 }], ['circle', { cx: 27, cy: 8, r: 3 }], ['circle', { cx: 27, cy: 26, r: 3 }], ['path', { d: 'M10 17h5l9-8M15 17l9 8' }]],
    [['path', { d: 'M9 31V4' }], ['path', { d: 'M9 5h17l-4 6 4 6H9' }]]];
  const STEPS = [
    ['收集数据', '31 省 × 12 年 × 102 项原始指标', '数据来自《中国统计年鉴》《中国农村统计年鉴》等官方资料。先补齐缺口，再把所有指标统一成“越大越好”，最后压缩到 0—1，才能放在一起比。',
      ['线性插值', '相邻年份结转', '年度均值兜底', '极差标准化'], '1,441', '个缺口被补齐（共 37,944 个数据格）', '#b-miss', '看缺口怎么补'],
    ['打分', '每个省、每一年，一个 0—1 的综合分', '4 个维度、18 项指标。维度权重按理论框架给定，维度内部的权重由熵值法根据数据计算；再用 TOPSIS 算出离“满分省”有多近。',
      ['熵值法', '两阶段赋权', 'TOPSIS'], '372', '个综合得分（31 省 × 12 年）', '#b-lab', '亲手调权重'],
    ['看变化', '时间、空间、未来三个角度', '全国趋势分阶段看；31 省排名与四大粮食区域对比；用 Moran’s I 看“扎堆”现象，用 GM(1,1) 灰色预测外推到 2030 年。',
      ['时序分析', 'Moran’s I', 'GM(1,1)'], '+33.0%', '全国得分 12 年累计增长', '#b-race', '看 12 年排位赛'],
    ['找原因', '谁在推动？作用有多大？', '6 个科技、绿色、数字因素作为输入，六种机器学习模型比赛，随机森林最准；再用 SHAP 把模型的判断拆成每个因素的贡献。',
      ['六模型比选', '随机森林', 'SHAP'], '0.873', '随机森林的预测准确度（测试集 R²）', '#b-shap', '拆开一个省的得分'],
    ['拆渠道', '先改变了什么，再影响粮食安全？', '中介效应三步法检验 6 条路径，每条用 Bootstrap 重抽样 5000 次判断是否可靠，并做两种稳健性检验。',
      ['Baron-Kenny 三步法', 'Bootstrap 5000 次', '稳健性检验'], '4 / 6', '条传导路径通过检验', '#b-med', '看路径与分布'],
    ['提建议', '该先做什么？各地怎么做？', '把四条结论翻译成三条有数据依据的政策建议，并结合四大区域的走势与短板给出差异化方案。',
      ['科技赋能', '绿色筑基', '数字引领', '区域方案'], '3 + 4', '条建议 + 区域方案', '#b-pol', '看建议与时间表']];
  mod('pnodes', {
    init(el) {
      this.btns = STEPS.map((s, k) => {
        const b = H('button', 'pn', el); b.type = 'button';
        const ic = H('span', 'ic', b), sv = S('svg', { viewBox: '0 0 34 34' }, ic);
        ICONS[k].forEach(([tag, at]) => S(tag, at, sv));
        H('span', 'no', b, 'STEP ' + (k + 1)); H('span', 'nm', b, s[0]); H('span', 'bar', b);
        b.addEventListener('click', () => { this.user = true; clearInterval(this.timer); this.show(k); });
        return b;
      });
      this.det = $('#pdet');
      this.show(0);
    },
    show(k) {
      this.k = k;
      this.btns.forEach((b, i) => b.classList.toggle('on', i === k));
      const s = STEPS[k], d = this.det;
      const fill = () => {
        d.textContent = '';
        const l = H('div', '', d);
        H('div', 'pt', l, s[1]); H('div', 'pw', l, s[2]);
        const pm = H('div', 'pm', l); s[3].forEach(x => H('span', 'pill', pm, x));
        const o = H('div', 'po', d);
        H('b', '', o, s[4]); H('span', '', o, s[5]);
        const a = H('a', '', o, s[7] + ' →'); a.href = s[6]; a.style.display = 'block';
        d.classList.remove('sw0');
      };
      if (NOANIM || !d.childNodes.length) fill();
      else { d.classList.add('sw0'); setTimeout(fill, 220); }
    },
    visible(v) {
      clearInterval(this.timer);
      if (v && !this.user && !NOANIM) this.timer = setInterval(() => this.show((this.k + 1) % STEPS.length), 4200);
    }
  });

  /* ================================================================ 数据清洗：37,944 格缺失图（canvas） */
  const TCOL = ['', C.s1, C.s2, C.s3], TNAME = ['', '中间年份 → 线性插值', '首末年份 → 相邻年份结转', '12 年全缺 → 年度均值兜底'];
  mod('misshost', {
    init(host) {
      const M = D.miss;
      this.cv = $('#misscv', host);
      this.cells = [];
      M.rows.forEach((r, ri) => { for (let j = 0; j < r.length; j++) { const t = +r[j]; if (t) this.cells.push([ri, j, t, ((ri * 7919 + j * 104729) % 997) / 997]); } });
      this.prog = [0, 0, 0, 0];
      const lg = $('#misslg');
      const item = (c, l, n) => { const s = H('span', '', lg), k = H('i', 'sw', s); k.style.background = c; s.appendChild(document.createTextNode(l + ' ')); return H('b', '', s, n); };
      item('#E3ECF5', '有数据', '36,503');
      this.left = item('#22364D', '待补缺口', '1,441');
      [1, 2, 3].forEach(t => item(TCOL[t], TNAME[t], M.typ[String(t)].toLocaleString('en-US')));
      this.btn = $('#missbtn');
      this.btn.addEventListener('click', () => this.toggle());
      hov(this.cv, ev => {
        const L = this.L; if (!L) return;
        const r = this.cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
        const bc = Math.floor(x / (L.bw + L.gap)), br = Math.floor(y / L.bh);
        const px = x - bc * (L.bw + L.gap), py = y - br * L.bh - L.lab;
        const blk = br * L.nb + bc, pi = Math.floor(px / L.cw), j = Math.floor(py / L.ch);
        if (bc >= L.nb || blk > 11 || pi < 0 || pi > 30 || j < 0 || j > 101 || px > L.bw) { tip.hide(); return; }
        const t = +D.miss.rows[blk * 31 + pi][j], name = D.miss.names[j];
        tip.show(ev, D.provs[pi] + ' · ' + (2011 + blk) + ' 年', [{ v: name.length > 22 ? name.slice(0, 22) + '…' : name, l: '' },
          { c: t ? TCOL[t] : null, v: t ? '缺失' : '有数据', l: t ? TNAME[t] : '' }]);
      });
    },
    draw(host, w) {
      const gap = 6, lab = 18;
      let nb = 12, cw = 0;
      for (const n of [12, 6, 4, 3, 2]) { nb = n; cw = (w - (n - 1) * gap) / (n * 31); if (cw >= 2.2) break; }
      const ch = Math.max(2, Math.min(3.2, cw * 1.1)), bw = cw * 31, bands = 12 / nb, bh = lab + 102 * ch + 12;
      const h = Math.ceil(bands * bh - 12), dpr = Math.min(2, window.devicePixelRatio || 1);
      this.L = { nb, cw, ch, bw, bh, lab, gap, h, w, dpr };
      const cv = this.cv;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      // 底图（有数据 + 全部缺口）画到离屏画布，动画时只叠加已补的格子
      const base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
      const g = base.getContext('2d'); g.scale(dpr, dpr);
      g.font = '12px ' + getComputedStyle(document.body).fontFamily; g.fillStyle = '#7D8C9D'; g.textBaseline = 'top';
      for (let b = 0; b < 12; b++) {
        const x0 = (b % nb) * (bw + gap), y0 = Math.floor(b / nb) * bh;
        g.fillStyle = '#7D8C9D'; g.fillText(String(2011 + b), x0, y0 + 1);
        g.fillStyle = '#E3ECF5'; g.fillRect(x0, y0 + lab, bw, 102 * ch);
      }
      g.fillStyle = '#22364D';
      this.cells.forEach(c => { const p = this.pos(c); g.fillRect(p[0], p[1], cw + 0.25, ch + 0.25); });
      this.base = base;
      this.paint();
    },
    pos(c) {
      const L = this.L, b = Math.floor(c[0] / 31), pi = c[0] % 31;
      return [(b % L.nb) * (L.bw + L.gap) + pi * L.cw, Math.floor(b / L.nb) * L.bh + L.lab + c[1] * L.ch];
    },
    paint() {
      const L = this.L, g = this.cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); if (this.base.width && this.base.height) g.drawImage(this.base, 0, 0);
      g.scale(L.dpr, L.dpr);
      let left = 0;
      this.cells.forEach(c => {
        if (this.prog[c[2]] > c[3]) { const p = this.pos(c); g.fillStyle = TCOL[c[2]]; g.fillRect(p[0], p[1], L.cw + 0.25, L.ch + 0.25); }
        else left++;
      });
      this.left.textContent = left.toLocaleString('en-US');
    },
    toggle() {
      cancelAnimationFrame(this.raf);
      if (this.filled) { this.filled = false; this.prog = [0, 0, 0, 0]; this.paint(); this.btn.textContent = '一键补齐'; return; }
      this.filled = true; this.btn.textContent = '还原';
      if (NOANIM) { this.prog = [0, 2, 2, 2]; this.paint(); return; }
      const t0 = performance.now(), W = [[1, 0, 900], [2, 600, 1900], [3, 1700, 2500]];
      const tick = now => {
        const t = now - t0;
        W.forEach(([k, a, b]) => { this.prog[k] = Math.max(0, Math.min(1.01, (t - a) / (b - a))); });
        this.paint();
        if (t < 2550) this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
  });

  /* ================================================================ 权重实验室：拖动维度权重，网页端重算 TOPSIS */
  const PRESETS = [['论文方案', [40, 25, 20, 15]], ['等权', [25, 25, 25, 25]], ['偏生产', [70, 10, 10, 10]], ['偏投入', [10, 70, 10, 10]], ['偏韧性', [10, 10, 70, 10]], ['偏市场', [10, 10, 10, 70]]];
  mod('b-lab', {
    init() {
      const L = D.lab, NI = L.ind.length, NR = 372, Z = Float64Array.from(L.Z), PV = D.provs;
      this.NI = NI; this.NR = NR; this.Z = Z;
      this.yi = 11; this.dw = [40, 25, 20, 15]; this.sel = '四川';
      this.base = this.score([40, 25, 20, 15]);
      this.baseRank = this.ranks(this.base);
      // 预设
      seg($('#labpre'), PRESETS.map(p => p[0]), 0, k => this.set(PRESETS[k][1].slice(), true));
      // 滑块
      const sl = $('#labsl');
      this.sls = DIMS2.map((d, k) => {
        const row = H('div', 'sl', sl), lb = H('label', '', row), sw = H('span', 'sw', lb);
        sw.style.background = DIMC[k]; lb.appendChild(document.createTextNode(d));
        const inp = H('input', '', row); inp.type = 'range'; inp.min = 0; inp.max = 100; inp.step = 1; inp.value = this.dw[k];
        inp.setAttribute('aria-label', d + '维度权重');
        const out = H('output', '', row);
        inp.addEventListener('input', () => { this.dw[k] = +inp.value; this.set(this.dw, false); });
        lb.htmlFor = inp.id = 'lab' + k;
        return { inp, out };
      });
      // 18 项指标权重
      const iw = $('#labiw');
      this.irows = [];
      DIMS.forEach((d, k) => {
        const hd = H('div', 'ig', iw), sw = H('span', 'sw', hd); sw.style.background = DIMC[k];
        hd.appendChild(document.createTextNode(d + ' '));
        const hv = H('span', 'muted', hd);
        L.ind.forEach((nm, j) => {
          if (L.dim[j] !== k) return;
          const r = H('div', 'ir', iw); H('span', '', r, nm);
          const tr = H('span', '', r), bar = H('i', '', tr); bar.style.background = DIMC[k];
          const v = H('span', '', r);
          this.irows.push({ j, bar, v });
        });
        this.irows.push({ head: k, hv });
      });
      // 排名
      const rk = $('#labrk');
      rk.style.height = (31 * 23) + 'px';
      this.rrows = {};
      PV.forEach((p, pi) => {
        const r = H('div', 'rw', rk);
        const rn = H('span', 'rn', r), pv = H('span', 'pv', r, p), tr = H('span', 'tr', r), bar = H('i', '', tr), vv = H('span', 'vv', r), dl = H('span', 'dl', r);
        hov(r, ev => {
          const s = this.cur[pi * 12 + this.yi], dm = D.pdims[p][this.yi];
          tip.show(ev, p + ' · ' + (2011 + this.yi) + ' 年', [{ v: f3(s), l: '当前方案得分' },
            { v: '第 ' + (this.curRank[this.yi][pi] + 1) + ' 名', l: '（论文方案第 ' + (this.baseRank[this.yi][pi] + 1) + ' 名）' }]
            .concat(dm.map((x, k) => ({ c: DIMC[k], v: f3(x), l: DIMS2[k] + '维度分' }))));
        });
        r.addEventListener('click', () => { this.sel = p; this.render(); });
        this.rrows[p] = { r, rn, bar, vv, dl, pi };
      });
      const yr = $('#labyr');
      rangeFill(yr);
      yr.addEventListener('input', () => { this.yi = +yr.value - 2011; $('#labyrv').textContent = yr.value; rangeFill(yr); this.render(); });
      this.set(this.dw, true);
    },
    score(dw) {
      const L = D.lab, NI = this.NI, NR = this.NR, Z = this.Z, sum = dw.reduce((a, b) => a + b, 0) || 1;
      const w = new Float64Array(NI), mx = new Float64Array(NI).fill(-1e9), mn = new Float64Array(NI).fill(1e9);
      for (let j = 0; j < NI; j++) w[j] = L.share[j] * dw[L.dim[j]] / sum;
      for (let r = 0; r < NR; r++) for (let j = 0; j < NI; j++) { const v = Z[r * NI + j] * w[j]; if (v > mx[j]) mx[j] = v; if (v < mn[j]) mn[j] = v; }
      const s = new Float64Array(NR);
      for (let r = 0; r < NR; r++) {
        let a = 0, b = 0;
        for (let j = 0; j < NI; j++) { const v = Z[r * NI + j] * w[j]; a += (v - mx[j]) ** 2; b += (v - mn[j]) ** 2; }
        a = Math.sqrt(a); b = Math.sqrt(b); s[r] = (a + b) ? b / (a + b) : 0;
      }
      this.w = w;
      return s;
    },
    ranks(s) {
      const out = [];
      for (let y = 0; y < 12; y++) {
        const o = D.provs.map((p, pi) => pi).sort((a, b) => s[b * 12 + y] - s[a * 12 + y]);
        const r = new Array(31); o.forEach((pi, k) => { r[pi] = k; }); out.push(r);
      }
      return out;
    },
    set(dw, fromPreset) {
      this.dw = dw;
      const sum = dw.reduce((a, b) => a + b, 0) || 1;
      this.sls.forEach((s, k) => { if (fromPreset) s.inp.value = dw[k]; rangeFill(s.inp, DIMC[k]); s.out.textContent = Math.round(dw[k] / sum * 100) + '%'; });
      if (!fromPreset) { const k = PRESETS.findIndex(p => p[1].every((v, i) => Math.abs(v / 100 - dw[i] / sum) < 0.005)); $$('#labpre button').forEach((b, i) => b.classList.toggle('on', i === k)); }
      this.cur = this.score(dw);
      this.curRank = this.ranks(this.cur);
      const wmax = Math.max(0.2, ...this.w);
      this.irows.forEach(r => {
        if (r.head != null) { r.hv.textContent = Math.round(dw[r.head] / sum * 100) + '%'; return; }
        r.bar.style.width = (this.w[r.j] / wmax * 100).toFixed(1) + '%'; r.v.textContent = fx(this.w[r.j], 3);
      });
      this.render();
    },
    render() {
      const y = this.yi, rk = this.curRank[y], br = this.baseRank[y];
      let smax = 0.7;
      D.provs.forEach((p, pi) => { smax = Math.max(smax, this.cur[pi * 12 + y]); });
      D.provs.forEach((p, pi) => {
        const o = this.rrows[p], k = rk[pi], d = br[pi] - k, s = this.cur[pi * 12 + y];
        o.r.style.transform = `translateY(${k * 23}px)`;
        o.rn.textContent = k + 1;
        o.bar.style.width = (s / smax * 100).toFixed(1) + '%';
        o.vv.textContent = f3(s);
        o.dl.textContent = d > 0 ? '↑' + d : d < 0 ? '↓' + (-d) : '—';
        o.dl.style.color = d > 0 ? C.pos : d < 0 ? C.neg : '#B3C0CD';
        o.r.classList.toggle('sel', p === this.sel);
      });
      const sum = this.dw.reduce((a, b) => a + b, 0) || 1;
      const top = D.provs.map((p, pi) => pi).sort((a, b) => rk[a] - rk[b]).slice(0, 5).map(i => D.provs[i]);
      const mv = rk.filter((k, pi) => Math.abs(k - br[pi]) >= 3).length, sp = D.provs.indexOf(this.sel);
      $('#labsum').textContent = '方案：' + DIMS2.map((d, k) => d + ' ' + Math.round(this.dw[k] / sum * 100) + '%').join(' · ') + '。' + (2011 + y) + ' 年前 5 名：' + top.join('、') +
        '；与论文方案相比，' + mv + ' 个省份名次变动 3 位及以上。' + this.sel + '：第 ' + (rk[sp] + 1) + ' 名（论文方案第 ' + (br[sp] + 1) + ' 名）。';
    }
  });

  /* ================================================================ TOPSIS 交互演示 */
  mod('tphost', {
    init() { this.a = 0.66; this.b = 0.58; },
    draw(host, w) {
      const h = Math.round(Math.max(320, Math.min(w * 0.82, 520)));
      const svg = svgIn(host, w, h), padL = 50, padB = 46, padT = 26, padR = 20;
      const side = Math.min(w - padL - padR, h - padT - padB), X0 = padL + (w - padL - padR - side) / 2, X1 = X0 + side, Y0 = padT, Y1 = Y0 + side;
      const x = lin(0, 1, X0, X1), y = lin(0, 1, Y1, Y0);
      const sc = (a, b) => { const dp = Math.hypot(1 - a, 1 - b), dm = Math.hypot(a, b); return { dp, dm, s: dm / (dp + dm) }; };
      const N = 22, cw = side / N, lo = [244, 248, 253], hi = [143, 188, 235];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const s = sc((i + 0.5) / N, (j + 0.5) / N).s, c = lo.map((v, k) => Math.round(v + (hi[k] - v) * s));
        S('rect', { x: X0 + i * cw, y: Y1 - (j + 1) * cw, width: cw + 0.6, height: cw + 0.6, fill: `rgb(${c})` }, svg);
      }
      S('rect', { x: X0, y: Y0, width: side, height: side, fill: 'none', stroke: '#C3CFDC' }, svg);
      [0, 0.5, 1].forEach(t => { T(svg, x(t), Y1 + 20, t, 'tick mid'); T(svg, X0 - 10, y(t) + 4.5, t, 'tick end'); });
      T(svg, (X0 + X1) / 2, Y1 + 40, '指标 A 的标准化得分 →', 'lab2 mid');
      T(svg, 0, 0, '指标 B 的标准化得分 →', 'lab2 mid', { transform: `translate(${X0 - 34},${(Y0 + Y1) / 2}) rotate(-90)` });
      const others = [[.22, .3], [.35, .62], [.48, .22], [.8, .78], [.3, .45], [.85, .5], [.15, .55], [.62, .3], [.42, .84], [.9, .26], [.25, .16], [.7, .9]];
      const og = S('g', {}, svg);
      others.forEach(o => {
        const c = S('circle', { cx: x(o[0]), cy: y(o[1]), r: 6, fill: '#9FB4C9', class: 'dot' }, og);
        hov(c, ev => tip.show(ev, '另一个省（示意）', [{ v: sc(o[0], o[1]).s.toFixed(2), l: '得分 S' }]));
      });
      const lp = S('line', { stroke: C.s2, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'pointer-events': 'none' }, svg);
      const lm = S('line', { stroke: C.s1, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'pointer-events': 'none' }, svg);
      const tp = T(svg, 0, 0, 'D⁺', 'lab'), tm = T(svg, 0, 0, 'D⁻', 'lab');
      const star = Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? 6.5 : 15, a = -Math.PI / 2 + k * Math.PI / 5; return [x(1) + r * Math.cos(a), y(1) + r * Math.sin(a)]; });
      S('path', { d: P(star) + 'Z', fill: C.s2, stroke: '#fff', 'stroke-width': 2 }, svg);
      T(svg, x(1) - 20, y(1) - 2, '满分省', 'lab end');
      S('rect', { x: x(0) - 8, y: y(0) - 8, width: 16, height: 16, rx: 3, fill: '#6F8196', stroke: '#fff', 'stroke-width': 2 }, svg);
      T(svg, x(0) + 16, y(0) - 10, '零分省', 'lab');
      const pl = T(svg, 0, 0, '某省（可拖动）', 'lab', { 'pointer-events': 'none' });
      const knob = S('g', { style: 'cursor:grab;touch-action:none' }, svg);
      S('circle', { r: 26, fill: 'transparent' }, knob);
      S('circle', { r: 11, fill: C.s1, stroke: '#fff', 'stroke-width': 3 }, knob);
      const out = { dp: $('#tpdp'), dm: $('#tpdm'), s: $('#tps'), m: $('#tpm') };
      const set = (a, b) => {
        a = Math.max(0, Math.min(1, a)); b = Math.max(0, Math.min(1, b)); this.a = a; this.b = b;
        const r = sc(a, b), px = x(a), py = y(b);
        knob.setAttribute('transform', `translate(${px.toFixed(1)},${py.toFixed(1)})`);
        [[lp, x(1), y(1)], [lm, x(0), y(0)]].forEach(([l, ex, ey]) => { l.setAttribute('x1', px); l.setAttribute('y1', py); l.setAttribute('x2', ex); l.setAttribute('y2', ey); });
        tp.setAttribute('x', (px + x(1)) / 2 + 10); tp.setAttribute('y', (py + y(1)) / 2 + 2);
        tm.setAttribute('x', (px + x(0)) / 2 + 12); tm.setAttribute('y', (py + y(0)) / 2 + 18);
        const right = px > (X0 + X1) / 2;
        pl.setAttribute('x', px + (right ? -18 : 18)); pl.setAttribute('y', py + 32); pl.setAttribute('class', 'lab' + (right ? ' end' : ''));
        out.dp.textContent = r.dp.toFixed(3); out.dm.textContent = r.dm.toFixed(3);
        out.s.textContent = r.s.toFixed(2); out.m.style.width = (r.s * 100) + '%';
      };
      this.set = set;
      const mv = ev => { const p = svgPt(svg, ev); set(x.inv(p.x), y.inv(p.y)); };
      let drag = false;
      knob.addEventListener('pointerdown', ev => { drag = true; cancelAnimationFrame(this.raf); knob.setPointerCapture(ev.pointerId); ev.preventDefault(); });
      knob.addEventListener('pointermove', ev => { if (drag) mv(ev); });
      knob.addEventListener('pointerup', () => { drag = false; });
      knob.addEventListener('pointercancel', () => { drag = false; });
      // 轻点图中任意位置，圆点跳过去（手机上也好操作）
      svg.addEventListener('click', ev => { if (ev.target.closest('g') === knob) return; cancelAnimationFrame(this.raf); const p = svgPt(svg, ev); if (p.x >= X0 && p.x <= X1 && p.y >= Y0 && p.y <= Y1) mv(ev); });
      set(this.a, this.b);
    },
    enter() {
      if (NOANIM || !this.set) return;
      const a0 = [0.2, 0.26], a1 = [0.66, 0.58], t0 = performance.now() + 300, dur = 1500;
      this.set(a0[0], a0[1]);
      const tick = now => {
        const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.set(a0[0] + (a1[0] - a0[0]) * e, a0[1] + (a1[1] - a0[1]) * e);
        if (k < 1) this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
  });
})();
/* 成果展示网站 · 模块（二）：全国趋势、省际排位赛 + 省份档案、四大区域、空间集聚、灰色预测 */
(function () {
  'use strict';
  const { $, $$, S, T, H, lin, fx, f3, minus, sgn, P, vbar, svgIn, svgPt, animIn, narrow, tip, hov, dataTable, mod, NOANIM } = DK;
  const { C, DIMS2, DIMC, REGS, REGC, regOf, yGrid, legend, seg, crosshair, rangeFill } = DKC;
  const D = window.DATA, YRS = D.years;
  const yearTicks = (all, nw) => nw ? all.filter((t, i) => i % 3 === 0 || i === all.length - 1) : all;
  const lineOf = p => regOf(p) === '其他' ? '#41556B' : REGC[regOf(p)];

  /* ================================================================ 全国趋势 */
  mod('natc', {
    draw(host, w) {
      const nw = narrow(), h = Math.round(Math.max(300, Math.min(w * 0.56, 430))), v = D.nat;
      const svg = svgIn(host, w, h), X0 = nw ? 40 : 54, X1 = w - 14, Y0 = 56, Y1 = h - 30;
      const x = lin(2010.5, 2022.5, X0, X1), y = lin(0.27, 0.42, Y1, Y0);
      D.phases.forEach((p, k) => {
        const a = x(p.a - 0.5), b = x(p.b + 0.5);
        if (k !== 1) S('rect', { x: a, y: Y0 - 50, width: b - a, height: Y1 - Y0 + 50, fill: C.s1, 'fill-opacity': 0.05 }, svg);
        T(svg, (a + b) / 2, Y0 - 30, ['稳步提升期', '结构调整期', '韧性增强期'][k], 'lab mid');
        T(svg, (a + b) / 2, Y0 - 12, (nw ? '+' : '年均 +') + p.g.toFixed(2) + (nw ? '%/年' : '%'), 'lab2 mid');
      });
      yGrid(svg, y, [0.30, 0.35, 0.40], X0, X1, t => t.toFixed(2));
      yearTicks(YRS, nw).forEach(t => T(svg, x(t), Y1 + 20, t, 'tick mid'));
      const pts = YRS.map((t, i) => [x(t), y(v[i])]);
      S('path', { d: P(pts) + `L${pts[11][0]},${Y1}L${pts[0][0]},${Y1}Z`, fill: C.s1, 'fill-opacity': 0.1, class: 'fi' }, svg);
      S('path', { d: P(pts), class: 'ln draw', stroke: C.s1, pathLength: 1 }, svg);
      pts.forEach((p, i) => S('circle', { cx: p[0], cy: p[1], r: 4.5, fill: C.s1, class: 'dot pop', style: `--d:${(0.9 + i * 0.06).toFixed(2)}s` }, svg));
      T(svg, pts[0][0] + 10, pts[0][1] + 24, f3(v[0]), 'big fi');
      T(svg, pts[11][0] - 4, pts[11][1] - 14, f3(v[11]), 'big end fi');
      T(svg, pts[10][0] - (nw ? 10 : 0), pts[10][1] + 30, '2021 年小幅回落', 'lab2 mid fi');
      crosshair(svg, { x0: X0, x1: X1, y0: Y0, y1: Y1, n: 12, px: i => x(YRS[i]),
        info: i => ({ title: YRS[i] + ' 年', dots: [{ x: x(YRS[i]), y: y(v[i]), c: C.s1 }],
          rows: [{ c: C.s1, v: f3(v[i]), l: '全国综合得分' }].concat(i ? [{ v: sgn((v[i] / v[i - 1] - 1) * 100, 2) + '%', l: '较上年' }] : []) }) });
      dataTable(host, ['年份', '全国综合得分', '较上年'], YRS.map((t, i) => [t, f3(v[i]), i ? sgn((v[i] / v[i - 1] - 1) * 100, 2) + '%' : '—']));
    }
  });

  /* ================================================================ 省份档案（随排位赛联动） */
  mod('prof', {
    init(host) {
      this.p = '黑龙江'; this.y = 2022;
      window.DKP = { prov: p => { this.p = p; this.render(host); }, year: y => { this.y = y; this.bars(); } };
    },
    draw(host, w) { this.w = w; this.render(host); },
    render(host) {
      if (!this.w) return;
      const p = this.p, s = D.score[p], rk = D.provs.indexOf(p), nw = narrow();
      host.textContent = '';
      const ph = H('div', 'ph', host); H('b', '', ph, p); H('span', '', ph, regOf(p) === '其他' ? '其他省份' : regOf(p) + '地区');
      const pk = H('div', 'pk', host);
      [['第 ' + (rk + 1) + ' 名', '2022 年排名'], [f3(s[11]), nw ? '2022 年得分' : '2022 年得分（2011 年 ' + f3(s[0]) + '）'], [sgn((s[11] / s[0] - 1) * 100, 1) + '%', '12 年涨幅']]
        .forEach(t => { const d = H('div', '', pk); H('b', '', d, t[0]); H('span', '', d, t[1]); });
      const lg = H('div', 'legend', host);
      legend(lg, [{ l: p, c: lineOf(p), t: 'line' }, { l: '全国平均', c: C.grey, t: 'line' }]);
      const box = H('div', 'vh', host); box.style.margin = '6px 0 4px';
      const sw = this.w - (nw ? 34 : 50), sh = 150, svg = svgIn(box, sw, sh), X0 = 34, X1 = sw - 10, Y0 = 10, Y1 = sh - 22;
      const x = lin(2011, 2022, X0, X1), y = lin(0.1, 0.65, Y1, Y0);
      yGrid(svg, y, [0.2, 0.4, 0.6], X0, X1, t => t.toFixed(1));
      [2011, 2016, 2022].forEach(t => T(svg, x(t), Y1 + 17, t, 'tick mid'));
      S('path', { d: P(YRS.map((t, i) => [x(t), y(D.nat[i])])), class: 'ln', stroke: C.grey, 'stroke-width': 2 }, svg);
      S('path', { d: P(YRS.map((t, i) => [x(t), y(s[i])])), class: 'ln draw', stroke: lineOf(p), pathLength: 1 }, svg);
      animIn(svg, 20);
      crosshair(svg, { x0: X0, x1: X1, y0: Y0, y1: Y1, n: 12, px: i => x(YRS[i]),
        info: i => ({ title: p + ' · ' + YRS[i] + ' 年', dots: [{ x: x(YRS[i]), y: y(s[i]), c: lineOf(p) }, { x: x(YRS[i]), y: y(D.nat[i]), c: C.grey }],
          rows: [{ c: lineOf(p), v: f3(s[i]), l: p }, { c: C.grey, v: f3(D.nat[i]), l: '全国平均' }] }) });
      this.dt = H('div', 'ct', host); this.dt.style.cssText = 'margin:14px 0 4px;font-size:16px';
      this.drows = DIMS2.map((d, k) => {
        const r = H('div', 'dimrow', host), n = H('span', '', r);
        const sw2 = H('i', 'sw', n); sw2.style.cssText += `background:${DIMC[k]};margin-right:7px;vertical-align:-1px`;
        n.appendChild(document.createTextNode(d));
        const tr = H('span', 'tr', r), bar = H('i', '', tr), u = H('u', '', tr); bar.style.background = DIMC[k];
        const b = H('b', '', r);
        hov(r, ev => { const i = this.y - 2011; tip.show(ev, p + ' · ' + DIMS2[k] + ' · ' + this.y + ' 年', [{ c: DIMC[k], v: f3(D.pdims[p][i][k]), l: p }, { v: f3(D.natdims[i][k]), l: '全国平均（黑色竖线）' }]); });
        return { bar, u, b };
      });
      H('div', 'note', host, nw ? '点击排行榜中任一省份切换档案；维度得分跟随所选年份变化。' : '点击左侧任一省份切换档案；维度得分跟随左侧年份变化。');
      this.bars();
    },
    bars() {
      if (!this.drows) return;
      const i = this.y - 2011, v = D.pdims[this.p][i], n = D.natdims[i];
      this.dt.textContent = '四个维度得分（' + this.y + ' 年，竖线为全国平均）';
      this.drows.forEach((r, k) => { r.bar.style.width = (v[k] * 100).toFixed(1) + '%'; r.u.style.left = (n[k] * 100).toFixed(1) + '%'; r.b.textContent = f3(v[k]); });
    }
  });

  /* ================================================================ 31 省排位赛 */
  const RW = 23, VMAX = 0.75;
  mod('racec', {
    init(host) {
      host.style.height = (31 * RW) + 'px';
      this.rows = {}; this.sel = '黑龙江';
      D.provs.forEach(p => {
        const r = H('div', 'rr', host), rn = H('span', 'rn', r); H('span', 'pv', r, p);
        const tr = H('span', 'tr', r), bar = H('i', '', tr), lab = H('em', '', tr);
        bar.style.background = REGC[regOf(p)];
        hov(r, ev => {
          const i = this.y - 2011;
          tip.show(ev, p + ' · ' + this.y + ' 年', [{ c: REGC[regOf(p)], v: f3(D.score[p][i]), l: '综合得分' }, { v: '第 ' + (this.rank[p] + 1) + ' 名', l: '/ 31' },
            { v: regOf(p) === '其他' ? '其他省份' : regOf(p) + '地区', l: '' }]);
        });
        r.addEventListener('click', () => { this.sel = p; this.upd(this.y); if (window.DKP) DKP.prov(p); });
        this.rows[p] = { r, rn, bar, lab };
      });
      this.avg = H('div', 'ravg', host); this.avgl = H('span', '', this.avg);
      this.big = H('div', 'ryr', host); this.big.setAttribute('aria-hidden', 'true'); host.insertBefore(this.big, host.firstChild);
      this.sl = $('#raceyr'); this.btn = $('#raceplay');
      this.sl.addEventListener('input', () => { this.stop(); this.upd(+this.sl.value); });
      this.btn.addEventListener('click', () => { if (this.timer) this.stop(); else this.play(); });
      legend($('#racelg'), REGS.concat(['其他']).map(r => ({ l: r === '其他' ? '其他省份' : r, c: REGC[r] })));
      dataTable(host, ['2022 年排名', '省份', '区域', '2011 年', '2022 年', '12 年涨幅'],
        D.provs.map((p, k) => [k + 1, p, regOf(p), f3(D.score[p][0]), f3(D.score[p][11]), sgn((D.score[p][11] / D.score[p][0] - 1) * 100, 1) + '%']));
      this.upd(NOANIM ? 2022 : 2011);
    },
    upd(y) {
      this.y = y; const i = y - 2011;
      this.sl.value = y; rangeFill(this.sl); $('#raceyrv').textContent = y;
      const ord = D.provs.slice().sort((a, b) => D.score[b][i] - D.score[a][i]);
      this.rank = {};
      ord.forEach((p, k) => {
        this.rank[p] = k;
        const o = this.rows[p], pc = D.score[p][i] / VMAX * 100;
        o.r.style.transform = `translateY(${k * RW}px)`;
        o.rn.textContent = k + 1;
        o.bar.style.width = pc.toFixed(2) + '%';
        o.lab.style.left = `calc(${pc.toFixed(2)}% + 6px)`;
        o.lab.textContent = f3(D.score[p][i]);
        o.lab.style.opacity = (k < 3 || k > 27 || p === this.sel) ? 1 : 0;      // 只标首尾与选中省份
        o.r.classList.toggle('sel', p === this.sel);
      });
      const m = D.nat[i];
      this.avg.style.left = `calc(92px + (100% - 92px) * ${(m / VMAX).toFixed(4)})`;
      this.avgl.textContent = '全国平均 ' + f3(m);
      this.big.textContent = y;
      if (window.DKP) DKP.year(y);
    },
    play() {
      this.stop();
      if (this.y >= 2022) this.upd(2011);
      this.btn.textContent = '❚❚';
      this.timer = setInterval(() => { if (this.y >= 2022) { this.stop(); return; } this.upd(this.y + 1); }, 900);
    },
    stop() { clearInterval(this.timer); this.timer = null; this.btn.textContent = '▶'; },
    enter() { if (!NOANIM && !this.played) { this.played = true; this.wait = setTimeout(() => this.play(), 500); } },
    visible(v) { if (!v) { clearTimeout(this.wait); this.stop(); } }
  });

  /* ================================================================ 四大区域 */
  mod('regc', {
    init() {
      legend($('#reglg'), REGS.map(r => ({ l: r, c: REGC[r], t: 'line' })));
      const avg = r => D.reg[r].reduce((a, b) => a + b, 0) / 12, tb = $('#regtbl');
      const hr = H('tr', '', H('thead', '', tb));
      ['区域', '12 年平均', '2011→2022'].forEach(t => H('th', '', hr, t));
      const bd = H('tbody', '', tb);
      REGS.slice().sort((a, b) => avg(b) - avg(a)).forEach(r => {
        const s = D.reg[r], tr = H('tr', '', bd), td = H('td', '', tr), sp = H('span', '', td), k = H('i', 'lk', sp);
        k.style.background = REGC[r]; sp.appendChild(document.createTextNode(r));
        H('td', '', tr, f3(avg(r))); H('td', '', tr, '+' + fx((s[11] / s[0] - 1) * 100, 1) + '%');
      });
    },
    draw(host, w) {
      const nw = narrow(), h = Math.round(Math.max(290, Math.min(w * 0.62, 420)));
      const svg = svgIn(host, w, h), X0 = nw ? 40 : 52, X1 = w - (nw ? 56 : 66), Y0 = 10, Y1 = h - 28;
      const x = lin(2011, 2022, X0, X1), y = lin(0.22, 0.52, Y1, Y0);
      yGrid(svg, y, [0.25, 0.30, 0.35, 0.40, 0.45, 0.50], X0, X1, t => t.toFixed(2));
      yearTicks(YRS, nw).forEach(t => T(svg, x(t), Y1 + 20, t, 'tick mid'));
      const NUD = { '黄淮海': -7, '东北': 7, '长三角': 0, '西南': 0 };
      REGS.forEach((r, k) => {
        const pts = YRS.map((t, i) => [x(t), y(D.reg[r][i])]), e = pts[11];
        S('path', { d: P(pts), class: 'ln draw', stroke: REGC[r], pathLength: 1, style: `--d:${(k * 0.15).toFixed(2)}s` }, svg);
        S('circle', { cx: e[0], cy: e[1], r: 5, fill: REGC[r], class: 'dot pop', style: `--d:${(1.2 + k * 0.1).toFixed(2)}s` }, svg);
        T(svg, e[0] + 10, e[1] + 5 + NUD[r], r, 'lab fi');
      });
      crosshair(svg, { x0: X0, x1: X1, y0: Y0, y1: Y1, n: 12, px: i => x(YRS[i]),
        info: i => ({ title: YRS[i] + ' 年', dots: REGS.map(r => ({ x: x(YRS[i]), y: y(D.reg[r][i]), c: REGC[r] })),
          rows: REGS.slice().sort((a, b) => D.reg[b][i] - D.reg[a][i]).map(r => ({ c: REGC[r], v: f3(D.reg[r][i]), l: r })) }) });
      dataTable(host, ['年份'].concat(REGS), YRS.map((t, i) => [t].concat(REGS.map(r => f3(D.reg[r][i])))));
    }
  });

  /* ================================================================ Moran's I：按显著性分三档（单一蓝色有序色阶） */
  const RAMP = ['#1668B1', '#4A8BD8', '#86b6ef'], LBL = ['5% 水平显著', '10% 水平显著', '不显著'];
  const lvl = p => p < 0.05 ? 0 : p < 0.1 ? 1 : 2;
  mod('morc', {
    init() { legend($('#morlg'), LBL.map((l, k) => ({ l, c: RAMP[k] }))); },
    draw(host, w) {
      const nw = narrow(), h = Math.round(Math.max(260, Math.min(w * 0.5, 360))), M = D.moran;
      const svg = svgIn(host, w, h), X0 = nw ? 36 : 46, X1 = w - 8, Y0 = 24, Y1 = h - 28;
      const x = lin(2010.5, 2022.5, X0, X1), y = lin(0, 0.36, Y1, Y0), bw = Math.min(24, (X1 - X0) / 12 * 0.62);
      yGrid(svg, y, [0, 0.1, 0.2, 0.3], X0, X1, t => t.toFixed(1));
      S('line', { class: 'axis', x1: X0, x2: X1, y1: Y1, y2: Y1 }, svg);
      M.forEach((m, i) => {
        const cx = x(m.y), b = S('path', { d: vbar(cx - bw / 2, Y1, bw, Y1 - y(m.I), 4), fill: RAMP[lvl(m.p)], class: 'bar v', style: `--d:${(i * 0.05).toFixed(2)}s` }, svg);
        if (!nw || i % 3 === 0 || i === 11) T(svg, cx, Y1 + 20, m.y, 'tick mid');
        if (i === 0 || i === 11) T(svg, cx, y(m.I) - 9, f3(m.I), 'lab mid fi');
        const hit = S('rect', { class: 'bhit', x: cx - (X1 - X0) / 24, y: Y0, width: (X1 - X0) / 12, height: Y1 - Y0 }, svg);
        hov(hit, ev => { b.classList.add('hov'); tip.show(ev, m.y + ' 年', [{ c: RAMP[lvl(m.p)], v: fx(m.I, 4), l: 'Moran’s I' }, { v: 'p = ' + m.p.toFixed(3), l: LBL[lvl(m.p)] }]); },
          () => b.classList.remove('hov'));
        hit.addEventListener('pointerleave', () => b.classList.remove('hov'));
      });
      const n = M.length, mx = M.reduce((a, m) => a + m.y, 0) / n, my = M.reduce((a, m) => a + m.I, 0) / n;
      const sl = M.reduce((a, m) => a + (m.y - mx) * (m.I - my), 0) / M.reduce((a, m) => a + (m.y - mx) ** 2, 0);
      S('line', { x1: x(2011), y1: y(my + sl * (2011 - mx)), x2: x(2022), y2: y(my + sl * (2022 - mx)), stroke: C.ink, 'stroke-width': 1.5, 'stroke-opacity': 0.5, class: 'fi', style: '--d:1s', 'pointer-events': 'none' }, svg);
      T(svg, x(2016.5), Y0 - 6, '趋势：每年 −' + fx(Math.abs(sl), 4), 'lab2 mid fi', { style: '--d:1s' });
      dataTable(host, ['年份', 'Moran’s I', 'p 值', '显著性'], M.map(m => [m.y, fx(m.I, 4), m.p.toFixed(3), LBL[lvl(m.p)]]));
    }
  });
  mod('quad', {
    init(el) {
      const Q = [['LH', '低—高', '自己低、邻居高', '#F1F4F8'], ['HH', '高—高 集聚', '自己高、邻居也高', '#DCE9F7'],
                 ['LL', '低—低 集聚', '自己低、邻居也低', '#FBE9D7'], ['HL', '高—低', '自己高、邻居低', '#F1F4F8']];
      Q.forEach(q => {
        const d = H('div', '', el); d.style.background = q[3];
        H('b', '', d, D.quad[q[0]]); H('em', '', d, q[1]); H('span', '', d, '　' + q[2]);
        hov(d, ev => tip.show(ev, q[1] + '（' + D.quad[q[0]] + ' 个省）', [{ v: D.quadp[q[0]].join('、'), l: '' }]));
      });
    }
  });

  /* ================================================================ 灰色预测 */
  const GMK = ['全国', '东北', '黄淮海', '长三角', '西南'];
  mod('gmc', {
    init(host) {
      this.key = '全国';
      seg($('#gmseg'), GMK, 0, k => { this.key = GMK[k]; this.render(host, true); });
      legend($('#gmlg'), [{ l: '实际值', c: C.s1, t: 'line' }, { l: 'GM(1,1) 拟合值', c: C.grey, t: 'line' }, { l: '预测值（2023—2031）', c: C.s2, t: 'line', dash: 1 }]);
    },
    draw(host, w) { this.w = w; this.render(host, false); },
    render(host, anim) {
      const g = D.gm[this.key], w = this.w, nw = narrow(), h = Math.round(Math.max(290, Math.min(w * 0.56, 420)));
      const svg = svgIn(host, w, h), X0 = nw ? 40 : 52, X1 = w - 12, Y0 = 14, Y1 = h - 28;
      const yrs = YRS.concat(g.fy), all = g.act.concat(g.fit, g.fc);
      const lo = Math.floor((Math.min(...all) - 0.02) * 20) / 20, hi = Math.ceil((Math.max(...all) + 0.03) * 20) / 20;
      const x = lin(2010.5, 2031.5, X0, X1), y = lin(lo, hi, Y1, Y0);
      S('rect', { x: x(2022.5), y: Y0, width: X1 - x(2022.5), height: Y1 - Y0, fill: C.s2, 'fill-opacity': 0.06 }, svg);
      T(svg, (x(2022.5) + X1) / 2, Y1 - 10, '预测期', 'lab2 mid');
      const tk = []; for (let t = lo; t <= hi + 1e-9; t += 0.05) tk.push(+t.toFixed(2));
      yGrid(svg, y, tk, X0, X1, t => t.toFixed(2));
      yrs.forEach((t, i) => { if (nw ? i % 4 === 0 : i % 2 === 0) T(svg, x(t), Y1 + 20, t, 'tick mid'); });
      const pa = YRS.map((t, i) => [x(t), y(g.act[i])]), pf = YRS.map((t, i) => [x(t), y(g.fit[i])]);
      const pc = [[x(2022), y(g.fit[11])]].concat(g.fy.map((t, i) => [x(t), y(g.fc[i])]));
      S('path', { d: P(pf), class: 'ln draw', stroke: C.grey, 'stroke-width': 2, pathLength: 1 }, svg);
      S('path', { d: P(pa), class: 'ln draw', stroke: C.s1, pathLength: 1 }, svg);
      pa.forEach(p => S('circle', { cx: p[0], cy: p[1], r: 4.5, fill: C.s1, class: 'dot fi', style: '--d:.6s' }, svg));
      S('path', { d: P(pc), class: 'ln dash fi', stroke: C.s2, style: '--d:1s' }, svg);
      const i30 = g.fy.indexOf(2030), p30 = [x(2030), y(g.fc[i30])];
      S('circle', { cx: p30[0], cy: p30[1], r: 6.5, fill: C.s2, class: 'dot pop', style: '--d:1.3s' }, svg);
      T(svg, p30[0] - 8, p30[1] - 16, '2030 年 ' + f3(g.fc[i30]), 'big end fi', { style: '--d:1.3s' });
      crosshair(svg, { x0: X0, x1: X1, y0: Y0, y1: Y1, n: yrs.length, px: i => x(yrs[i]),
        info: i => i < 12
          ? { title: yrs[i] + ' 年', dots: [{ x: x(yrs[i]), y: y(g.act[i]), c: C.s1 }], rows: [{ c: C.s1, v: f3(g.act[i]), l: '实际值' }, { c: C.grey, v: f3(g.fit[i]), l: '拟合值' }] }
          : { title: yrs[i] + ' 年（预测）', dots: [{ x: x(yrs[i]), y: y(g.fc[i - 12]), c: C.s2 }], rows: [{ c: C.s2, v: f3(g.fc[i - 12]), l: '预测值' }] } });
      dataTable(host, ['年份', '实际值', '拟合值', '预测值'], yrs.map((t, i) => i < 12 ? [t, f3(g.act[i]), f3(g.fit[i]), ''] : [t, '', '', f3(g.fc[i - 12])]));
      if (anim) animIn(svg, 20);
      const acc = $('#gmacc'), ok = !/不合格/.test(g.grade);
      acc.textContent = '';
      [['后验差比 C', g.C.toFixed(3), '越小越好；< 0.35 为一级'], ['小误差概率 P', g.P.toFixed(3), '越大越好；> 0.95 为一级'], ['平均相对误差', fx(g.mape, 2) + '%', '拟合值与实际值平均差多少']].forEach(r => {
        const d = H('div', 'ar', acc), l = H('span', '', d, r[0]); H('small', '', l, r[2]); H('b', '', d, r[1]);
      });
      const gr = H('div', 'gr', acc); gr.style.background = ok ? '#EEF6EE' : '#FBEDEC';
      H('i', '', gr, ok ? '✔' : '⚠').style.color = ok ? '#0ca30c' : '#d03b3b';
      const gt = H('div', '', gr);
      H('div', '', gt, '精度等级：' + g.grade).style.cssText = 'font-size:17px;font-weight:700';
      H('div', '', gt, ok ? '预测可信，可用于判断趋势' : '序列波动大，预测仅作参考').style.cssText = 'font-size:14.5px;color:var(--ink2)';
      if (i30 >= 0) { const f = H('div', 'note', acc); f.textContent = '2030 年预测：' + f3(g.fc[i30]) + '；2022 年实际：' + f3(g.act[11]) + '。'; }
    }
  });
})();
/* 成果展示网站 · 模块（三）：六个因素、模型比赛、压力测试、SHAP 拆解、重要性、作用方式、协同效应 */
(function () {
  'use strict';
  const { $, $$, S, T, H, lin, fx, f3, minus, sgn, P, hbar, vbar, svgIn, svgPt, animIn, narrow, tip, hov, dataTable, mod, NOANIM } = DK;
  const { C, FDIMC, yGrid, legend, seg, nearest, rangeFill } = DKC;
  const D = window.DATA;
  const SHORT = { '农村科技从业人员': '科技从业人员', '农业技术培训比例': '技术培训', '农村科技投入': '科技投入', '数字基础设施': '数字基础设施', '环保支出占比': '环保支出占比', '森林覆盖率': '森林覆盖率' };
  const FMT = {
    '农业技术培训比例': v => fx(v, 1) + ' 年', '农村科技从业人员': v => fx(v / 1e4, 1) + ' 万人', '农村科技投入': v => fx(v, 0),
    '森林覆盖率': v => fx(v, 1) + '%', '环保支出占比': v => fx(v, 3) + ' 万吨/千公顷', '数字基础设施': v => Math.round(v) + ' 千瓦时/人'
  };
  const dimOf = n => (D.imp.find(r => r.n === n) || {}).d;
  const s4 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fx(Math.abs(v), 4);
  const s3 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fx(Math.abs(v), 3);
  function nice(v) { const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e; }
  window.DKB = { SHORT, FMT };

  /* ================================================================ 6 个因素卡片 */
  const F6 = [
    ['农业技术培训比例', '科技', '农民受教育、受培训的程度', '农村居民平均受教育年限（年）'],
    ['农村科技从业人员', '科技', '懂技术、会用机械的人有多少', '乡村农业机械从业人员（人）'],
    ['农村科技投入', '科技', '财政对农林水和水土治理的投入', '农林水财政支出 × 水土流失治理面积 ÷ 10⁴'],
    ['森林覆盖率', '绿色', '生态底子好不好', '森林覆盖率（%）'],
    ['环保支出占比', '绿色', '种地的碳排放压力，越高压力越大', '农业碳排放强度（万吨/千公顷）'],
    ['数字基础设施', '数字', '农村用电与数字化条件', '人均农业用电量（千瓦时/人）']];
  mod('facs', {
    init(el) {
      F6.forEach((f, k) => {
        const c = H('div', 'card fac', el); c.setAttribute('data-r', ''); c.style.setProperty('--d', (k * 0.05).toFixed(2) + 's');
        const n = H('div', 'fn', c), sw = H('span', 'sw', n); sw.style.background = FDIMC[f[1]];
        n.appendChild(document.createTextNode(f[0])); H('span', 'pill', n, f[1]);
        H('div', 'fd', c, f[2]); H('div', 'fm', c, '测度：' + f[3]);
      });
    }
  });

  /* ================================================================ 直线 vs 台阶（真实数据） */
  mod('linc', {
    init() { legend($('#linlg'), [{ l: '单个样本', c: '#B3C2D1', t: 'dot' }, { l: '直线拟合', c: '#6F8196', t: 'line', dash: 1 }, { l: '五档平均：实际形状', c: C.s1, t: 'line' }]); },
    draw(host, w) {
      const nw = narrow(), h = Math.round(Math.max(270, Math.min(w * 0.64, 390))), dp = D.dep['农村科技从业人员'], lg = Math.log10;
      const svg = svgIn(host, w, h), X0 = nw ? 46 : 54, X1 = w - 10, Y0 = 26, Y1 = h - 42;
      const ys = dp.pts.map(p => p[1]), ym = Math.max(...ys.map(Math.abs)) * 1.1;
      const x = lin(lg(1.2e4), lg(8e6), X0, X1), y = lin(-ym, ym, Y1, Y0);
      yGrid(svg, y, [-0.1, -0.05, 0.05, 0.1], X0, X1, t => minus((t > 0 ? '+' : '') + t.toFixed(2)));
      S('line', { class: 'zero', x1: X0, x2: X1, y1: y(0), y2: y(0) }, svg); T(svg, X0 - 8, y(0) + 4.5, '0', 'tick end');
      (nw ? [[2e4, '2万'], [2e5, '20万'], [2e6, '200万']] : [[2e4, '2 万'], [1e5, '10 万'], [5e5, '50 万'], [2e6, '200 万'], [5e6, '500 万']]).forEach(t => T(svg, x(lg(t[0])), Y1 + 18, t[1], 'tick mid'));
      T(svg, (X0 + X1) / 2, Y1 + 37, '农村科技从业人员（对数刻度）', 'lab2 mid');
      const g = S('g', { class: 'fi' }, svg);
      dp.pts.forEach(p => S('circle', { cx: x(lg(p[0])), cy: y(p[1]), r: 2.8, fill: '#B3C2D1', 'fill-opacity': 0.8 }, g));
      const xs = dp.pts.map(p => lg(p[0])), n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
      const b1 = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / xs.reduce((a, v) => a + (v - mx) ** 2, 0), xa = lg(1.4e4), xb = lg(7e6);
      S('path', { d: P([[x(xa), y(my + b1 * (xa - mx))], [x(xb), y(my + b1 * (xb - mx))]]), class: 'ln dash fi', stroke: '#6F8196', style: '--d:.5s' }, svg);
      const st = []; dp.q.forEach(q => { st.push([x(lg(q.lo)), y(q.m)]); st.push([x(lg(q.hi)), y(q.m)]); });
      S('path', { d: P(st), class: 'ln draw', stroke: C.s1, 'stroke-width': 3, pathLength: 1, style: '--d:.9s' }, svg);
      const th = x(lg(1.38381e6));
      S('line', { x1: th, x2: th, y1: Y0 - 4, y2: Y1, stroke: C.ink, 'stroke-width': 1.2, 'stroke-opacity': 0.5, class: 'fi', style: '--d:1.5s' }, svg);
      T(svg, th - 7, Y0 + 8, '门槛 ≈ 138 万人', 'lab end fi', { style: '--d:1.5s' });
      nearest(svg, [X0, Y0, X1, Y1], () => dp.pts.map((p, i) => [x(lg(p[0])), y(p[1]), i]),
        i => ({ title: D.depk[i] + ' 年', rows: [{ v: FMT['农村科技从业人员'](dp.pts[i][0]), l: '科技从业人员' }, { v: s4(dp.pts[i][1]), l: '对得分的贡献（SHAP）' }] }));
      dataTable(host, ['档位', '区间（人）', '平均贡献'], dp.q.map((q, k) => ['第 ' + (k + 1) + ' 档', Math.round(q.lo).toLocaleString('en-US') + ' — ' + Math.round(q.hi).toLocaleString('en-US'), s4(q.m)]));
    }
  });

  /* ================================================================ 六模型：R² 条形 + 预测散点（联动） */
  const nmOf = m => m.replace(/\(.*\)/, '');
  const MS = () => D.models.slice().sort((a, b) => b.r2 - a.r2);
  let MSEL = '随机森林(RF)';
  const msub = [];
  const mselect = n => { MSEL = n; msub.forEach(f => f(n)); };
  mod('mc', {
    draw(host, w) {
      const ms = MS(), nw = narrow(), X0 = nw ? 92 : 126, X1 = w - (nw ? 50 : 58), h = ms.length * 46 + 26, svg = svgIn(host, w, h), x = lin(0, 1, X0, X1);
      [0, 0.25, 0.5, 0.75, 1].forEach(t => { S('line', { class: 'grid', x1: x(t), x2: x(t), y1: 0, y2: h - 22 }, svg); T(svg, x(t), h - 4, t, 'tick mid'); });
      this.bars = {};
      ms.forEach((m, i) => {
        const yy = 8 + i * 46, g = S('g', { style: 'cursor:pointer' }, svg);
        T(g, X0 - 10, yy + 16, nmOf(m.n), 'lab end');
        const b = S('path', { d: hbar(X0, yy, x(m.r2) - X0, 22, 4), fill: C.mute, class: 'bar', style: `--d:${(i * 0.07).toFixed(2)}s` }, g);
        T(g, x(m.r2) + 8, yy + 16, fx(m.r2, 3), 'lab');
        const hit = S('rect', { class: 'bhit', x: 0, y: yy - 11, width: w, height: 44 }, g);
        hov(hit, ev => tip.show(ev, m.n + '（点击查看预测散点）', [{ v: fx(m.r2, 4), l: 'R²（测试集）' }, { v: fx(m.rmse, 4), l: 'RMSE' }, { v: fx(m.mae, 4), l: 'MAE' }]));
        hit.addEventListener('click', () => mselect(m.n));
        this.bars[m.n] = b;
      });
      this.paint(MSEL);
      if (!this.sub) { this.sub = true; msub.push(n => this.paint(n)); }
      dataTable(host, ['模型', 'R²', 'RMSE', 'MAE'], ms.map(m => [m.n, fx(m.r2, 4), fx(m.rmse, 4), fx(m.mae, 4)]));
    },
    paint(n) { Object.keys(this.bars || {}).forEach(k => this.bars[k].setAttribute('fill', k === n ? C.s1 : C.mute)); }
  });
  mod('msc', {
    init() {
      legend($('#msclg'), [{ l: '测试样本（68 个）', c: C.s1, t: 'dot' }, { l: '预测 = 真实（完全准确）', c: '#6F8196', t: 'line' }]);
      msub.push(n => this.sel(n));
    },
    draw(host, w) {
      const h = Math.round(Math.min(w * 0.92, 470)), svg = svgIn(host, w, h), nw = narrow();
      const A0 = nw ? 44 : 56, A1 = w - 12, B0 = 12, B1 = h - 44;
      const tv = D.testp['真实值'], all = [].concat(...Object.values(D.testp));
      const lo = Math.floor(Math.min(...all) * 10) / 10, hi = Math.ceil(Math.max(...all) * 10) / 10;
      const ax = lin(lo, hi, A0, A1), ay = lin(lo, hi, B1, B0);
      for (let t = lo; t <= hi + 1e-9; t += 0.1) {
        const v = +t.toFixed(1);
        S('line', { class: 'grid', x1: A0, x2: A1, y1: ay(v), y2: ay(v) }, svg); T(svg, A0 - 8, ay(v) + 4.5, v.toFixed(1), 'tick end');
        S('line', { class: 'grid', x1: ax(v), x2: ax(v), y1: B0, y2: B1 }, svg); T(svg, ax(v), B1 + 18, v.toFixed(1), 'tick mid');
      }
      S('line', { x1: ax(lo), y1: ay(lo), x2: ax(hi), y2: ay(hi), stroke: '#6F8196', 'stroke-width': 1.5 }, svg);
      T(svg, (A0 + A1) / 2, B1 + 37, '真实得分', 'lab2 mid');
      T(svg, 0, 0, '模型预测得分', 'lab2 mid', { transform: `translate(${A0 - 34},${(B0 + B1) / 2}) rotate(-90)` });
      this.r2t = T(svg, A0 + 14, B0 + 28, '', '', { style: 'font-size:26px;font-weight:700;fill:#13263A' });
      this.r2s = T(svg, A0 + 14, B0 + 50, '', 'lab2');
      const g = S('g', {}, svg);
      this.dots = tv.map((v, i) => {
        const gg = S('g', { style: 'transition:transform .8s cubic-bezier(.2,.7,.2,1)' }, g);
        S('circle', { r: 5.5, fill: C.s1, 'fill-opacity': 0.85, class: 'dot pop', style: `--d:${(0.2 + i * 0.01).toFixed(2)}s` }, gg);
        return gg;
      });
      this.ax = ax; this.ay = ay; this.tv = tv;
      nearest(svg, [A0, B0, A1, B1], () => tv.map((v, i) => [ax(v), ay(D.testp[MSEL][i]), i]), i => {
        const pv = D.testp[MSEL][i];
        return { title: '测试样本 #' + (i + 1) + ' · ' + nmOf(MSEL), rows: [{ v: f3(tv[i]), l: '真实得分' }, { v: f3(pv), l: '预测得分' }, { v: sgn(pv - tv[i], 3), l: '误差' }] };
      });
      this.sel(MSEL);
    },
    sel(n) {
      if (!this.dots) return;
      const m = D.models.find(r => r.n === n), pv = D.testp[n];
      this.dots.forEach((d, i) => { d.style.transform = `translate(${this.ax(this.tv[i]).toFixed(1)}px,${this.ay(pv[i]).toFixed(1)}px)`; });
      this.r2t.textContent = 'R² = ' + fx(m.r2, 3);
      this.r2s.textContent = 'RMSE = ' + fx(m.rmse, 4) + '　点越贴近斜线越准';
      $('#mscT').textContent = nmOf(n) + '：预测值 vs 真实值';
    }
  });

  /* ================================================================ 四种压力测试（同一把 R² 尺子） */
  const BASE = 0.8726;
  mod('rob', {
    init(el) {
      const P4 = [
        ['换题再考', '3 / 5 / 10 折交叉验证的平均 R²', '0.869 – 0.898', D.cv.map(r => [r.k + ' 折', r.r2]), '分成几份轮流当考题，成绩都很稳定', 0],
        ['换 10 次分组', '10 次随机重新划分训练 / 考试题', '0.889 ± 0.028', [['10 次平均', 0.8887, 0.0281]], '不依赖某一次“运气好”的分组', 0],
        ['删掉部分样本', '随机删掉 5% / 10% 的训练样本', '仅降 1.0% / 1.5%', D.drop.map(r => [r.n.replace('剔除', '删 ').replace('样本', ''), r.r2]), '不依赖个别特殊省份', 0],
        ['故意加干扰', '给输入数据加入小 / 大的随机噪声', '降 9.4% / 18.9%', D.noise.map((r, k) => [['无噪声', '小噪声', '大噪声'][k], r.r2]), '数据越“脏”越不准，符合常理', 1]];
      this.P4 = P4; this.hosts = [];
      P4.forEach((p, k) => {
        const c = H('div', 'card', el); c.setAttribute('data-r', ''); c.style.setProperty('--d', (k * 0.06).toFixed(2) + 's');
        const t = H('div', 'rt', c); H('i', '', t, String(k + 1)); t.appendChild(document.createTextNode(p[0]));
        H('div', 'rd', c, p[1]); H('div', 'rv', c, p[2]);
        const hh = H('div', 'vh', c); this.hosts.push(hh);
        H('div', 'rm' + (p[5] ? ' w' : ''), c, p[4]);
      });
    },
    draw(el) {
      this.hosts.forEach((host, k) => {
        const p = this.P4[k], w = host.clientWidth, n = p[3].length, h = 40 + n * 44, svg = svgIn(host, w, h);
        const XL = 64, x = lin(0.65, 0.95, XL, w - 8);
        [0.7, 0.8, 0.9].forEach(t => { S('line', { class: 'grid', x1: x(t), x2: x(t), y1: 22, y2: h - 18 }, svg); T(svg, x(t), h - 3, t.toFixed(1), 'tick mid'); });
        S('line', { x1: x(BASE), x2: x(BASE), y1: 16, y2: h - 18, stroke: '#6F8196', 'stroke-width': 1.5 }, svg);
        T(svg, x(BASE), 11, '基准 0.873', 'lab2 mid', { style: 'font-size:12px' });
        p[3].forEach((r, i) => {
          const yy = 44 + i * 44;
          T(svg, XL - 8, yy + 4.5, r[0], 'lab end', { style: 'font-size:13px' });
          if (r[2]) [[x(r[1] - r[2]), x(r[1] + r[2])]].forEach(([a, b]) => {
            S('line', { x1: a, x2: b, y1: yy, y2: yy, stroke: C.s1, 'stroke-width': 2, class: 'fi' }, svg);
            [a, b].forEach(v => S('line', { x1: v, x2: v, y1: yy - 6, y2: yy + 6, stroke: C.s1, 'stroke-width': 2, class: 'fi' }, svg));
          });
          S('circle', { cx: x(r[1]), cy: yy, r: 6.5, fill: C.s1, class: 'dot pop', style: `--d:${(0.3 + i * 0.08).toFixed(2)}s` }, svg);
          T(svg, x(r[1]), yy - 12, fx(r[1], 3), 'lab mid fi', { style: 'font-size:12.5px' });
          const hit = S('rect', { class: 'bhit', x: 0, y: yy - 22, width: w, height: 44 }, svg);
          hov(hit, ev => tip.show(ev, p[0] + ' · ' + r[0], [{ c: C.s1, v: fx(r[1], 4), l: 'R²' }].concat(r[2] ? [{ v: '± ' + fx(r[2], 4), l: '10 次的标准差' }] : [{ v: sgn((r[1] / BASE - 1) * 100, 1) + '%', l: '相对基准' }])));
        });
      });
    }
  });

  /* ================================================================ SHAP 拆解：任选省份 × 年份 */
  const RH = 50;
  mod('wfc', {
    init(host) {
      const SH = D.shap;
      this.p = '黑龙江'; this.y = 2022;
      const sel = $('#wfprov');
      D.provs.forEach(p => { const o = H('option', '', sel, p); o.value = p; });
      sel.value = this.p;
      sel.addEventListener('change', () => { this.p = sel.value; this.upd(); });
      const yr = $('#wfyr'); rangeFill(yr);
      yr.addEventListener('input', () => { this.y = +yr.value; $('#wfyrv').textContent = yr.value; rangeFill(yr); this.upd(); });
      legend($('#wflg'), [{ l: '拉高得分', c: C.pos }, { l: '拉低得分', c: C.neg }, { l: '模型预测', c: C.ink, t: 'dot' }, { l: '实际得分', c: C.ink, t: 'line' }]);
      let lo = 1, hi = 0;
      Object.keys(SH.rows).forEach(k => {
        let c = SH.base; lo = Math.min(lo, c); hi = Math.max(hi, c);
        SH.rows[k].slice(6).forEach(v => { c += v; lo = Math.min(lo, c); hi = Math.max(hi, c); });
      });
      D.provs.forEach(p => D.score[p].forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
      this.lo = Math.floor(lo * 20) / 20; this.hi = Math.ceil(hi * 20) / 20;
      host.style.height = (RH * 8 + 26) + 'px';
      this.gl = H('div', '', host);
      const mk = nm => {
        const r = H('div', 'wrow', host), n = H('div', 'wname', r, nm), v = H('div', 'wval', r), b = H('div', 'wbar', r), l = H('div', 'wlab', r), c = H('div', 'wcon', host);
        return { r, n, v, b, l, c };
      };
      this.baseR = mk('全部样本平均分'); this.baseR.v.textContent = '模型的起点（341 个样本）';
      this.predR = mk('模型预测得分');
      [this.baseR, this.predR].forEach(o => { o.b.className = 'wdot'; o.c.style.display = 'none'; });
      this.baseR.b.style.background = '#6F8196'; this.predR.b.style.background = C.ink;
      this.act = H('div', 'wact', this.predR.r); this.actl = H('span', '', this.act);
      this.rows = SH.fac.map(f => {
        const o = mk(f);
        hov(o.r, ev => { const [n, v, val] = o.t; tip.show(ev, this.p + ' · ' + this.y + ' 年 · ' + n, [{ c: v >= 0 ? C.pos : C.neg, v: s4(v), l: v >= 0 ? '拉高得分' : '拉低得分' }, { v: FMT[n](val), l: '本省取值' }]); });
        return o;
      });
    },
    draw(host, w) {
      const nw = narrow(), NW = nw ? 100 : 196;
      this.nw = nw;
      this.x = lin(this.lo, this.hi, NW + 6, w - (nw ? 84 : 58));
      this.baseR.n.textContent = nw ? '样本平均分' : '全部样本平均分';
      this.baseR.v.textContent = nw ? '模型起点' : '模型的起点（341 个样本）';
      this.gl.textContent = '';
      for (let t = Math.ceil(this.lo * 10) / 10; t <= this.hi + 1e-9; t += 0.1) {
        const g = H('div', 'wgrid', this.gl); g.style.left = this.x(t) + 'px'; g.style.height = (RH * 8) + 'px';
        if (nw && Math.round(t * 10) % 2) continue;
        const l = H('div', 'wtick', this.gl, t.toFixed(1)); l.style.left = this.x(t) + 'px'; l.style.top = (RH * 8 + 6) + 'px';
      }
      [this.baseR, this.predR].concat(this.rows).forEach(o => { o.n.style.width = o.v.style.width = (NW - 6) + 'px'; o.n.style.fontSize = nw ? '13.5px' : ''; });
      this.upd();
    },
    upd() {
      const SH = D.shap, r = SH.rows[this.p + this.y], x = this.x;
      if (!r || !x) return;
      const vals = r.slice(0, 6), sh = r.slice(6), base = SH.base, pred = base + sh.reduce((a, b) => a + b, 0), act = D.score[this.p][this.y - 2011];
      const ord = sh.map((v, i) => i).sort((a, b) => Math.abs(sh[b]) - Math.abs(sh[a]));
      this.baseR.r.style.top = '0px';
      this.baseR.b.style.left = x(base) + 'px'; this.baseR.l.style.left = (x(base) + 12) + 'px'; this.baseR.l.textContent = f3(base);
      let cum = base, prevX = x(base), prevTop = 0;
      ord.forEach((i, k) => {
        const o = this.rows[i], v = sh[i], c0 = cum, c1 = cum + v, top = RH * (k + 1), f = SH.fac[i];
        o.r.style.top = top + 'px';
        o.n.textContent = this.nw ? SHORT[f] : f; o.v.textContent = (this.nw ? '' : '本省取值：') + FMT[f](vals[i]);
        const l = x(Math.min(c0, c1)), wd = Math.max(2, Math.abs(x(c1) - x(c0)));
        o.b.style.left = l + 'px'; o.b.style.width = wd + 'px';
        o.b.style.background = v >= 0 ? C.pos : C.neg;
        o.b.style.borderRadius = v >= 0 ? '0 4px 4px 0' : '4px 0 0 4px';
        o.l.style.left = (l + wd + 6) + 'px'; o.l.textContent = s3(v);
        o.c.style.left = prevX + 'px'; o.c.style.top = (prevTop + 38) + 'px'; o.c.style.height = (top + 12 - prevTop - 38) + 'px';
        o.t = [f, v, vals[i]];
        cum = c1; prevX = x(cum); prevTop = top;
      });
      const pr = this.predR;
      pr.r.style.top = (RH * 7) + 'px';
      pr.c.style.display = 'block'; pr.c.style.left = prevX + 'px'; pr.c.style.top = (prevTop + 38) + 'px'; pr.c.style.height = (RH * 7 + 19 - prevTop - 38) + 'px';
      pr.b.style.left = x(pred) + 'px'; pr.v.textContent = this.p + ' ' + this.y + ' 年';
      this.act.style.left = x(act) + 'px';
      const right = act >= pred;
      pr.l.textContent = f3(pred);
      pr.l.style.left = right ? 'auto' : (x(pred) + 12) + 'px';
      if (right) { pr.l.style.left = (x(pred) - 12) + 'px'; pr.l.style.transform = 'translateX(-100%)'; } else pr.l.style.transform = 'none';
      this.actl.textContent = '实际 ' + f3(act);
      this.actl.style.left = right ? '6px' : 'auto'; this.actl.style.right = right ? 'auto' : '6px';
      const up = ord.filter(i => sh[i] > 0), dn = ord.filter(i => sh[i] < 0), tk = $('#wftake');
      tk.textContent = '';
      H('b', '', tk, this.p + ' ' + this.y + ' 年：');
      tk.appendChild(document.createTextNode('预测 ' + f3(pred) + '（实际 ' + f3(act) + '）。' +
        (up.length ? '拉高最多的是' + SHORT[SH.fac[up[0]]] + '（' + s3(sh[up[0]]) + '）' : '没有因素拉高得分') + '；' +
        (dn.length ? '拉低最多的是' + SHORT[SH.fac[dn[0]]] + '（' + s3(sh[dn[0]]) + '）。' : '没有因素拉低得分。')));
      dataTable($('#wfc'), ['项目', '本省取值', '贡献（SHAP）'], [['全部样本平均分', '', f3(base)]].concat(ord.map(i => [SH.fac[i], FMT[SH.fac[i]](vals[i]), s4(sh[i])]), [['模型预测得分', '', f3(pred)], ['实际得分', '', f3(act)]]));
    }
  });

  /* ================================================================ 重要性 */
  mod('impc', {
    init() { legend($('#implg'), ['科技', '数字', '绿色'].map(d => ({ l: d, c: FDIMC[d] }))); },
    draw(host, w) {
      const nw = narrow(), X0 = nw ? 104 : 150, X1 = w - 62, h = 6 * 54 + 24, svg = svgIn(host, w, h), x = lin(0, 0.5, X0, X1);
      [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(t => { S('line', { class: 'grid', x1: x(t), x2: x(t), y1: 0, y2: h - 20 }, svg); if (!nw || t * 10 % 2 === 0) T(svg, x(t), h - 3, Math.round(t * 100) + '%', 'tick mid'); });
      D.imp.forEach((r, i) => {
        const yy = 10 + i * 54, g = S('g', {}, svg);
        T(g, X0 - 10, yy + 17, nw ? SHORT[r.n] : r.n, 'lab end');
        const b = S('path', { d: hbar(X0, yy, x(r.s) - X0, 24, 4), fill: FDIMC[r.d], class: 'bar', style: `--d:${(i * 0.08).toFixed(2)}s` }, g);
        T(g, x(r.s) + 8, yy + 18, fx(r.s * 100, 1) + '%', 'big', { style: 'font-size:16px' });
        const hit = S('rect', { class: 'bhit', x: 0, y: yy - 14, width: w, height: 52 }, g);
        hov(hit, ev => { b.classList.add('hov'); tip.show(ev, r.n, [{ c: FDIMC[r.d], v: fx(r.s * 100, 1) + '%', l: '贡献占比' }, { v: fx(r.v, 4), l: '平均 |SHAP| 值' }, { v: r.d, l: '维度' }]); }, () => b.classList.remove('hov'));
        hit.addEventListener('pointerleave', () => b.classList.remove('hov'));
      });
      dataTable(host, ['因素', '维度', '平均 |SHAP|', '贡献占比'], D.imp.map(r => [r.n, r.d, fx(r.v, 4), fx(r.s * 100, 1) + '%']));
    }
  });
  mod('dimc', {
    draw(host, w) {
      const h = 92, svg = svgIn(host, w, h), ds = ['科技', '数字', '绿色'];
      let x0 = 0;
      ds.forEach((d, k) => {
        const ww = D.dims[d] * (w - 4) , g = S('g', {}, svg);
        S('rect', { x: x0, y: 4, width: Math.max(1, ww), height: 34, fill: FDIMC[d], class: 'bar', style: `--d:${(0.2 + k * 0.2).toFixed(2)}s` }, g);
        T(g, x0, 60, d, 'lab2'); T(g, x0, 82, fx(D.dims[d] * 100, 1) + '%', 'big', { style: 'font-size:17px' });
        hov(g, ev => tip.show(ev, d + '维度', [{ c: FDIMC[d], v: fx(D.dims[d] * 100, 1) + '%', l: '合计贡献' }]));
        x0 += ww + 2;
      });
    }
  });

  /* ================================================================ 作用方式：逐个因素看五档平均 */
  const DEPT = {
    '农村科技从业人员': ['门槛型', '前三档平均贡献为负，跨过约 138 万人后跃升为正：人才要形成规模才见效。', 2, '≈138 万人'],
    '数字基础设施': ['递增型', '越高越好，约 970 千瓦时/人以上转为正向贡献。', 2, '≈970 千瓦时/人'],
    '环保支出占比': ['递减型', '本指标用农业碳排放强度测度：碳排放越高，对得分的拖累越大，环境治理是制约。', null, ''],
    '农村科技投入': ['先升后稳', '投入很低时拖累得分，第三档以后转正并趋于平稳，绝对贡献较小。', null, ''],
    '森林覆盖率': ['波动型', '正负交替、没有稳定方向：林地与耕地存在竞争，种树不能一刀切。', null, ''],
    '农业技术培训比例': ['递增型', '受教育程度越高贡献越大，但整体幅度较小，主要通过提高单产间接起作用。', null, '']
  };
  mod('depc', {
    init(host) {
      this.v = D.imp[0].n;
      seg($('#depseg'), D.imp.map(r => SHORT[r.n]), 0, k => { this.v = D.imp[k].n; this.render(host, true); });
    },
    draw(host, w) { this.w = w; this.render(host, false); },
    render(host, anim) {
      const v = this.v, dp = D.dep[v], w = this.w, nw = narrow(), h = Math.round(Math.max(280, Math.min(w * 0.6, 400)));
      const svg = svgIn(host, w, h), X0 = nw ? 50 : 58, X1 = w - 8, Y0 = 22, Y1 = h - 44, bw = (X1 - X0) / 5;
      const ys = dp.pts.map(p => p[1]), ym = Math.max(...ys.map(Math.abs)) * 1.08, y = lin(-ym, ym, Y1, Y0), st = nice(ym * 0.6);
      [-st, st].forEach(t => { S('line', { class: 'grid', x1: X0, x2: X1, y1: y(t), y2: y(t) }, svg); T(svg, X0 - 8, y(t) + 4.5, minus((t > 0 ? '+' : '') + t.toFixed(st < 0.01 ? 3 : 2)), 'tick end'); });
      const g = S('g', { class: 'fi' }, svg), keyOf = [];
      dp.pts.forEach((p, i) => {
        let q = dp.q.findIndex(qq => p[0] <= qq.hi + 1e-9); if (q < 0) q = 4;
        const jit = ((i * 7919) % 97) / 97 - 0.5, cx = X0 + bw * (q + 0.5) + jit * bw * 0.8;
        S('circle', { cx, cy: y(p[1]), r: 2.4, fill: '#B3C2D1', 'fill-opacity': 0.75 }, g);
        keyOf.push([cx, y(p[1]), i]);
      });
      S('line', { class: 'zero', x1: X0, x2: X1, y1: y(0), y2: y(0) }, svg); T(svg, X0 - 8, y(0) + 4.5, '0', 'tick end');
      const ms = dp.q.map(q => q.m), imax = ms.indexOf(Math.max(...ms)), imin = ms.indexOf(Math.min(...ms)), cbw = Math.min(40, bw * 0.42);
      dp.q.forEach((q, i) => {
        const cx = X0 + bw * (i + 0.5);
        S('path', { d: vbar(cx - cbw / 2, y(0), cbw, y(0) - y(q.m), 4), fill: q.m >= 0 ? C.pos : C.neg, stroke: '#fff', 'stroke-width': 2, 'paint-order': 'stroke', class: 'bar v' + (q.m < 0 ? ' vn' : ''), style: `--d:${(0.3 + i * 0.07).toFixed(2)}s`, 'pointer-events': 'none' }, svg);
        T(svg, cx, Y1 + 18, '第 ' + (i + 1) + ' 档', 'tick mid');
        if (i === imax || i === imin) T(svg, cx, q.m >= 0 ? y(q.m) - 8 : y(q.m) + 18, s4(q.m), 'lab mid fi', { style: '--d:1s;font-size:13px' });
      });
      T(svg, (X0 + X1) / 2, Y1 + 37, '低  ←  ' + v + '取值从低到高分成五档  →  高', 'lab2 mid', { style: nw ? 'font-size:12px' : '' });
      const t = DEPT[v];
      if (t[2] != null) {
        const tx = X0 + bw * (t[2] + 1);
        S('line', { x1: tx, x2: tx, y1: Y0 - 6, y2: Y1, stroke: C.ink, 'stroke-width': 1.2, 'stroke-opacity': 0.45, class: 'fi', style: '--d:1.2s', 'pointer-events': 'none' }, svg);
        T(svg, tx - 6, Y0 + 6, t[3], 'lab2 end fi', { style: '--d:1.2s' });
      }
      // 悬停：靠近灰点显示单个样本，否则显示所在档位
      const hit = S('rect', { class: 'hit', x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 }, svg);
      hov(hit, ev => {
        const p = svgPt(svg, ev); let bi = -1, bd = 64;
        keyOf.forEach(k => { const d = (k[0] - p.x) ** 2 + (k[1] - p.y) ** 2; if (d < bd) { bd = d; bi = k[2]; } });
        if (bi >= 0) { tip.show(ev, D.depk[bi] + ' 年', [{ v: FMT[v](dp.pts[bi][0]), l: v }, { v: s4(dp.pts[bi][1]), l: '对得分的贡献' }]); return; }
        const qi = Math.max(0, Math.min(4, Math.floor((p.x - X0) / bw))), q = dp.q[qi];
        tip.show(ev, v + ' · 第 ' + (qi + 1) + ' 档', [{ c: q.m >= 0 ? C.pos : C.neg, v: s4(q.m), l: '平均贡献' }, { v: FMT[v](q.lo) + ' — ' + FMT[v](q.hi), l: '' }, { v: Math.round(q.pos * 100) + '%', l: '样本为正贡献' }]);
      });
      dataTable(host, ['档位', '区间', '平均贡献', '正贡献样本占比'], dp.q.map((q, k) => ['第 ' + (k + 1) + ' 档', FMT[v](q.lo) + ' — ' + FMT[v](q.hi), s4(q.m), Math.round(q.pos * 100) + '%']));
      if (anim) animIn(svg, 20);
      const tc = $('#deptxt'), r = D.imp.find(z => z.n === v);
      tc.textContent = '';
      const ct = H('div', 'ct', tc), sw = H('span', 'sw', ct); sw.style.background = FDIMC[r.d];
      ct.appendChild(document.createTextNode(v)); H('span', 'pill', ct, t[0]);
      H('div', '', tc, t[1]).style.marginTop = '4px';
      const kk = H('div', 'medk', tc);
      [['贡献占比', fx(r.s * 100, 1) + '%'], ['最低档平均', s4(dp.q[0].m)], ['最高档平均', s4(dp.q[4].m)]].forEach(z => { const d = H('div', '', kk); H('span', '', d, z[0]); H('b', '', d, z[1]); });
      H('div', 'note', tc, '柱子：每档的平均贡献；灰点：341 个样本各自的贡献。悬停或轻点查看具体省份与年份。');
    }
  });

  /* ================================================================ 协同效应：单独作用 vs 两两搭配 */
  mod('intc', {
    init() { legend($('#intlg'), [{ l: '单个因素自己的作用', c: C.s1 }, { l: '两两搭配的额外作用', c: C.s2 }]); },
    draw(host, w) {
      const nw = narrow(), X0 = nw ? 132 : 250, X1 = w - 62, x = lin(0, 0.06, X0, X1), staff = D.imp[0].v;
      const rows = [{ h: '单个因素自己的平均作用' }].concat(D.imp.map(r => ({ n: SHORT[r.n], v: r.v, c: C.s1, k: '单独作用' })),
        [{ h: '两个因素“搭配”额外多出的作用（最强 4 组）', gap: 1 }], D.inter.slice(0, 4).map(r => ({ n: SHORT[r.a] + ' × ' + SHORT[r.b], v: r.v, c: C.s2, k: '搭配作用' })));
      const h = rows.reduce((a, r) => a + (r.h ? (r.gap ? 42 : 28) : 34), 0) + 26, svg = svgIn(host, w, h);
      [0, 0.02, 0.04, 0.06].forEach(t => { S('line', { class: 'grid', x1: x(t), x2: x(t), y1: 0, y2: h - 22 }, svg); T(svg, x(t), h - 4, t.toFixed(2), 'tick mid'); });
      let yy = 2, bi = 0;
      rows.forEach(r => {
        if (r.h) { yy += r.gap ? 14 : 0; T(svg, 0, yy + 15, r.h, 'lab', { style: 'font-size:14px;fill:#0E3F73' }); yy += 28; return; }
        const g = S('g', {}, svg), lab = nw ? r.n.replace('科技从业人员', '科技人员').replace('数字基础设施', '数字基建').replace('环保支出占比', '环保支出') : r.n;
        T(g, X0 - 10, yy + 14, lab, 'lab2 end', { style: 'fill:#13263A;font-size:' + (nw ? '12.5px' : '14px') });
        const b = S('path', { d: hbar(X0, yy, Math.max(1, x(r.v) - X0), 20, 4), fill: r.c, class: 'bar', style: `--d:${(bi++ * 0.06).toFixed(2)}s` }, g);
        T(g, x(r.v) + 8, yy + 15, fx(r.v, 4), 'lab', { style: 'font-size:13px' });
        const hit = S('rect', { class: 'bhit', x: 0, y: yy - 7, width: w, height: 34 }, g);
        hov(hit, ev => { b.classList.add('hov'); tip.show(ev, r.n, [{ c: r.c, v: fx(r.v, 4), l: r.k }, { v: '约为科技从业人员单独作用的 ' + Math.round(r.v / staff * 100) + '%', l: '' }]); }, () => b.classList.remove('hov'));
        hit.addEventListener('pointerleave', () => b.classList.remove('hov'));
        yy += 34;
      });
      dataTable(host, ['类型', '因素 / 组合', '平均 |SHAP|'], rows.filter(r => !r.h).map(r => [r.k, r.n, fx(r.v, 4)]));
    }
  });
})();
/* 成果展示网站 · 模块（四）：中介效应（原理 / 结果 / 稳健性口径）、政策建议、区域方案、论文导读滚动叙事 */
(function () {
  'use strict';
  const { $, $$, S, T, H, lin, fx, f3, minus, sgn, P, vbar, svgIn, svgPt, animIn, narrow, tip, hov, dataTable, mod, NOANIM, STATIC } = DK;
  const { C, REGS, REGC, legend, seg } = DKC;
  const D = window.DATA, G = window.GUIDES, IMG = window.__IMG || {};
  const s4 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fx(Math.abs(v), 4);
  const s3 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fx(Math.abs(v), 3);

  /* ================================================================ 中介效应原理：小圆点沿间接路径流动 */
  mod('medidea', {
    draw(host, w) {
      const nw = narrow(), h = nw ? 330 : 250, svg = svgIn(host, w, h);
      const bw = nw ? Math.min(150, w * 0.42) : Math.min(260, w * 0.22), bh = nw ? 66 : 76;
      const L = nw ? { x: [6, (w - bw) / 2, w - bw - 6], y: [196, 20, 196] } : { x: [8, (w - bw) / 2, w - bw - 8], y: [150, 10, 150] };
      const node = (k, t, s, fill, ink) => {
        const g = S('g', { class: 'pop', style: `--d:${(0.15 + k * 0.15).toFixed(2)}s` }, svg), x = L.x[k], y = L.y[k];
        S('rect', { x, y, width: bw, height: bh, rx: 14, fill, stroke: fill === '#fff' ? '#C9DCEF' : 'none', 'stroke-width': 1.5 }, g);
        T(g, x + bw / 2, y + bh * 0.46, t, 'mid', { style: `font-size:${nw ? 17 : 21}px;font-weight:700;fill:${ink}` });
        T(g, x + bw / 2, y + bh * 0.78, s, 'mid', { style: `font-size:${nw ? 12 : 14}px;fill:${ink};opacity:.82` });
      };
      node(0, '影响因素', '例：数字基础设施', C.s1, '#fff');
      node(1, '中间环节', '例：单位面积产量', '#fff', '#0E3F73');
      node(2, '粮食安全', '综合得分', '#0E3F73', '#fff');
      const mx0 = L.x[1], my = L.y[1] + bh / 2, mx1 = L.x[1] + bw, cy = L.y[0] + bh * 0.78;
      let pa, pb, heads, la, lb;
      if (nw) {
        // 窄屏：影响因素、粮食安全在下排，中间环节在上排；箭头从下排节点顶部出发 / 进入
        const sx = L.x[0] + bw * 0.5, sy = L.y[0], ex = L.x[2] + bw * 0.5, ey = L.y[2];
        pa = `M${sx},${sy} C${sx},${my} ${sx},${my} ${mx0},${my}`;
        pb = `M${mx1},${my} C${ex},${my} ${ex},${my} ${ex},${ey}`;
        heads = [[`M${mx0 - 9},${my - 6} l9,6 -9,6`, C.s2], [`M${ex - 6},${ey - 9} l6,9 6,-9`, C.s2]];
        la = [sx - 14, (sy + my) / 2 + 6]; lb = [ex + 14, (ey + my) / 2 + 6];
      } else {
        const ax = L.x[0] + bw, ay = L.y[0] + bh * 0.3, bx = L.x[2];
        pa = `M${ax},${ay} C${ax + 50},${ay} ${mx0 - 50},${my} ${mx0},${my}`;
        pb = `M${mx1},${my} C${mx1 + 50},${my} ${bx - 50},${ay} ${bx},${ay}`;
        heads = [[`M${mx0 - 9},${my - 6} l9,6 -9,6`, C.s2], [`M${bx - 9},${ay - 6} l9,6 -9,6`, C.s2]];
        la = [(ax + mx0) / 2 - 6, (ay + my) / 2]; lb = [(mx1 + bx) / 2 + 6, (my + ay) / 2];
      }
      const pc = `M${L.x[0] + bw},${cy} L${L.x[2]},${cy}`;
      heads.push([`M${L.x[2] - 9},${cy - 6} l9,6 -9,6`, '#9AA9B9']);
      [pa, pb].forEach(d => S('path', { d, fill: 'none', stroke: C.s2, 'stroke-width': 3, 'stroke-linecap': 'round', class: 'draw', pathLength: 1, style: '--d:.7s' }, svg));
      S('path', { d: pc, fill: 'none', stroke: '#9AA9B9', 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'fi', style: '--d:.9s' }, svg);
      heads.forEach(a => S('path', { d: a[0], fill: 'none', stroke: a[1], 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'fi', style: '--d:1.2s' }, svg));
      T(svg, la[0], la[1], 'a', 'mid', { style: 'font-size:24px;font-weight:700;fill:#13263A' });
      T(svg, lb[0], lb[1], 'b', 'mid', { style: 'font-size:24px;font-weight:700;fill:#13263A' });
      T(svg, w / 2, cy + 24, 'c′：控制中间环节后，剩下的“直接效应”', 'lab2 mid');
      T(svg, w / 2, L.y[1] + bh + (nw ? 40 : 34), '间接效应 = a × b', 'mid fi', { style: `--d:1.3s;font-size:${nw ? 19 : 22}px;font-weight:700;fill:#B8731A` });
      T(svg, w / 2, L.y[1] + bh + (nw ? 62 : 56), '先改变中间环节、再影响结果的那一部分', 'lab2 mid fi', { style: '--d:1.3s' });
      if (!NOANIM) {
        const full = pa + ` L${mx1},${my} ` + pb.replace(/^M[^C]+/, '');
        for (let k = 0; k < 3; k++) {
          const c = S('circle', { r: 6.5, fill: C.s2, stroke: '#fff', 'stroke-width': 2, cx: 0, cy: 0, opacity: 0 }, svg);
          S('animateMotion', { dur: '3.4s', repeatCount: 'indefinite', begin: (1.2 + k * 1.13).toFixed(2) + 's', path: full }, c);
          S('set', { attributeName: 'opacity', to: 1, begin: (1.2 + k * 1.13).toFixed(2) + 's' }, c);
        }
        const c2 = S('circle', { r: 5.5, fill: '#9AA9B9', stroke: '#fff', 'stroke-width': 2, cx: 0, cy: 0, opacity: 0 }, svg);
        S('animateMotion', { dur: '4.6s', repeatCount: 'indefinite', begin: '1.4s', path: pc }, c2);
        S('set', { attributeName: 'opacity', to: 1, begin: '1.4s' }, c2);
      }
    }
  });

  /* ================================================================ 中介效应结果：三种口径切换 */
  const SH = { '农业技术培训比例': '技术培训', '农村科技投入': '科技投入', '数字基础设施': '数字基础设施', '单位面积粮食产量': '单位面积产量', '农业有效灌溉面积占比': '有效灌溉占比', '单位机械总动力': '机械总动力' };
  const MODES = [['base', '基准模型'], ['sub', '替换因变量'], ['fe', '双向固定效应']];
  const MTXT = {
    base: '六条路径各用 5000 次 Bootstrap 重抽样检验，95% 置信区间不含 0 即为显著。',
    sub: '三个中介变量本身也是打分指标，可能“自己解释自己”：把它们剔除后重算得分再检验。单产渠道 H1—H3 依然显著；灌溉渠道 H5 不再显著；H6 转为正向显著，但区间下限紧贴 0，稳健性有限。',
    fe: '只看每个省“自己和自己比”的年际变化（省份与年份双向固定效应，2000 次省份整群 Bootstrap）：六条路径都不显著。单产、灌溉是长期积累型变量，省内逐年变化有限，所以上面的渠道主要反映省与省之间的结构差异。'
  };
  const TXT = {
    H1: '技术培训先提高单产，再提升粮食安全；约四分之三（74.0%）的作用经由这条路实现。',
    H2: '方向为负：科技投入经单产这条路反而“遮掩”了一部分正效应，投入向单产的转化链条尚不顺畅。',
    H3: '效应量最大：5000 次重抽样的结果全部落在 0 的右边。',
    H4: '置信区间跨过 0，不显著：技术培训主要不是靠改善灌溉起作用。',
    H5: '数字基础设施的第二条通道；但在替换因变量检验中不再显著，稳健性较弱。',
    H6: '置信区间跨过 0，不显著：机械化渠道未获统计支持。'
  };
  const pcol = r => !r[3] ? '#9AA9B9' : (r[0] >= 0 ? C.pos : C.neg);
  mod('medc', {
    init() {
      this.mode = 'base'; this.h = 'H3';
      seg($('#medmode'), MODES.map(m => m[1]), 0, k => { this.mode = MODES[k][0]; this.paint(); this.side(true); });
      legend($('#medlg'), [{ l: '正向且显著', c: C.pos, t: 'line' }, { l: '负向且显著', c: C.neg, t: 'line' }, { l: '不显著', c: '#9AA9B9', t: 'line', dash: 1 }, { l: '线越粗，间接效应越大', t: 'none' }]);
    },
    draw(host, w) {
      const nw = narrow(), vert = w < 520, fs = nw ? 13 : 16, lw = nw ? 74 : 92;
      const XS = ['农业技术培训比例', '农村科技投入', '数字基础设施'], MS = ['单位面积粮食产量', '农业有效灌溉面积占比', '单位机械总动力'];
      const ez = t => 3 * t * t - 2 * t * t * t;
      let h, heads, nodeX, nodeM, nodeY, tailM, edge;
      if (!vert) {
        // 宽屏：从左到右  影响因素 → 中间环节 → 结果
        const bx = nw ? 84 : 150, bm = nw ? 100 : 170, by2 = nw ? 64 : 112;
        const xX = 2, xM = (w - bm) / 2, xY = w - by2 - 2, rowY = nw ? [60, 200, 340] : [70, 235, 400], midY = rowY[1];
        h = nw ? 400 : 470;
        heads = [['影响因素', xX + bx / 2], ['中间环节', xM + bm / 2], ['结果', xY + by2 / 2]];
        nodeX = k => [xX, rowY[k], bx]; nodeM = k => [xM, rowY[k], bm]; nodeY = [xY, midY, by2];
        tailM = k => `M${xM + bm},${rowY[k]} C${xM + bm + 40},${rowY[k]} ${xY - 40},${midY} ${xY},${midY}`;
        edge = (a, b, hh) => {
          const x1 = xX + bx, x2 = xM, y1 = rowY[a] + (b - a) * 8, y2 = rowY[b] + (a - b) * 8;
          const LP = { H1: [0.35, -14], H4: [0.35, 16], H2: [0.6, -16], H6: [0.6, 18], H3: [0.35, 0], H5: [0.8, 12] }[hh];
          return { d: `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`, lx: x1 + (x2 - x1) * LP[0], ly: y1 + (y2 - y1) * ez(LP[0]) + LP[1],
            tail: ` L${xM + bm},${rowY[b]} C${xM + bm + 40},${rowY[b]} ${xY - 40},${midY} ${xY},${midY}` };
        };
      } else {
        // 手机：从上到下  影响因素 → 中间环节 → 结果；六个标签错开排成三行
        const gx = 8, bw = (w - 2 * gx - 4) / 3, cx = k => 2 + bw / 2 + k * (bw + gx), yX = 58, yM = 258, yY = 382, byw = Math.min(170, w * 0.52);
        h = 420;
        heads = [['影响因素', w / 2]];
        nodeX = k => [cx(k) - bw / 2, yX, bw]; nodeM = k => [cx(k) - bw / 2, yM, bw]; nodeY = [(w - byw) / 2, yY, byw];
        tailM = k => `M${cx(k)},${yM + 28} C${cx(k)},${yM + 58} ${w / 2},${yY - 58} ${w / 2},${yY - 28}`;
        edge = (a, b, hh) => {
          const x1 = cx(a) + (b - a) * 10, x2 = cx(b) + (a - b) * 10, y1 = yX + 28, y2 = yM - 28, k = (y2 - y1) / 3;
          const t = { H1: 0.5, H3: 0.5, H2: 0.25, H5: 0.25, H4: 0.75, H6: 0.75 }[hh];
          return { d: `M${x1},${y1} C${x1},${y1 + k} ${x2},${y2 - k} ${x2},${y2}`, lx: x1 + (x2 - x1) * ez(t), ly: y1 + (y2 - y1) * t,
            tail: ` L${cx(b)},${yM + 28} C${cx(b)},${yM + 58} ${w / 2},${yY - 58} ${w / 2},${yY - 28}` };
        };
      }
      const svg = svgIn(host, w, h);
      heads.forEach(t => T(svg, t[1], 16, t[0], 'lab2 mid'));
      const box = (n, t, sub, fill, ink) => {
        const [x, y, ww] = n;
        S('rect', { x, y: y - 28, width: ww, height: 56, rx: 12, fill, stroke: '#C9DCEF', 'stroke-width': fill === '#fff' ? 1.5 : 0 }, svg);
        T(svg, x + ww / 2, y + (sub ? -2 : 5), t, 'mid', { style: `font-size:${fs}px;font-weight:700;fill:${ink}` });
        if (sub) T(svg, x + ww / 2, y + 17, sub, 'mid', { style: `font-size:${nw ? 11 : 12.5}px;fill:${ink};opacity:.8` });
      };
      const mg = S('g', {}, svg), eg = S('g', {}, svg);
      MS.forEach((m, k) => S('path', { d: tailM(k), fill: 'none', stroke: '#C3CFDC', 'stroke-width': 2 }, mg));
      this.geo = {};
      this.edges = {};
      D.med.forEach(m => {
        const a = XS.indexOf(m.x), b = MS.indexOf(m.m), E = edge(a, b, m.h), d = E.d, lx = E.lx, ly = E.ly;
        const g = S('g', { style: 'cursor:pointer' }, eg);
        const line = S('path', { d, fill: 'none', 'stroke-linecap': 'round' }, g);
        S('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 26 }, g);
        const lb = S('g', {}, g);
        const rc = S('rect', { x: lx - lw / 2, y: ly - 12, width: lw, height: 24, rx: 12, fill: '#fff', 'stroke-width': 1.5 }, lb);
        const tx = T(lb, lx, ly + 4.5, '', 'mid', { style: `font-size:${nw ? 11.5 : 13}px;font-weight:700;fill:#13263A` });
        hov(g, ev => { const r = D.medrob[m.h][this.mode]; tip.show(ev, m.h + ' ' + SH[m.x] + ' → ' + SH[m.m] + '（' + MODES.find(z => z[0] === this.mode)[1] + '）', [{ c: pcol(r), v: minus(fx(r[0], 4)), l: '间接效应 ab' }, { v: '[' + minus(fx(r[1], 4)) + ', ' + minus(fx(r[2], 4)) + ']', l: '95% 置信区间' }, { v: r[3] ? '显著' : '不显著', l: '' }]); });
        g.addEventListener('click', () => { this.h = m.h; this.paint(); this.side(true); });
        this.edges[m.h] = { g, line, rc, tx, a, b };
        this.geo[m.h] = { d, tail: E.tail };
      });
      XS.forEach((x, k) => box(nodeX(k), SH[x], '', C.s1, '#fff'));
      MS.forEach((x, k) => box(nodeM(k), SH[x], ['技术效率渠道', '基础设施渠道', '机械化渠道'][k], '#fff', '#0E3F73'));
      box(nodeY, '粮食安全', nw && !vert ? '' : '综合得分', '#0E3F73', '#fff');
      this.dotg = S('g', {}, svg);
      this.svg = svg;
      this.paint(); this.side(false);
    },
    paint() {
      if (!this.edges) return;
      const md = this.mode;
      let n = 0;
      D.med.forEach(m => {
        const e = this.edges[m.h], r = D.medrob[m.h][md], c = pcol(r);
        if (r[3]) n++;
        e.line.setAttribute('stroke', c);
        e.line.setAttribute('stroke-width', (2 + Math.min(0.3, Math.abs(r[0])) * 22).toFixed(1));
        e.line.setAttribute('stroke-dasharray', r[3] ? '' : '6 7');
        e.rc.setAttribute('stroke', c);
        e.tx.textContent = m.h + ' ' + minus((r[0] > 0 ? '+' : '') + fx(r[0], 3));
        e.g.style.opacity = m.h === this.h ? 1 : 0.4;
      });
      // 显著路径上流动的小圆点
      this.dotg.textContent = '';
      if (!NOANIM) D.med.forEach((m, i) => {
        const r = D.medrob[m.h][md]; if (!r[3]) return;
        const g = this.geo[m.h], path = g.d + g.tail;
        const c = S('circle', { r: 4.5, fill: pcol(r), stroke: '#fff', 'stroke-width': 2, cx: 0, cy: 0, opacity: 0 }, this.dotg);
        const b0 = (0.2 + i * 0.6).toFixed(2) + 's';
        S('animateMotion', { dur: '3.4s', repeatCount: 'indefinite', begin: b0, path }, c);
        S('set', { attributeName: 'opacity', to: 1, begin: b0 }, c);
      });
      $('#medmodetxt').textContent = MTXT[md];
      const cnt = $('#medcnt'); cnt.textContent = '';
      MODES.forEach(z => { const k = D.med.filter(m => D.medrob[m.h][z[0]][3]).length, s = H('span', '', cnt); s.appendChild(document.createTextNode(z[1] + '：')); H('b', '', s, k + ' / 6'); s.appendChild(document.createTextNode(' 条显著')); if (z[0] === md) s.style.cssText = 'background:#E3EEF9;color:var(--deep)'; });
      dataTable($('#medc'), ['路径', '传导链条', '基准 ab', '替换因变量 ab', '双向固定效应 ab', '显著（基准 / 替换 / 固定效应）'],
        D.med.map(m => { const R = D.medrob[m.h]; return [m.h, SH[m.x] + ' → ' + SH[m.m], minus(fx(R.base[0], 4)), minus(fx(R.sub[0], 4)), minus(fx(R.fe[0], 4)), ['base', 'sub', 'fe'].map(k => R[k][3] ? '✔' : '✕').join(' / ')]; }));
    },
    side(anim) {
      const m = D.med.find(r => r.h === this.h), R = D.medrob[this.h], r = R[this.mode];
      $('#medT').textContent = this.h + '　' + SH[m.x] + ' → ' + SH[m.m];
      const st = $('#medstat'); st.textContent = '';
      [['间接效应 ab', minus((r[0] > 0 ? '+' : '') + fx(r[0], 3))], ['95% 置信区间', '[' + minus(fx(r[1], 3)) + ', ' + minus(fx(r[2], 3)) + ']'], ['结论', r[3] ? '✔ 显著' : '✕ 不显著']].forEach(z => {
        const d = H('div', '', st); H('span', '', d, z[0]); H('b', '', d, z[1]);
      });
      // 下方：三种口径的区间对比；基准口径附 5000 次分布
      const host = $('#histc'), w = host.clientWidth, nw = narrow(), h = 250, svg = svgIn(host, w, h);
      const vals = [R.base, R.sub, R.fe].flatMap(z => [z[1], z[2]]).concat(m.hist.e0, m.hist.e1, 0);
      const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08, X0 = nw ? 76 : 96, X1 = w - 10;
      const x = lin(lo - pad, hi + pad, X0, X1);
      T(svg, 0, 12, nw ? '基准模型：5000 次重抽样的 ab 分布' : '基准模型：5000 次重抽样得到的 ab 分布', 'lab2');
      const hs = m.hist, n = hs.c.length, bw = (hs.e1 - hs.e0) / n, cmax = Math.max(...hs.c), y = lin(0, cmax, 120, 24);
      S('rect', { x: x(R.base[1]), y: 22, width: x(R.base[2]) - x(R.base[1]), height: 98, fill: pcol(R.base), 'fill-opacity': 0.08 }, svg);
      hs.c.forEach((c, i) => {
        const a = hs.e0 + i * bw, px = x(a), ww = Math.max(1, x(a + bw) - px - 2);
        S('path', { d: vbar(px + 1, 120, ww, 120 - y(c), 2), fill: pcol(R.base), class: 'bar v', style: `--d:${(i * 0.012).toFixed(3)}s` }, svg);
      });
      S('line', { class: 'axis', x1: X0, x2: X1, y1: 120, y2: 120 }, svg);
      const rows = [['基准模型', R.base, 'base'], ['替换因变量', R.sub, 'sub'], ['双向固定效应', R.fe, 'fe']];
      rows.forEach((z, k) => {
        const yy = 156 + k * 32, on = z[2] === this.mode, c = pcol(z[1]);
        T(svg, X0 - 10, yy + 4.5, z[0], on ? 'lab end' : 'lab2 end', { style: nw ? 'font-size:12px' : '' });
        S('line', { x1: x(z[1][1]), x2: x(z[1][2]), y1: yy, y2: yy, stroke: c, 'stroke-width': on ? 3 : 2, 'stroke-linecap': 'round', class: 'fi' }, svg);
        S('circle', { cx: x(z[1][0]), cy: yy, r: on ? 6.5 : 5, fill: c, class: 'dot pop', style: `--d:${(0.3 + k * 0.1).toFixed(2)}s` }, svg);
        const hit = S('rect', { class: 'bhit', x: 0, y: yy - 15, width: w, height: 30 }, svg);
        hov(hit, ev => tip.show(ev, this.h + ' · ' + z[0], [{ c, v: minus(fx(z[1][0], 4)), l: 'ab' }, { v: '[' + minus(fx(z[1][1], 4)) + ', ' + minus(fx(z[1][2], 4)) + ']', l: '95% 置信区间' }, { v: z[1][3] ? '显著' : '不显著', l: '' }]));
      });
      S('line', { x1: x(0), x2: x(0), y1: 20, y2: 238, stroke: '#13263A', 'stroke-width': 1.6 }, svg);
      T(svg, x(0) + 5, 244, '0', 'lab', { style: 'font-size:12.5px' });
      const hit = S('rect', { class: 'bhit', x: X0, y: 22, width: X1 - X0, height: 98 }, svg);
      hov(hit, ev => {
        const p = svgPt(svg, ev), i = Math.floor((x.inv(p.x) - hs.e0) / bw);
        if (i < 0 || i >= n) { tip.hide(); return; }
        tip.show(ev, 'ab ∈ [' + minus(fx(hs.e0 + i * bw, 3)) + ', ' + minus(fx(hs.e0 + (i + 1) * bw, 3)) + ')', [{ c: pcol(R.base), v: String(hs.c[i]), l: '次（共 5000 次）' }]);
      });
      animIn(svg, anim ? 20 : 0);
      const tx = $('#medtxt'); tx.textContent = '';
      H('b', '', tx, this.h + '：'); tx.appendChild(document.createTextNode(TXT[this.h]));
    }
  });

  /* ================================================================ 政策建议：标签切换 + 时间表 */
  const ROAD = [
    ['现在起 · 每年', ['科技特派员全覆盖，每年新增 10 万农村实用人才', '主产区森林覆盖率年均 +0.5—1 个百分点', '数字专项资金每年不少于 200 亿元']],
    ['2028 年', ['农技培训覆盖率提升 15 个百分点', '', '农村光纤 ≥ 95%、5G 覆盖率 60%']],
    ['2030 年', ['农技培训覆盖率达到 60% 以上', '', '']],
    ['2032 年', ['', '', '建成 100 个数字农业示范县']]];
  mod('ptabs', {
    init(el) {
      const rd = $('#road');
      this.pts = ROAD.map(r => { const p = H('div', 'rp', rd); H('b', '', p, r[0]); H('i', '', p); return { p, s: H('span', '', p) }; });
      $$('button', el).forEach((b, k) => { b.type = 'button'; b.addEventListener('click', () => this.show(k)); });
      this.show(0);
    },
    show(k) {
      $$('#ptabs button').forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-pressed', i === k); });
      $$('#ppan .tp').forEach((p, i) => p.classList.toggle('on', i === k));
      this.pts.forEach((o, i) => { const t = ROAD[i][1][k]; o.s.textContent = t || '—'; o.p.classList.toggle('on', !!t); });
    }
  });

  /* ================================================================ 区域方案卡片 */
  const RP = [
    ['东北', '粮食安全“压舱石”', '主攻黑土地数字化监测与保护性耕作，保护性耕作面积年均扩大 5 个百分点'],
    ['黄淮海', '均值最高，进入平台期', '优先推进生态修复，数字与生态投入按 6∶4 配置'],
    ['长三角', '投入强、耕地少', '保持科技投入年均增速 8%—10%，以科技弥补耕地短板'],
    ['西南', '基础弱、增长快', '优先实现光纤全覆盖与“一村一名农技员”，财政支农资金年均增速不低于 10%']];
  mod('rgcards', {
    init(el) {
      const avg = r => D.reg[r].reduce((a, b) => a + b, 0) / 12, order = REGS.slice().sort((a, b) => avg(b) - avg(a));
      this.hosts = RP.map((r, k) => {
        const s = D.reg[r[0]], fc = D.gm[r[0]], f30 = fc.fc[fc.fy.indexOf(2030)];
        const c = H('div', 'card rgc', el); c.setAttribute('data-r', ''); c.style.setProperty('--d', (k * 0.06).toFixed(2) + 's');
        const t = H('div', 'rgt', c), k2 = H('i', 'lk', t); k2.style.cssText += `background:${REGC[r[0]]};width:22px;height:4px;align-self:center`;
        H('b', '', t, r[0]); H('span', '', t, r[1]);
        const bd = H('div', 'rgb', c), host = H('div', 'vh', bd), n = H('div', 'rgn', bd);
        [[f3(avg(r[0])), '12 年平均 · 四区域第 ' + (order.indexOf(r[0]) + 1)], ['+' + fx((s[11] / s[0] - 1) * 100, 1) + '%', '2011→2022 涨幅'],
         [f3(f30) + (r[0] === '长三角' ? '*' : ''), '2030 年预测' + (r[0] === '长三角' ? '（仅作参考）' : '')]].forEach(v => { const d = H('div', '', n); H('b', '', d, v[0]); H('span', '', d, v[1]); });
        const a = H('div', 'rga', c); H('b', '', a, '建议：'); a.appendChild(document.createTextNode(r[2]));
        return [host, r[0]];
      });
    },
    draw() {
      this.hosts.forEach(([host, r]) => {
        const w = host.clientWidth, h = 112, svg = svgIn(host, w, h), s = D.reg[r], x = lin(2011, 2022, 4, w - 46), y = lin(0.22, 0.52, 92, 8);
        S('path', { d: P(D.years.map((t, i) => [x(t), y(D.nat[i])])), fill: 'none', stroke: '#C3CFDC', 'stroke-width': 1.5 }, svg);
        const pts = D.years.map((t, i) => [x(t), y(s[i])]);
        S('path', { d: P(pts) + `L${x(2022)},92L${x(2011)},92Z`, fill: REGC[r], 'fill-opacity': 0.1, class: 'fi' }, svg);
        S('path', { d: P(pts), class: 'ln draw', stroke: REGC[r], pathLength: 1 }, svg);
        S('circle', { cx: pts[11][0], cy: pts[11][1], r: 4.5, fill: REGC[r], class: 'dot pop', style: '--d:1.2s' }, svg);
        T(svg, pts[11][0] + 8, pts[11][1] + 4.5, f3(s[11]), 'lab', { style: 'font-size:12.5px' });
        T(svg, 4, 108, '2011', 'tick', { style: 'font-size:11.5px' }); T(svg, x(2022), 108, '2022', 'tick end', { style: 'font-size:11.5px' });
        const hit = S('rect', { class: 'hit', x: 0, y: 0, width: w, height: h }, svg);
        hov(hit, ev => { const p = svgPt(svg, ev), i = Math.max(0, Math.min(11, Math.round(x.inv(p.x) - 2011))); tip.show(ev, r + ' · ' + (2011 + i) + ' 年', [{ c: REGC[r], v: f3(s[i]), l: r }, { c: '#C3CFDC', v: f3(D.nat[i]), l: '全国平均' }]); });
      });
    }
  });

  /* ================================================================ 论文导读：滚动叙事（镜头推近原文 + 荧光笔） */
  function buildScrolly(box) {
    const steps = G[box.dataset.guide];
    const sv = H('div', 'sv', box), cam = H('div', 'cam', sv), img = H('img', '', cam), hl = H('div', '', cam), foc = H('div', 'foc', sv);
    img.alt = '论文原文页面'; img.decoding = 'async';
    const pg = H('div', 'pgno', sv), dots = H('div', 'sdots', sv);
    steps.forEach(() => H('i', '', dots));
    const ss = H('div', 'ss', box);
    const cards = steps.map((st, k) => {
      const s = H('div', 'step', ss), c = H('div', 'sc', s);
      H('div', 'stg', c, st.tag + ' · 论文第 ' + st.pg + ' 页');
      H('div', 'stt', c, st.title);
      const b = H('div', 'sbd', c); b.innerHTML = st.body;                     // 讲解文案为本项目自写的静态内容（guides.json），不含外部输入
      s.addEventListener('click', () => go(k));
      return s;
    });
    let cur = -1, pgCur = 0, t = 0;
    function go(k, jump) {
      if (k === cur) return;
      cur = k;
      const st = steps[k], f = st.f, fw = f[2] - f[0], fh = f[3] - f[1], VW = sv.clientWidth, VH = sv.clientHeight, pad = Math.min(40, VW * 0.06);
      const s = Math.min((VW - 2 * pad) / fw, (VH - 2 * pad) / fh, 2.4), tx = VW / 2 - (f[0] + fw / 2) * s, ty = VH / 2 - (f[1] + fh / 2) * s;
      if (pgCur !== st.pg) { img.src = IMG['p' + String(st.pg).padStart(2, '0')] || ''; pgCur = st.pg; }
      if (jump || NOANIM) { cam.style.transition = foc.style.transition = 'none'; }
      cam.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
      const P8 = 8;
      foc.style.left = (f[0] * s + tx - P8) + 'px'; foc.style.top = (f[1] * s + ty - P8) + 'px';
      foc.style.width = (fw * s + 2 * P8) + 'px'; foc.style.height = (fh * s + 2 * P8) + 'px';
      if (jump || NOANIM) { void cam.offsetWidth; cam.style.transition = foc.style.transition = ''; }
      clearTimeout(t); hl.textContent = '';
      const marks = st.hl.map(h => { const d = H('div', 'phl', hl); d.style.cssText = `left:${h[0]}px;top:${h[1]}px;width:${h[2] - h[0]}px;height:${h[3] - h[1]}px`; return d; });
      const on = () => marks.forEach((d, i) => { d.style.transitionDelay = (i * 0.25) + 's'; d.classList.add('on'); });
      if (NOANIM) on(); else t = setTimeout(on, jump ? 300 : 1000);
      pg.textContent = '论文第 ' + st.pg + ' 页';
      $$('i', dots).forEach((d, i) => d.classList.toggle('on', i === k));
      cards.forEach((c, i) => c.classList.toggle('on', i === k));
    }
    go(0, true);
    if ('IntersectionObserver' in window && !STATIC) {
      // 宽屏取视口正中一条线；窄屏原文固定在上方，取下方 62%—70% 的区域
      const rm = narrow() ? '-62% 0px -30% 0px' : '-46% 0px -46% 0px';
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) go(cards.indexOf(en.target)); }), { rootMargin: rm });
      cards.forEach(c => io.observe(c));
    }
    addEventListener('deckresize', () => { const k = cur; cur = -1; go(k, true); });
  }
  $$('.scrolly[data-guide]').forEach(buildScrolly);
})();

DK.start();
