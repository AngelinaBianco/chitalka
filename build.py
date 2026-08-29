#!/usr/bin/env python3
"""Собирает content.js из stories/raw.json + stories/gloss-*.txt.
Падает, если у какого-то слова в тексте нет перевода."""
import json, re, os, sys, hashlib

base = os.path.dirname(os.path.abspath(__file__))
stories = json.load(open(base + '/stories/raw.json', encoding='utf-8'))

def read_gloss(path):
    g, cur = {}, None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        if line.startswith('#'):
            cur = line[1:].strip(); g[cur] = {}; continue
        parts = line.split('|')
        if len(parts) != 3:
            sys.exit('Кривая строка в %s: %s' % (path, line))
        f, t, b = parts
        g[cur][f.strip().lower()] = {'t': t.strip(), 'b': b.strip()}
    return g

G = {}
for name in ('gloss-it.txt', 'gloss-de.txt', 'common-it.txt', 'common-de.txt'):
    for section, entries in read_gloss(base + '/stories/' + name).items():
        G.setdefault(section, {}).update(entries)

# Общий словарь языка: сначала то, что записано в common-<язык>,
# затем всё, что уже переведено в других рассказах этого языка.
common = {'it': {}, 'de': {}}
for lang in common:
    common[lang].update(G.get('common-' + lang, {}))
    for section, entries in G.items():
        if not section.startswith(lang + '-'):
            continue
        for form, entry in entries.items():
            common[lang].setdefault(form, entry)

bad = 0
for s in stories:
    forms = sorted(set(w.lower() for w in re.findall(r'[^\W\d_]+', ' '.join(s['paragraphs']), re.UNICODE)))
    own = G.get(s['id'], {})
    pool = common[s['lang']]
    missing = [f for f in forms if f not in own and f not in pool]
    if missing:
        print(s['id'], 'нет перевода:', ', '.join(missing)); bad = 1
    s['glossary'] = {f: (own[f] if f in own else pool[f]) for f in forms if f in own or f in pool}

if bad:
    sys.exit('Сборка остановлена.')

payload = json.dumps(stories, ensure_ascii=False, separators=(',', ':'))
version = hashlib.sha1(payload.encode('utf-8')).hexdigest()[:10]
open(base + '/content.js', 'w', encoding='utf-8').write(
    'window.CONTENT_VERSION = "%s";\nwindow.STORIES = %s;\n' % (version, payload))
print('Собрано: %d рассказов, %d слов (версия %s)' % (
    len(stories), sum(len(s['glossary']) for s in stories), version))
