#!/usr/bin/env python3
"""Собирает content.js из stories/raw.json + stories/gloss-*.txt.
Падает, если у какого-то слова в тексте нет перевода."""
import json, re, os, sys

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
for name in ('gloss-it.txt', 'gloss-de.txt'):
    G.update(read_gloss(base + '/stories/' + name))

bad = 0
for s in stories:
    forms = sorted(set(w.lower() for w in re.findall(r'[^\W\d_]+', ' '.join(s['paragraphs']), re.UNICODE)))
    gl = G.get(s['id'], {})
    missing = [f for f in forms if f not in gl]
    extra = [f for f in gl if f not in forms]
    if missing:
        print(s['id'], 'нет перевода:', ', '.join(missing)); bad = 1
    if extra:
        print(s['id'], 'лишние слова в словаре:', ', '.join(extra)); bad = 1
    s['glossary'] = {f: gl[f] for f in forms}

if bad:
    sys.exit('Сборка остановлена.')

open(base + '/content.js', 'w', encoding='utf-8').write(
    'window.STORIES = ' + json.dumps(stories, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('Собрано: %d рассказов, %d слов' % (len(stories), sum(len(s['glossary']) for s in stories)))
