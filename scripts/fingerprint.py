#!/usr/bin/env python3
"""Content-hash static assets and rewrite references in public HTML, so they can
be cached long-term (immutable) once a real CDN (Cloudflare/Netlify) is in front.
Re-run after any CSS/image change (scripts/build.sh chains it after the CSS build)."""
import hashlib, re, os, glob, shutil

A = 'assets'
public = ['index.html', 'privacy.html', 'content-engine/index.html'] + sorted(glob.glob('insights/*.html'))

def h(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()[:10]

# (canonical file, glob of hashed variants, filename regex in HTML, hashed-name builder)
jobs = []
css = h(f'{A}/tailwind.min.css'); css_name = f'tailwind.min.{css}.css'
shutil.copyfile(f'{A}/tailwind.min.css', f'{A}/{css_name}')
jobs.append((f'{A}/tailwind.min.*.css', css_name, re.compile(r'tailwind\.min(?:\.[0-9a-f]+)?\.css')))

img = h(f'{A}/hero-bg.webp'); img_name = f'hero-bg.{img}.webp'
shutil.copyfile(f'{A}/hero-bg.webp', f'{A}/{img_name}')
jobs.append((f'{A}/hero-bg.*.webp', img_name, re.compile(r'hero-bg(?:\.[0-9a-f]+)?\.(?:jpg|webp)')))

# remove stale hashed copies (keep only current)
for pattern, keep, _ in jobs:
    for f in glob.glob(pattern):
        if os.path.basename(f) != keep:
            os.remove(f)

# rewrite references (filename only; path prefix like ../assets/ is preserved)
for p in public:
    s = open(p, encoding='utf-8').read()
    for _, name, rx in jobs:
        s = rx.sub(name, s)
    open(p, 'w', encoding='utf-8').write(s)

print("fingerprinted:", css_name, "+", img_name)
