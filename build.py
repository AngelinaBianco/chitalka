#!/usr/bin/env python3
"""Собирает content.js из stories/raw.json + stories/gloss-*.txt.
Падает, если у какого-то слова в тексте нет перевода."""
import json, re, os, sys, hashlib

base = os.path.dirname(os.path.abspath(__file__))
stories = json.load(open(base + '/stories/raw.json', encoding='utf-8'))

SPLIT = re.compile(r'(?<=[.!?…»])\s+(?=[«"A-ZÀ-ÿА-Я])')

def read_ru(path):
    ru, cur = {}, None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        if line.startswith('#'):
            cur = line[1:].strip(); ru[cur] = {}; continue
        key, text = line.split('|', 1)
        ru[cur][key.strip()] = text.strip()
    return ru

RU = {}
for name in ('ru-it.txt', 'ru-de.txt'):
    RU.update(read_ru(base + '/stories/' + name))

def read_notes(path):
    notes, cur = {}, None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        if line.startswith('#'):
            cur = line[1:].strip(); notes[cur] = []; continue
        parts = line.split('|')
        if len(parts) != 3:
            sys.exit('Кривая заметка в %s: %s' % (path, line))
        notes[cur].append({'t': parts[0].strip(), 'e': parts[1].strip(), 'x': parts[2].strip()})
    return notes

NOTES = {}
for name in ('notes-it.txt', 'notes-de.txt'):
    NOTES.update(read_notes(base + '/stories/' + name))

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

# Грамматические заметки: пример обязан дословно встречаться в рассказе
for s_ in stories:
    notes = NOTES.get(s_['id'], [])
    if not notes:
        print(s_['id'], 'нет грамматических заметок'); bad = 1
    text = ' '.join(s_['paragraphs'])
    for note in notes:
        if note['e'] not in text:
            print(s_['id'], 'пример не найден в тексте:', note['e']); bad = 1
    s_['notes'] = notes

# Фразы с переводом: каждая фраза рассказа должна быть переведена
for s_ in stories:
    ru = RU.get(s_['id'], {})
    para_out = []
    for pi, para in enumerate(s_['paragraphs']):
        sents = SPLIT.split(para)
        row = []
        for si, sent in enumerate(sents):
            key = '%d.%d' % (pi, si)
            if key not in ru:
                print(s_['id'], 'нет перевода фразы', key + ':', sent); bad = 1
                row.append([sent, ''])
            else:
                row.append([sent, ru[key]])
        para_out.append(row)
    extra_ru = [k for k in ru if k not in
                {'%d.%d' % (pi, si) for pi, para in enumerate(s_['paragraphs'])
                 for si in range(len(SPLIT.split(para)))}]
    if extra_ru:
        print(s_['id'], 'лишние переводы фраз:', ', '.join(sorted(extra_ru))); bad = 1
    s_['paragraphs'] = para_out

if bad:
    sys.exit('Сборка остановлена.')

payload = json.dumps(stories, ensure_ascii=False, separators=(',', ':'))
version = hashlib.sha1(payload.encode('utf-8')).hexdigest()[:10]
open(base + '/content.js', 'w', encoding='utf-8').write(
    'window.CONTENT_VERSION = "%s";\nwindow.STORIES = %s;\n' % (version, payload))
print('Собрано: %d рассказов, %d слов, %d фраз (версия %s)' % (
    len(stories), sum(len(s['glossary']) for s in stories),
    sum(len(row) for s in stories for row in s['paragraphs']), version))
