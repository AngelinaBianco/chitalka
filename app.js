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
  function storiesOf(l) {
    return (window.STORIES || []).filter(function (s) { return s.lang === l; });
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

    var toWords = el('button', 'linkbtn', 'Мои слова ›');
    toWords.addEventListener('click', function () { location.hash = '#/words'; });
    top.appendChild(toWords);
    app.appendChild(top);

    var langs = el('div', 'langs');
    ['it', 'de'].forEach(function (l) {
      var b = el('button', 'lang');
      b.setAttribute('aria-pressed', l === lang ? 'true' : 'false');
      b.appendChild(el('span', null, LANGS[l].flag + '  ' + LANGS[l].name));
      var lv = storiesOf(l)[0];
      if (lv) b.appendChild(el('span', 'lvl', lv.level));
      b.addEventListener('click', function () { lang = l; save('read.lang', l); viewList(); });
      langs.appendChild(b);
    });
    app.appendChild(langs);

    var toc = el('div', 'toc');
    storiesOf(lang).forEach(function (s) {
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
    bar.appendChild(speakBtn);
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
    var back = el('button', 'linkbtn', '‹ Рассказы');
    back.addEventListener('click', function () { location.hash = '#/'; });
    top.appendChild(back);
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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
