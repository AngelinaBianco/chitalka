/* Читалка — оффлайн-чтение с переводом по тапу. */
(function () {
  'use strict';

  var LANGS = {
    it: { name: 'Итальянский', flag: '🇮🇹', voice: 'it-IT' },
    de: { name: 'Немецкий',    flag: '🇩🇪', voice: 'de-DE' }
  };

  var app = document.getElementById('app');
  var sheet = document.getElementById('sheet');
  var scrim = document.getElementById('scrim');

  /* ---------- хранилище ---------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var words = load('read.words', {});     // "it:acqua" -> {lang, form, tr, base, story}
  var progress = load('read.progress', {}); // storyId -> {pos: 0..1, done: bool}
  var lang = load('read.lang', 'it');
  var step = load('read.step', 1);

  function wordKey(l, form) { return l + ':' + form.toLowerCase(); }
  function storyProgress(id) { return progress[id] || { pos: 0, done: false }; }

  /* ---------- вспомогательное ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  function storiesOf(l, st) {
    return (window.STORIES || []).filter(function (s) {
      return s.lang === l && (st == null || s.step === st);
    });
  }
  function levelOf(l, st) {
    var list = storiesOf(l, st);
    return list.length ? list[0].level : '';
  }
  function savedInStory(s) {
    var n = 0;
    for (var k in words) if (words[k].story === s.id) n++;
    return n;
  }

  /* ---------- речь ---------- */
  var synth = window.speechSynthesis;
  function speak(text, l, onEnd) {
    if (!synth) return;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[l].voice;
    u.rate = 0.85;
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    synth.speak(u);
  }
  function stopSpeech() { if (synth) synth.cancel(); }

  /* ---------- карточка слова ---------- */
  var activeSpan = null;

  function closeSheet() {
    sheet.hidden = true; scrim.hidden = true; sheet.innerHTML = '';
    if (activeSpan) { activeSpan.removeAttribute('data-active'); activeSpan = null; }
  }
  scrim.addEventListener('click', closeSheet);

  function openWord(span, story) {
    if (activeSpan) activeSpan.removeAttribute('data-active');
    activeSpan = span;
    span.setAttribute('data-active', '1');

    var form = span.textContent;
    var entry = story.glossary[form.toLowerCase()];
    var key = wordKey(story.lang, form);

    sheet.innerHTML = '';
    sheet.appendChild(el('div', 'sheet-grip'));

    var head = el('div', 'sheet-word', form);
    sheet.appendChild(head);

    if (!entry) {
      sheet.appendChild(el('div', 'sheet-none', 'Это слово без карточки — имя или число.'));
    } else {
      sheet.appendChild(el('div', 'sheet-tr', entry.t));
      if (entry.b) sheet.appendChild(el('div', 'sheet-base', entry.b));
    }

    var actions = el('div', 'sheet-actions');

    var listen = el('button', 'act', '▶︎  Послушать');
    listen.addEventListener('click', function () { speak(form, story.lang); });
    actions.appendChild(listen);

    if (entry) {
      var remember = el('button', 'act primary');
      var setLabel = function () {
        var has = !!words[key];
        remember.textContent = has ? '✓  В словаре' : 'Запомнить';
        remember.setAttribute('data-saved', has ? '1' : '0');
      };
      setLabel();
      remember.addEventListener('click', function () {
        if (words[key]) delete words[key];
        else words[key] = { lang: story.lang, form: form.toLowerCase(), tr: entry.t, base: entry.b || '', story: story.id };
        save('read.words', words);
        setLabel();
        paintSaved(story);
      });
      actions.appendChild(remember);
    }

    sheet.appendChild(actions);
    sheet.hidden = false; scrim.hidden = false;
  }

  function paintSaved(story) {
    var spans = document.querySelectorAll('.w');
    for (var i = 0; i < spans.length; i++) {
      var has = !!words[wordKey(story.lang, spans[i].textContent)];
      if (has) spans[i].setAttribute('data-saved', '1');
      else spans[i].removeAttribute('data-saved');
    }
  }


  /* ---------- тема: солнце ↔ луна ---------- */
  var themeSeq = 0;

  function effectiveDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function syncThemeButtons() {
    var dark = effectiveDark(), list = document.querySelectorAll('.theme');
    for (var i = 0; i < list.length; i++) {
      list[i].setAttribute('data-on', dark ? '1' : '0');
      list[i].setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#131210' : '#F5F4EF');
  }
  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('read.theme', mode); } catch (e) {}
    syncThemeButtons();
  }
  function themeButton() {
    var id = 'cut' + (++themeSeq), rays = '';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      rays += '<line x1="' + (12 + Math.cos(a) * 7.7).toFixed(2) + '" y1="' + (12 + Math.sin(a) * 7.7).toFixed(2) +
              '" x2="' + (12 + Math.cos(a) * 10.3).toFixed(2) + '" y2="' + (12 + Math.sin(a) * 10.3).toFixed(2) + '"/>';
    }
    var b = el('button', 'theme');
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<mask id="' + id + '">' +
          '<rect x="0" y="0" width="24" height="24" fill="#fff"/>' +
          '<circle class="tcut" cx="12" cy="12" r="6"/>' +
        '</mask>' +
        '<g class="trays" stroke-linecap="round">' + rays + '</g>' +
        '<circle class="tdisc" cx="12" cy="12" r="5" mask="url(#' + id + ')"/>' +
      '</svg>';
    b.setAttribute('data-on', effectiveDark() ? '1' : '0');
    b.setAttribute('aria-label', effectiveDark() ? 'Включить светлую тему' : 'Включить тёмную тему');
    b.addEventListener('click', function () { applyTheme(effectiveDark() ? 'light' : 'dark'); });
    return b;
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystem = function () { if (!document.documentElement.getAttribute('data-theme')) syncThemeButtons(); };
    if (mq.addEventListener) mq.addEventListener('change', onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  }

  /* ---------- экран: список ---------- */
  function viewList() {
    stopSpeech();
    app.innerHTML = '';

    var top = el('div', 'top');
    var left = el('div');
    left.appendChild(el('h1', 'top-title', 'Читалка'));
    var total = Object.keys(words).length;
    left.appendChild(el('p', 'top-sub', total
      ? total + ' ' + plural(total, 'слово', 'слова', 'слов') + ' в словаре'
      : 'Тапни слово — покажу перевод'));
    top.appendChild(left);

    var acts = el('div', 'top-actions');
    var toWords = el('button', 'linkbtn', 'Мои слова ›');
    toWords.addEventListener('click', function () { location.hash = '#/words'; });
    acts.appendChild(toWords);
    acts.appendChild(themeButton());
    top.appendChild(acts);
    app.appendChild(top);

    var langs = el('div', 'langs');
    ['it', 'de'].forEach(function (l) {
      var b = el('button', 'lang');
      b.setAttribute('aria-pressed', l === lang ? 'true' : 'false');
      b.appendChild(el('span', null, LANGS[l].flag + '  ' + LANGS[l].name));
      b.addEventListener('click', function () { lang = l; save('read.lang', l); viewList(); });
      langs.appendChild(b);
    });
    app.appendChild(langs);

    var steps = el('div', 'langs steps');
    [1, 2].forEach(function (st) {
      var b = el('button', 'lang');
      b.setAttribute('aria-pressed', st === step ? 'true' : 'false');
      b.appendChild(el('span', null, 'Ступень ' + st));
      var lv = levelOf(lang, st);
      if (lv) b.appendChild(el('span', 'lvl', lv));
      b.addEventListener('click', function () { step = st; save('read.step', st); viewList(); });
      steps.appendChild(b);
    });
    app.appendChild(steps);

    var toc = el('div', 'toc');
    storiesOf(lang, step).forEach(function (s) {
      var p = storyProgress(s.id);
      var item = el('button', 'toc-item');
      item.setAttribute('data-done', p.done ? '1' : '0');

      var head = el('div', 'toc-head');
      head.appendChild(el('span', 'toc-title', s.title));
      head.appendChild(el('span', 'toc-leader'));
      head.appendChild(el('span', 'toc-min', s.minutes + ' мин'));
      item.appendChild(head);
      item.appendChild(el('div', 'toc-ru', s.titleRu));

      var saved = savedInStory(s);
      var started = p.done || p.pos > 0.02 || saved > 0;
      if (started) {
        var meta = el('div', 'toc-meta');
        var bar = el('div', 'bar');
        var fill = el('i');
        fill.style.width = Math.round((p.done ? 1 : p.pos) * 100) + '%';
        bar.appendChild(fill);
        meta.appendChild(bar);
        var label = p.done ? ['прочитано'] : [];
        if (!p.done && p.pos > 0.02) label.push(Math.round(p.pos * 100) + '%');
        if (saved) label.push(saved + ' ' + plural(saved, 'слово', 'слова', 'слов'));
        meta.appendChild(el('span', 'toc-known', label.join(' · ')));
        item.appendChild(meta);
      }

      item.addEventListener('click', function () { location.hash = '#/s/' + s.id; });
      toc.appendChild(item);
    });
    app.appendChild(toc);
    window.scrollTo(0, 0);
  }

  /* ---------- экран: рассказ ---------- */
  var scrollHandler = null;

  function viewStory(id) {
    var story = (window.STORIES || []).filter(function (s) { return s.id === id; })[0];
    if (!story) { location.hash = '#/'; return; }

    app.innerHTML = '';
    var bar = el('div', 'reader-bar');
    var back = el('button', 'back', '‹  Рассказы');
    back.addEventListener('click', function () { location.hash = '#/'; });
    bar.appendChild(back);

    var speakBtn = el('button', 'speak', '▶︎  Слушать');
    speakBtn.addEventListener('click', function () {
      if (speakBtn.getAttribute('data-on') === '1') {
        stopSpeech();
        speakBtn.setAttribute('data-on', '0');
        speakBtn.textContent = '▶︎  Слушать';
      } else {
        speakBtn.setAttribute('data-on', '1');
        speakBtn.textContent = '■  Стоп';
        speak(story.paragraphs.join(' '), story.lang, function () {
          speakBtn.setAttribute('data-on', '0');
          speakBtn.textContent = '▶︎  Слушать';
        });
      }
    });
    var barActs = el('div', 'bar-actions');
    barActs.appendChild(speakBtn);
    barActs.appendChild(themeButton());
    bar.appendChild(barActs);
    app.appendChild(bar);

    var wrap = el('article', 'story');
    var eyebrow = el('div', 'eyebrow story-eyebrow', LANGS[story.lang].name + ' · ' + story.level);
    wrap.appendChild(eyebrow);
    wrap.appendChild(el('h2', 'story-title', story.title));
    wrap.appendChild(el('p', 'story-ru', story.titleRu));

    var body = el('div', 'story-body');
    story.paragraphs.forEach(function (para) {
      var p = el('p');
      var parts = para.split(/([^\p{L}\p{M}]+)/u);
      parts.forEach(function (part) {
        if (!part) return;
        if (/[\p{L}]/u.test(part)) {
          var span = el('span', 'w', part);
          if (words[wordKey(story.lang, part)]) span.setAttribute('data-saved', '1');
          span.addEventListener('click', function () { openWord(span, story); });
          p.appendChild(span);
        } else {
          p.appendChild(document.createTextNode(part));
        }
      });
      body.appendChild(p);
    });
    wrap.appendChild(body);

    var row = el('div', 'done-row');
    var doneBtn = el('button', 'done-btn');
    var p0 = storyProgress(story.id);
    var setDone = function () {
      var d = storyProgress(story.id).done;
      doneBtn.textContent = d ? '✓ Прочитано' : 'Отметить прочитанным';
      doneBtn.setAttribute('data-done', d ? '1' : '0');
    };
    setDone();
    doneBtn.addEventListener('click', function () {
      var pr = storyProgress(story.id);
      pr.done = !pr.done;
      progress[story.id] = pr;
      save('read.progress', progress);
      setDone();
    });
    row.appendChild(doneBtn);
    wrap.appendChild(row);
    app.appendChild(wrap);

    /* позиция чтения */
    if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
    var tick = 0;
    scrollHandler = function () {
      if (tick) return;
      tick = setTimeout(function () {
        tick = 0;
        var max = document.body.scrollHeight - window.innerHeight;
        var pos = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        var pr = storyProgress(story.id);
        pr.pos = pos;
        progress[story.id] = pr;
        save('read.progress', progress);
      }, 600);
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });

    window.scrollTo(0, 0);
    if (p0.pos > 0.02 && p0.pos < 0.98 && !p0.done) {
      setTimeout(function () {
        var max = document.body.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.round(max * p0.pos));
      }, 60);
    }
  }

  /* ---------- экран: мои слова ---------- */
  function viewWords() {
    stopSpeech();
    app.innerHTML = '';
    var top = el('div', 'top');
    var left = el('div');
    left.appendChild(el('h1', 'top-title', 'Мои слова'));
    var n = Object.keys(words).length;
    left.appendChild(el('p', 'top-sub', n ? n + ' ' + plural(n, 'слово', 'слова', 'слов') : 'Пока пусто'));
    top.appendChild(left);
    var acts2 = el('div', 'top-actions');
    var back = el('button', 'linkbtn', '‹ Рассказы');
    back.addEventListener('click', function () { location.hash = '#/'; });
    acts2.appendChild(back);
    acts2.appendChild(themeButton());
    top.appendChild(acts2);
    app.appendChild(top);

    if (!n) {
      var e = el('div', 'empty');
      e.appendChild(el('strong', null, 'Здесь копятся слова'));
      e.appendChild(document.createTextNode('Откройте рассказ, тапните незнакомое слово и нажмите «Запомнить».'));
      app.appendChild(e);
      return;
    }

    var byStory = {};
    Object.keys(words).forEach(function (k) {
      var w = words[k];
      (byStory[w.story] = byStory[w.story] || []).push({ key: k, w: w });
    });

    (window.STORIES || []).forEach(function (s) {
      var list = byStory[s.id];
      if (!list) return;
      var g = el('div', 'words-group');
      g.appendChild(el('div', 'eyebrow', LANGS[s.lang].name));
      g.appendChild(el('h3', null, s.title));
      list.sort(function (a, b) { return a.w.form.localeCompare(b.w.form); });
      list.forEach(function (item) {
        var row = el('div', 'word-row');
        row.appendChild(el('span', 'word-src', item.w.form));
        row.appendChild(el('span', 'word-tr', item.w.tr));
        var del = el('button', 'word-del', 'убрать');
        del.addEventListener('click', function () {
          delete words[item.key]; save('read.words', words); viewWords();
        });
        row.appendChild(del);
        g.appendChild(row);
      });
      app.appendChild(g);
    });
    window.scrollTo(0, 0);
  }


  /* ---------- потянуть вниз, чтобы обновить ---------- */
  var TRIGGER = 64, MAXPULL = 104;
  var pullEl = null, startY = 0, pullDist = 0, pulling = false, refreshing = false;

  function pullNode() {
    if (!pullEl) {
      pullEl = el('div', 'pull');
      pullEl.appendChild(el('span', 'pull-label', ''));
      document.body.appendChild(pullEl);
    }
    return pullEl;
  }
  function showPull(dist, text) {
    var n = pullNode();
    pullDist = dist;
    n.style.transform = 'translateY(' + Math.min(dist, MAXPULL) + 'px)';
    n.style.opacity = Math.min(1, dist / 36);
    n.firstChild.textContent = text;
  }
  function hidePull() {
    pullDist = 0;
    if (!pullEl) return;
    pullEl.style.transition = 'transform .25s ease, opacity .25s ease';
    pullEl.style.transform = 'translateY(0)';
    pullEl.style.opacity = '0';
    setTimeout(function () { if (pullEl) pullEl.style.transition = ''; }, 280);
  }

  function toast(msg) {
    var t = el('div', 'toast', msg);
    document.body.appendChild(t);
    setTimeout(function () { t.setAttribute('data-out', '1'); }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3100);
  }

  function onList() { var h = location.hash; return !h || h === '#' || h === '#/'; }

  document.addEventListener('touchstart', function (e) {
    if (refreshing || !onList() || e.touches.length !== 1 || window.scrollY > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!pulling) return;
    if (window.scrollY > 0) { pulling = false; hidePull(); return; }
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0) { hidePull(); return; }
    e.preventDefault();
    var d = dy * 0.55;
    showPull(d, d >= TRIGGER ? 'Отпустите — проверю новое' : 'Потяните, чтобы обновить');
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!pulling) return;
    pulling = false;
    if (pullDist >= TRIGGER) refresh(); else hidePull();
  });

  function refresh() {
    refreshing = true;
    showPull(TRIGGER, 'Проверяю…');
    var finish = function (msg) { refreshing = false; hidePull(); if (msg) toast(msg); };

    if (navigator.onLine === false) {
      finish('Нет сети. Загляните ещё раз, когда появится интернет');
      return;
    }
    var sw = navigator.serviceWorker;
    if (!sw || !sw.controller) { location.reload(); return; }

    var ch = new MessageChannel(), done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; finish('Сервер не ответил. Попробуйте ещё раз'); }
    }, 15000);

    ch.port1.onmessage = function (ev) {
      if (done) return;
      done = true; clearTimeout(timer);
      var d = ev.data || {};
      if (!d.ok) { finish('Не получилось обновить — нет связи'); return; }
      if (d.version && d.version !== window.CONTENT_VERSION) {
        var added = d.count - (window.STORIES || []).length;
        try { sessionStorage.setItem('read.updated', String(added)); } catch (e2) {}
        location.reload();
        return;
      }
      finish('Новых рассказов нет');
    };
    sw.controller.postMessage({ type: 'refresh' }, [ch.port2]);
    if (sw.getRegistration) sw.getRegistration().then(function (r) { if (r) r.update(); }).catch(function () {});
  }

  function announceUpdate() {
    try {
      var upd = sessionStorage.getItem('read.updated');
      if (upd === null) return;
      sessionStorage.removeItem('read.updated');
      var n = parseInt(upd, 10) || 0;
      toast(n > 0
        ? 'Добавлено ' + n + ' ' + plural(n, 'рассказ', 'рассказа', 'рассказов')
        : 'Рассказы обновлены');
    } catch (e) {}
  }

  /* ---------- роутер ---------- */
  function route() {
    closeSheet();
    var h = location.hash || '#/';
    if (h.indexOf('#/s/') === 0) viewStory(h.slice(4));
    else if (h === '#/words') viewWords();
    else viewList();
  }
  window.addEventListener('hashchange', route);
  route();
  syncThemeButtons();
  announceUpdate();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
