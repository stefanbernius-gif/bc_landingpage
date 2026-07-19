#!/usr/bin/env python3
"""Build styled article pages for berniusconsulting.com/insights/ from Google Docs HTML exports.

Input:  .tmp/articles/<slug>.html   (File > Export > HTML from Google Docs, via browser session)
Output: insights/<slug>.html        (fully styled, same design system as index.html)

Usage:  python3 tools/build_insights_pages.py
"""
import glob
import html as html_mod
import os
import re
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, ".tmp", "articles")
OUT_DIR = os.path.join(ROOT, "insights")

# slug -> (category, card title for related links) — must match insights/index.html
ARTICLES = {
    "digital-presence-audit-revenue-leaks-worth": ("Audits & ROI", "What a Digital Presence Audit Reveals About Your Revenue Leaks — and Why It's Worth $8,000 a Month"),
    "5-conversion-gaps-draining-revenue": ("Revenue Leaks", "5 Conversion Gaps That Are Silently Draining Your Revenue"),
    "search-visibility-revenue-problem": ("Revenue Leaks", "Why Search Visibility Is a Revenue Problem, Not Just a Vanity Metric"),
    "hidden-costs-outdated-digital-strategy": ("Revenue Leaks", "The Hidden Costs of Outdated Digital Strategy for Small and Medium Businesses"),
    "diy-digital-presence-audit-checklist": ("DIY Audit", "DIY Digital Presence Audit Checklist: Find Your Biggest Revenue Leaks in 30 Minutes"),
    "identify-revenue-leaks-website": ("DIY Audit", "How to Identify Revenue Leaks on Your Website Yourself"),
    "generalist-agency-vs-revenue-recovery-specialist": ("Hiring Guides", "Generalist Agency vs. Revenue Recovery Specialist: What's the Real Difference"),
    "choose-digital-auditor-7-questions": ("Hiring Guides", "How to Choose a Digital Auditor: 7 Questions That Save You Thousands"),
    "revenue-focused-digital-consultant-mexico-city": ("Hiring Guides", "How to Find a Revenue-Focused Digital Consultant in Mexico City"),
    "smb-hiring-consultant-revenue-guarantee": ("Hiring Guides", "The SMB Owner's Guide to Hiring a Consultant with an $8K/Month Revenue Guarantee"),
    "scored-audit-reports-roi": ("Audits & ROI", "Why 0–100 Scored Audit Reports Deliver Better ROI Than Vague Recommendations"),
    "paid-digital-audit-pricing-process-guarantees": ("Audits & ROI", "Paid Digital Audit Pricing: What to Expect from Pricing, Process, and Guarantees"),
}

ALLOWED_TAGS = {"p", "h2", "h3", "ul", "ol", "li", "a", "strong", "em",
                "table", "thead", "tbody", "tr", "th", "td"}


def parse_formatting_classes(style_text):
    """Extract class names that mean bold / italic from the doc's own <style> block."""
    bold, italic = set(), set()
    for m in re.finditer(r"\.(c\d+)\s*\{([^}]*)\}", style_text):
        cls, props = m.group(1), m.group(2)
        if re.search(r"font-weight\s*:\s*(700|bold)", props):
            bold.add(cls)
        if re.search(r"font-style\s*:\s*italic", props):
            italic.add(cls)
    return bold, italic


def clean_link(href):
    """Unwrap Google redirect links (google.com/url?q=...)."""
    if not href:
        return href
    if "google.com/url" in href:
        q = parse_qs(urlparse(href).query).get("q")
        if q:
            return q[0]
    return href


def extract_article(path):
    raw = open(path, encoding="utf-8").read()
    style_m = re.search(r"<style[^>]*>(.*?)</style>", raw, re.S)
    bold, italic = parse_formatting_classes(style_m.group(1) if style_m else "")

    soup = BeautifulSoup(raw, "lxml")
    body = soup.body

    # Publish date from "PREPARED FOR ... · JULY 16, 2026" meta line, then drop it
    date_iso, date_disp = None, None
    first_p = body.find("p")
    if first_p and "PREPARED FOR" in first_p.get_text():
        m = re.search(r"·\s*([A-Za-z]+ \d{1,2}, \d{4})", first_p.get_text())
        if m:
            d = datetime.strptime(m.group(1), "%B %d, %Y")
            date_iso, date_disp = d.strftime("%Y-%m-%d"), d.strftime("%B %-d, %Y")
        first_p.decompose()

    # Title from h1(s) — Google sometimes splits one title across two h1s
    title_parts = []
    for h1 in body.find_all("h1"):
        title_parts.append(h1.get_text(strip=True))
        h1.decompose()
    title = re.sub(r"\s+", " ", " ".join(title_parts)).strip()

    # Convert spans: bold -> strong, italic -> em, else unwrap
    for span in body.find_all("span"):
        classes = set(span.get("class", []))
        if classes & bold:
            span.name = "strong"
            span.attrs = {}
        elif classes & italic:
            span.name = "em"
            span.attrs = {}
        else:
            span.unwrap()

    # Sanitize: unwrap anything not whitelisted, strip all attributes
    for tag in body.find_all(True):
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
    for tag in body.find_all(True):
        href = tag.get("href") if tag.name == "a" else None
        tag.attrs = {}
        if href:
            tag["href"] = clean_link(href)
    for table in body.find_all("table"):
        table["class"] = "article-table"

    # "Key Takeaways" h2 + following list -> callout box
    for h2 in body.find_all("h2"):
        if h2.get_text(strip=True).lower() == "key takeaways":
            siblings = []
            sib = h2.find_next_sibling()
            while sib and sib.name in ("ul", "ol", "p"):
                siblings.append(sib)
                sib = sib.find_next_sibling()
            box = soup.new_tag("div", **{"class": "takeaways"})
            h2.insert_before(box)
            box.append(h2.extract())
            for s in siblings:
                box.append(s.extract())
            break

    # Drop pipeline boilerplate lines (footer + AI disclaimer header)
    for p in body.find_all("p"):
        t = p.get_text(strip=True)
        if (t.startswith("Prepared by Bernius Consulting") or "Fuel the next one" in t
                or "AI-drafted" in t or "written by an AI pipeline" in t):
            p.decompose()

    # Drop empty paragraphs
    for p in body.find_all("p"):
        if not p.get_text(strip=True):
            p.decompose()

    text = body.get_text(" ", strip=True)
    words = len(text.split())
    reading_time = max(1, round(words / 200))

    first_para = body.find("p")
    excerpt = ""
    if first_para:
        excerpt = first_para.get_text(" ", strip=True)
        if len(excerpt) > 160:
            excerpt = excerpt[:157].rsplit(" ", 1)[0] + "…"

    content = "".join(str(c) for c in body.children if str(c).strip())
    return title, date_iso, date_disp, reading_time, excerpt, content


def related_for(slug):
    cat = ARTICLES[slug][0]
    same = [s for s in ARTICLES if s != slug and ARTICLES[s][0] == cat]
    rest = [s for s in ARTICLES if s != slug and ARTICLES[s][0] != cat]
    return (same + rest)[:3]


TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-4MWZQEG2HE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-4MWZQEG2HE');
  </script>

  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | Bernius Consulting</title>
  <meta name="description" content="{excerpt}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.berniusconsulting.com/insights/{slug}.html" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://www.berniusconsulting.com/insights/{slug}.html" />
  <meta property="og:title" content="{title} | Bernius Consulting" />
  <meta property="og:description" content="{excerpt}" />
  <meta property="og:image" content="https://www.berniusconsulting.com/assets/og-image.jpg" />
  <meta property="article:published_time" content="{date_iso}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title} | Bernius Consulting" />
  <meta name="twitter:description" content="{excerpt}" />
  <meta name="twitter:image" content="https://www.berniusconsulting.com/assets/og-image.jpg" />

  <!-- Schema: Article + Breadcrumb -->
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "Article",
        "headline": "{title_json}",
        "description": "{excerpt_json}",
        "datePublished": "{date_iso}",
        "author": {{ "@type": "Organization", "name": "Bernius Consulting", "url": "https://www.berniusconsulting.com" }},
        "publisher": {{ "@type": "Organization", "name": "Bernius Consulting", "url": "https://www.berniusconsulting.com" }},
        "mainEntityOfPage": "https://www.berniusconsulting.com/insights/{slug}.html",
        "image": "https://www.berniusconsulting.com/assets/og-image.jpg"
      }},
      {{
        "@type": "BreadcrumbList",
        "itemListElement": [
          {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.berniusconsulting.com/" }},
          {{ "@type": "ListItem", "position": 2, "name": "Insights", "item": "https://www.berniusconsulting.com/insights/" }},
          {{ "@type": "ListItem", "position": 3, "name": "{title_json}" }}
        ]
      }}
    ]
  }}
  </script>

  <link rel="icon" type="image/png" href="../favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
  <link rel="shortcut icon" href="../favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="../apple-touch-icon.png" />
  <link rel="manifest" href="../site.webmanifest" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{
      theme: {{
        extend: {{
          colors: {{
            navy: '#002349',
            gold: '#BC9042',
            'gold-light': '#E7C874',
            teal: '#37C3C4',
          }},
          fontFamily: {{
            sans: ['Inter', 'system-ui', 'sans-serif'],
          }}
        }}
      }}
    }}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
  <style>
    html {{ scroll-behavior: smooth; }}

    body {{
      font-family: 'Inter', system-ui, sans-serif;
      font-kerning: normal;
      font-optical-sizing: auto;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }}

    .type-h1 {{ font-size: clamp(1.875rem, 3.5vw + 0.5rem, 2.75rem); font-weight: 800; line-height: 1.12; letter-spacing: -0.02em; }}
    .type-h2 {{ font-size: clamp(1.5rem, 2.5vw + 0.5rem, 2.25rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.015em; }}
    .type-h3 {{ font-size: clamp(1.125rem, 1.5vw + 0.25rem, 1.375rem); font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; }}
    .type-body {{ font-size: 0.9375rem; font-weight: 400; line-height: 1.65; }}
    .type-eyebrow {{ font-size: 0.6875rem; font-weight: 600; line-height: 1.4; letter-spacing: 0.1em; text-transform: uppercase; }}
    .type-label {{ font-size: 0.8125rem; font-weight: 600; line-height: 1.4; letter-spacing: 0.02em; }}
    .num-tabular {{ font-variant-numeric: tabular-nums; }}
    h1, h2, h3, h4, blockquote {{ text-wrap: balance; }}
    .gradient-gold {{ background: linear-gradient(135deg, #BC9042 0%, #E7C874 50%, #BC9042 100%); }}

    /* ── Article hero entrance ── */
    .hero-headline {{ animation: heroFadeUp 0.9s cubic-bezier(.4,0,.2,1) both; }}
    .hero-sub {{ animation: heroFadeUp 0.9s 0.2s cubic-bezier(.4,0,.2,1) both; }}
    @keyframes heroFadeUp {{
      from {{ opacity: 0; transform: translateY(20px); }}
      to   {{ opacity: 1; transform: translateY(0); }}
    }}

    /* ── Article body (prose) ── */
    .article-body {{ font-size: 1.0625rem; line-height: 1.8; color: #374151; }}
    .article-body > p {{ margin-bottom: 1.5rem; }}
    .article-body > p:first-of-type {{ font-size: 1.1875rem; line-height: 1.75; color: #111827; }}
    .article-body h2 {{
      font-size: clamp(1.375rem, 2vw + 0.5rem, 1.75rem);
      font-weight: 800; line-height: 1.2; letter-spacing: -0.015em;
      color: #002349; margin: 3rem 0 1rem;
    }}
    .article-body h3 {{
      font-size: 1.1875rem; font-weight: 700; line-height: 1.35;
      color: #002349; margin: 2.25rem 0 0.75rem;
    }}
    .article-body ul {{ margin: 0 0 1.75rem; padding-left: 1.375rem; list-style-type: disc; }}
    .article-body ol {{ margin: 0 0 1.75rem; padding-left: 1.375rem; list-style-type: decimal; }}
    .article-body li {{ margin-bottom: 0.625rem; padding-left: 0.25rem; }}
    .article-body ul li::marker {{ color: #BC9042; }}
    .article-body ol li::marker {{ color: #BC9042; font-weight: 700; }}
    .article-body strong {{ color: #002349; font-weight: 700; }}
    .article-body em {{ font-style: italic; }}
    .article-body a {{ color: #7A5C1E; text-decoration: underline; text-underline-offset: 2px; }}
    .article-body a:hover {{ color: #BC9042; }}

    /* Key takeaways callout */
    .takeaways {{
      background: #F7EFDD;
      border-left: 3px solid #BC9042;
      border-radius: 0 12px 12px 0;
      padding: 1.75rem 2rem;
      margin: 2.5rem 0;
    }}
    .takeaways h2 {{
      margin: 0 0 1rem !important;
      font-size: 0.8125rem !important;
      font-weight: 700 !important;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #7A5C1E !important;
    }}
    .takeaways ul {{ margin-bottom: 0 !important; }}
    .takeaways li:last-child {{ margin-bottom: 0; }}

    /* Tables */
    .article-table {{ width: 100%; border-collapse: collapse; margin: 0 0 2rem; font-size: 0.9375rem; }}
    .article-table th {{
      background: #002349; color: #fff; font-weight: 700; text-align: left;
      padding: 0.75rem 1rem; font-size: 0.8125rem; letter-spacing: 0.02em;
    }}
    .article-table td {{ padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: top; }}
    .article-table tr:nth-child(even) td {{ background: #f9fafb; }}
    .table-wrap {{ overflow-x: auto; margin-bottom: 2rem; }}
    .table-wrap .article-table {{ margin-bottom: 0; min-width: 560px; }}

    /* ── Related cards ── */
    .rel-card {{
      position: relative; overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,35,73,0.05);
      transition: transform 0.3s cubic-bezier(.4,0,.2,1), border-color 0.3s, box-shadow 0.3s;
    }}
    .rel-card::before {{
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #BC9042, #E7C874);
      transform: scaleX(0); transform-origin: left;
      transition: transform 0.45s cubic-bezier(.4,0,.2,1);
    }}
    .rel-card:hover {{ transform: translateY(-4px); border-color: rgba(188,144,66,0.6) !important; box-shadow: 0 16px 36px rgba(0,35,73,0.10); }}
    .rel-card:hover::before {{ transform: scaleX(1); }}
    .rel-card .type-h3 {{ transition: color 0.25s; }}
    .rel-card:hover .type-h3 {{ color: #7A5C1E !important; }}
    .rel-card .type-label svg {{ transition: transform 0.25s cubic-bezier(.4,0,.2,1); }}
    .rel-card:hover .type-label svg {{ transform: translateX(5px); }}

    /* ── Scroll reveal ── */
    .reveal {{ opacity: 0; transform: translateY(28px); transition: opacity 0.65s cubic-bezier(.4,0,.2,1), transform 0.65s cubic-bezier(.4,0,.2,1); }}
    .reveal.visible {{ opacity: 1; transform: translateY(0); }}

    a[href]:active {{ opacity: 0.85; transform: scale(0.98); }}
    header {{ transition: box-shadow 0.3s; }}
    header.scrolled {{ box-shadow: 0 4px 24px rgba(0,35,73,0.10); }}
    a:focus-visible, button:focus-visible {{ outline: 2px solid #BC9042; outline-offset: 3px; border-radius: 6px; }}

    #mobile-menu {{ max-height: 0; overflow: hidden; transition: max-height 0.35s cubic-bezier(.4,0,.2,1), opacity 0.25s; opacity: 0; }}
    #mobile-menu.open {{ max-height: 460px; opacity: 1; }}
    .ham-line {{ display: block; width: 20px; height: 2px; background: #002349; transition: transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.2s; transform-origin: center; }}
    #menu-btn.open .ham-line:nth-child(1) {{ transform: translateY(6px) rotate(45deg); }}
    #menu-btn.open .ham-line:nth-child(2) {{ opacity: 0; }}
    #menu-btn.open .ham-line:nth-child(3) {{ transform: translateY(-6px) rotate(-45deg); }}

    nav a {{ position: relative; }}
    nav a::after {{
      content: ''; position: absolute; bottom: -2px; left: 0; width: 100%; height: 1.5px;
      background: #BC9042; transform: scaleX(0); transform-origin: left;
      transition: transform 0.25s cubic-bezier(.4,0,.2,1);
    }}
    nav a:hover::after, nav a.active::after {{ transform: scaleX(1); }}
    nav a.active {{ color: #111827; }}

    .social-link {{ display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; }}

    #floating-cta {{ box-shadow: 0 8px 24px rgba(0,0,0,0.2); }}
    #floating-cta.pulse-once {{ animation: floatPulse 0.6s cubic-bezier(.4,0,.2,1) both; }}
    @keyframes floatPulse {{
      0%   {{ box-shadow: 0 0 0 0 rgba(188,144,66,0.5), 0 8px 24px rgba(0,0,0,0.2); }}
      100% {{ box-shadow: 0 0 0 10px rgba(188,144,66,0), 0 8px 24px rgba(0,0,0,0.2); }}
    }}

    @media (prefers-reduced-motion: reduce) {{
      *, *::before, *::after {{
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }}
      .reveal {{ opacity: 1; transform: none; }}
    }}
  </style>
</head>
<body class="font-sans bg-white text-gray-900 antialiased">

  <!-- ── NAV ── -->
  <header class="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
    <div class="mx-auto max-w-6xl px-6">
      <div class="flex items-center justify-between py-4">
        <a href="../index.html" class="flex items-center gap-2">
          <span class="text-xl font-black tracking-tight" style="color:#002349;">BERNIUS</span>
          <span class="type-eyebrow text-gray-400 mt-0.5">Consulting</span>
        </a>
        <nav class="hidden gap-8 text-sm font-medium text-gray-500 md:flex">
          <a href="../index.html#services" class="hover:text-gray-900 transition-colors">Services</a>
          <a href="./" class="active hover:text-gray-900 transition-colors">Insights</a>
          <a href="../content-engine/" class="hover:text-gray-900 transition-colors">Content Engine</a>
        </nav>
        <div class="flex items-center gap-3">
          <a href="../index.html#booking" class="hidden md:inline-flex rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50" style="border-color:#002349; color:#002349;">
            Book a Call
          </a>
          <button id="menu-btn" class="flex md:hidden flex-col gap-1.5 p-2 -mr-2 rounded-lg" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
            <span class="ham-line"></span>
            <span class="ham-line"></span>
            <span class="ham-line"></span>
          </button>
        </div>
      </div>

      <div id="mobile-menu" role="navigation" aria-label="Mobile navigation">
        <nav class="flex flex-col pb-4 gap-1">
          <a href="../index.html#services" class="mobile-nav-link rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Services</a>
          <a href="./" class="mobile-nav-link rounded-lg px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50 transition-colors">Insights</a>
          <a href="../content-engine/" class="mobile-nav-link rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Content Engine</a>
          <a href="../index.html#booking" class="mobile-nav-link mt-2 rounded-lg px-4 py-3 text-sm font-bold text-center text-white transition-opacity hover:opacity-90" style="background-color:#002349;">Book a Free Gap Call</a>
        </nav>
      </div>
    </div>
  </header>

  <!-- ── ARTICLE HERO ── -->
  <section class="relative overflow-hidden" style="background-color:#002349;">
    <div class="absolute inset-0 z-0" style="background-image:url('../assets/hero-bg.jpg'); background-size:cover; background-position:center right; opacity:0.25;"></div>
    <div class="absolute inset-0 z-0" style="background: linear-gradient(100deg, rgba(0,35,73,0.98) 30%, rgba(0,35,73,0.82) 100%);"></div>
    <div class="absolute top-0 left-0 right-0 h-1 z-10 gradient-gold"></div>

    <div class="relative z-10 mx-auto max-w-3xl px-6 py-16 md:py-24">
      <nav class="hero-headline mb-5 flex items-center gap-2 type-eyebrow" aria-label="Breadcrumb">
        <a href="./" class="hover:opacity-80 transition-opacity" style="color:#E7C874;">Insights</a>
        <span style="color:rgba(255,255,255,0.4);">›</span>
        <span style="color:rgba(255,255,255,0.55);">{category}</span>
      </nav>
      <h1 class="hero-headline type-h1 text-white">{title}</h1>
      <div class="hero-sub mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 type-label" style="color:rgba(255,255,255,0.55);">
        <span>{date_disp}</span>
        <span style="color:#BC9042;">·</span>
        <span>{reading_time} min read</span>
        <span style="color:#BC9042;">·</span>
        <span>{category}</span>
      </div>
    </div>
  </section>

  <!-- ── ARTICLE BODY ── -->
  <article class="py-16 md:py-20 bg-white">
    <div class="mx-auto max-w-3xl px-6 article-body">
{content}
    </div>
  </article>

  <!-- ── CTA BAND ── -->
  <section class="py-24" style="background-color:#002349;">
    <div class="mx-auto max-w-4xl px-6 text-center">
      <p class="mb-4 type-eyebrow" style="color:#E7C874;">Want this done for you?</p>
      <h2 class="type-h2 text-white">Get a scored 360° audit of your digital presence — results in 48 hours.</h2>
      <p class="mx-auto mt-5 max-w-xl type-body" style="color:rgba(255,255,255,0.72);">Every finding priced in USD, prioritised by impact. No retainer, no fluff.</p>
      <div class="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a href="../index.html#quiz" class="inline-flex items-center rounded-lg px-8 py-4 text-sm font-bold transition-opacity hover:opacity-90" style="background: linear-gradient(135deg, #BC9042, #E7C874); color:#002349;">
          Score My Presence — Free
          <svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </a>
        <a href="../index.html#booking" class="inline-flex items-center rounded-lg border px-8 py-4 text-sm font-semibold transition-colors hover:bg-white/5" style="border-color:rgba(255,255,255,0.35); color:#fff;">
          Book a Free Gap Call
        </a>
      </div>
    </div>
  </section>

  <!-- ── RELATED READING ── -->
  <section class="py-20 bg-gray-50">
    <div class="mx-auto max-w-6xl px-6">
      <p class="mb-3 type-eyebrow" style="color:#7A5C1E;">Keep Reading</p>
      <h2 class="mb-10 type-h2" style="color:#002349;">More from Insights</h2>
      <div class="grid gap-8 md:grid-cols-3">
{related}
      </div>
    </div>
  </section>

  <!-- ── FOOTER ── -->
  <footer class="border-t border-gray-100 py-14" style="background:#fafafa;">
    <div class="mx-auto max-w-6xl px-6">
      <div class="mb-8 flex flex-col items-center gap-6 md:flex-row md:justify-between">
        <a href="../index.html" class="flex items-center gap-2">
          <span class="text-lg font-black tracking-tight" style="color:#002349;">BERNIUS</span>
          <span class="text-xs font-bold tracking-widest uppercase text-gray-400">Consulting</span>
        </a>
        <nav class="flex flex-wrap justify-center gap-5 type-eyebrow text-gray-400">
          <a href="../index.html#faq" class="hover:text-gray-600">FAQ</a>
          <a href="./" class="hover:text-gray-600">Insights</a>
          <a href="../content-engine/" class="hover:text-gray-600">Content Engine</a>
          <a href="../index.html#booking" class="hover:text-gray-600">Book a Call</a>
        </nav>
        <div class="flex items-center gap-4 text-gray-400">
          <a href="https://www.linkedin.com/in/stefan-bernius-785b53355/" target="_blank" rel="noopener" aria-label="LinkedIn" class="social-link hover:text-gray-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://www.instagram.com/bernius.consulting" target="_blank" rel="noopener" aria-label="Instagram" class="social-link hover:text-gray-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
          </a>
          <a href="https://wa.me/527771080143" target="_blank" rel="noopener" aria-label="WhatsApp" class="social-link hover:text-gray-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </a>
        </div>
      </div>
      <div class="border-t border-gray-200 pt-6 flex flex-col items-center gap-3 md:flex-row md:justify-between">
        <p class="text-xs text-gray-400">© 2026 Bernius Consulting. All rights reserved. · <a href="/privacy" class="hover:text-gray-600">Privacy Policy</a></p>
        <div class="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <span>HubSpot Certified</span>
          <span>·</span>
          <span>n8n Certified</span>
          <span>·</span>
          <span>All prices USD</span>
          <span>·</span>
          <span>Payment via Stripe or PayPal</span>
        </div>
      </div>
    </div>
  </footer>

  <a href="https://calendly.com/stefan-bernius/video-call" target="_blank" rel="noopener"
     id="floating-cta"
     class="fixed bottom-6 right-6 z-50 hidden items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold shadow-xl transition-all hover:opacity-90"
     style="background: linear-gradient(135deg, #BC9042, #E7C874); color:#002349;">
    Book a Call <svg class="ml-1 inline-block h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>
  </a>

  <script>
    // ── Floating CTA ──
    const btn = document.getElementById('floating-cta');
    let btnShown = false;
    window.addEventListener('scroll', () => {{
      if (window.scrollY > 400) {{
        btn.classList.remove('hidden');
        btn.classList.add('inline-flex');
        if (!btnShown) {{
          btnShown = true;
          btn.classList.add('pulse-once');
          btn.addEventListener('animationend', () => btn.classList.remove('pulse-once'), {{ once: true }});
        }}
      }} else {{
        btn.classList.add('hidden');
        btn.classList.remove('inline-flex');
      }}
    }});

    // ── Scroll reveal ──
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('section, .rel-card').forEach((el) => {{
      if (reducedMotion) {{ el.classList.add('reveal', 'visible'); return; }}
      el.classList.add('reveal');
    }});
    const revealObserver = new IntersectionObserver((entries) => {{
      entries.forEach(e => {{ if (e.isIntersecting) {{ e.target.classList.add('visible'); revealObserver.unobserve(e.target); }} }});
    }}, {{ threshold: 0.08 }});
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ── Wrap tables for horizontal scroll on mobile ──
    document.querySelectorAll('.article-table').forEach(t => {{
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    }});

    // ── Mobile nav ──
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    menuBtn.addEventListener('click', () => {{
      const isOpen = mobileMenu.classList.toggle('open');
      menuBtn.classList.toggle('open', isOpen);
      menuBtn.setAttribute('aria-expanded', isOpen);
    }});
    document.querySelectorAll('.mobile-nav-link').forEach(link => {{
      link.addEventListener('click', () => {{
        mobileMenu.classList.remove('open');
        menuBtn.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }});
    }});

    // ── Scrolled nav shadow ──
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {{
      header.classList.toggle('scrolled', window.scrollY > 10);
    }});
  </script>

  <!-- Cookie banner -->
  <div id="cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#002349;color:#fff;padding:16px 24px;">
    <div style="max-width:1152px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:16px;justify-content:space-between;">
      <p style="margin:0;font-size:13px;line-height:1.5;flex:1;min-width:240px;">
        We use cookies to analyse site traffic and improve your experience. By continuing, you agree to our use of cookies.
      </p>
      <div style="display:flex;gap:10px;flex-shrink:0;">
        <button id="cookie-accept" style="background:linear-gradient(135deg,#BC9042,#E7C874);color:#002349;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer;">Accept</button>
        <button id="cookie-decline" style="background:transparent;color:#aaa;border:1px solid #444;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;">Decline</button>
      </div>
    </div>
  </div>
  <script>
    (function() {{
      if (!localStorage.getItem('cookie_consent')) {{
        document.getElementById('cookie-banner').style.display = 'block';
      }}
      document.getElementById('cookie-accept').addEventListener('click', function() {{
        localStorage.setItem('cookie_consent', 'accepted');
        document.getElementById('cookie-banner').style.display = 'none';
      }});
      document.getElementById('cookie-decline').addEventListener('click', function() {{
        localStorage.setItem('cookie_consent', 'declined');
        document.getElementById('cookie-banner').style.display = 'none';
      }});
    }})();
  </script>

</body>
</html>
"""

RELATED_CARD = """        <a href="{slug}.html" class="rel-card flex flex-col rounded-2xl border border-gray-200 bg-white p-7">
          <div class="mb-3 type-eyebrow" style="color:#7A5C1E;">{category}</div>
          <h3 class="type-h3" style="color:#002349; font-size:1.0625rem;">{title}</h3>
          <span class="mt-5 inline-flex items-center type-label" style="color:#7A5C1E;">Read article <svg class="ml-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></span>
        </a>"""


def esc(s):
    return html_mod.escape(s, quote=True)


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.html")))
    if not files:
        raise SystemExit(f"No exports found in {SRC_DIR}")

    for path in files:
        slug = os.path.basename(path)[:-5]
        if slug not in ARTICLES:
            print(f"SKIP {slug} (not in ARTICLES map)")
            continue

        title, date_iso, date_disp, reading_time, excerpt, content = extract_article(path)
        category = ARTICLES[slug][0]

        # Indent content lines for readability
        content = "\n".join("      " + line for line in content.splitlines() if line.strip())

        related = "\n".join(
            RELATED_CARD.format(slug=s, category=esc(ARTICLES[s][0]), title=esc(ARTICLES[s][1]))
            for s in related_for(slug)
        )

        page = TEMPLATE.format(
            slug=slug,
            title=esc(title),
            title_json=title.replace('"', '\\"'),
            excerpt=esc(excerpt),
            excerpt_json=excerpt.replace('"', '\\"'),
            category=esc(category),
            date_iso=date_iso or "2026-07-16",
            date_disp=date_disp or "July 2026",
            reading_time=reading_time,
            content=content,
            related=related,
        )

        out = os.path.join(OUT_DIR, f"{slug}.html")
        with open(out, "w", encoding="utf-8") as f:
            f.write(page)
        print(f"OK   {slug}  ({reading_time} min, {date_disp})")


if __name__ == "__main__":
    main()
