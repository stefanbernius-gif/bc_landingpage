#!/usr/bin/env python3
"""Build the AI-Visibility comparison cluster for berniusconsulting.com/insights/.

Why this exists instead of `build_insights_pages.py`:
    The 12 original insights pages were hand-upgraded AFTER they were generated
    (Person author schema, publisher logo, dateModified, per-article FAQPage,
    hand-written meta descriptions, local fingerprinted CSS instead of the
    Tailwind CDN). `build_insights_pages.py` still emits the OLD shape, so
    re-running it would silently destroy ~120 lines of improvements per page.

    This tool instead fills `tools/comparison_template.html`, which was extracted
    mechanically from the current DEPLOYED page and verified to round-trip
    byte-identically. It only ever writes the slugs listed in BUILD.

Input:  .tmp/articles/<slug>.html   (hand-authored clean HTML: h1 + body)
Output: insights/<slug>.html

Usage:  python3 tools/build_comparison_pages.py
"""
import html as html_mod
import json
import os
import re
from datetime import datetime

from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, ".tmp", "articles")
OUT_DIR = os.path.join(ROOT, "insights")
TEMPLATE_PATH = os.path.join(ROOT, "tools", "comparison_template.html")

BASE = "https://www.berniusconsulting.com"

ALLOWED_TAGS = {"p", "h2", "h3", "ul", "ol", "li", "a", "strong", "em",
                "table", "thead", "tbody", "tr", "th", "td"}

# Every article on the site, so related-card links can point at existing pages too.
# slug -> (category, card title, card blurb)
REGISTRY = {
    # ---- existing 12 (not rebuilt by this tool; listed for related links only) ----
    "digital-presence-audit-revenue-leaks-worth": ("Audits & ROI", "What a Digital Presence Audit Reveals About Your Revenue Leaks — and Why It's Worth $8,000 a Month", ""),
    "5-conversion-gaps-draining-revenue": ("Revenue Leaks", "5 Conversion Gaps That Are Silently Draining Your Revenue", ""),
    "search-visibility-revenue-problem": ("Revenue Leaks", "Why Search Visibility Is a Revenue Problem, Not Just a Vanity Metric", ""),
    "hidden-costs-outdated-digital-strategy": ("Revenue Leaks", "The Hidden Costs of Outdated Digital Strategy for Small and Medium Businesses", ""),
    "diy-digital-presence-audit-checklist": ("DIY Audit", "DIY Digital Presence Audit Checklist: Find Your Biggest Revenue Leaks in 30 Minutes", ""),
    "identify-revenue-leaks-website": ("DIY Audit", "How to Identify Revenue Leaks on Your Website Yourself", ""),
    "generalist-agency-vs-revenue-recovery-specialist": ("Hiring Guides", "Generalist Agency vs. Revenue Recovery Specialist: What's the Real Difference", ""),
    "choose-digital-auditor-7-questions": ("Hiring Guides", "How to Choose a Digital Auditor: 7 Questions That Save You Thousands", ""),
    "revenue-focused-digital-consultant-mexico-city": ("Hiring Guides", "How to Find a Revenue-Focused Digital Consultant in Mexico City", ""),
    "smb-hiring-consultant-revenue-guarantee": ("Hiring Guides", "The SMB Owner's Guide to Hiring a Consultant with an $8K/Month Revenue Guarantee", ""),
    "scored-audit-reports-roi": ("Audits & ROI", "Why 0–100 Scored Audit Reports Deliver Better ROI Than Vague Recommendations", ""),
    "paid-digital-audit-pricing-process-guarantees": ("Audits & ROI", "Paid Digital Audit Pricing: What to Expect from Pricing, Process, and Guarantees", ""),
    # ---- new AI Visibility cluster ----
    "best-ai-visibility-tools": ("AI Visibility", "Best AI Visibility Tools in 2026, Compared on Verified Pricing", ""),
    "profound-alternatives": ("AI Visibility", "6 Profound Alternatives in 2026 (Verified Pricing, Free Options Included)", ""),
    "profound-vs-peec-ai": ("AI Visibility", "Profound vs Peec AI: Which Is Actually Cheaper at Entry Level?", ""),
    "track-ai-visibility-free": ("AI Visibility", "How to Check If ChatGPT Mentions Your Brand — Free, in 30 Minutes", ""),
}

# Only these slugs are written. Existing pages are never touched.
# slug -> config
BUILD = {
    "best-ai-visibility-tools": {
        "title": "Best AI Visibility Tools in 2026, Compared on Verified Pricing",
        "description": "Seven AI visibility tools compared on pricing taken from the vendors' own pages on 3 August 2026 — not from other roundups, which contradicted each other by up to 30x.",
        "date": "2026-08-03",
        "updated": "2026-08-03",
    },
    "profound-alternatives": {
        "title": "6 Profound Alternatives in 2026 (Verified Pricing, Free Options Included)",
        "description": "Profound's entry plan is $99/month and tracks ChatGPT only. Six alternatives compared on first-party pricing verified 3 August 2026, including one genuinely free tier.",
        "date": "2026-08-03",
        "updated": "2026-08-03",
    },
    "profound-vs-peec-ai": {
        "title": "Profound vs Peec AI: Which Is Actually Cheaper at Entry Level?",
        "description": "Profound Starter is $99/month for ChatGPT only. Peec AI Starter is $80/month for three engines. A head-to-head on pricing verified from both vendors on 3 August 2026.",
        "date": "2026-08-03",
        "updated": "2026-08-03",
    },
    "track-ai-visibility-free": {
        "title": "How to Check If ChatGPT Mentions Your Brand — Free, in 30 Minutes",
        "description": "The manual 10-query method we run before recommending anyone buy an AI visibility tool. No subscription, no trial, about 30 minutes — and it tells you whether you need a tracker at all.",
        "date": "2026-08-03",
        "updated": "2026-08-03",
    },
}


def sanitize(raw):
    """Whitelist tags, strip attributes, tag tables. Returns (title, content_html, words)."""
    soup = BeautifulSoup(raw, "lxml")
    body = soup.body or soup

    title_parts = []
    for h1 in body.find_all("h1"):
        title_parts.append(h1.get_text(strip=True))
        h1.decompose()
    title = re.sub(r"\s+", " ", " ".join(title_parts)).strip()

    for tag in body.find_all(True):
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
    for tag in body.find_all(True):
        href = tag.get("href") if tag.name == "a" else None
        tag.attrs = {}
        if href:
            tag["href"] = href
    for table in body.find_all("table"):
        table["class"] = "article-table"

    # "Key Takeaways" h2 + the run of lists/paras after it -> gold callout box.
    # Must run AFTER the whitelist pass above, or the <div> gets unwrapped.
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

    for p in body.find_all("p"):
        if not p.get_text(strip=True):
            p.decompose()

    words = len(body.get_text(" ", strip=True).split())
    content = "".join(str(c) for c in body.children if str(c).strip())
    return title, content, words


def related_for(slug):
    cat = REGISTRY[slug][0]
    same = [s for s in REGISTRY if s != slug and REGISTRY[s][0] == cat]
    rest = [s for s in REGISTRY if s != slug and REGISTRY[s][0] != cat]
    return (same + rest)[:3]


RELATED_CARD = """        <a href="{slug}.html" class="rel-card flex flex-col rounded-2xl border border-gray-200 bg-white p-7">
          <div class="mb-3 type-eyebrow" style="color:#7A5C1E;">{category}</div>
          <h3 class="type-h3" style="color:#002349; font-size:1.0625rem;">{title}</h3>
          <span class="mt-5 inline-flex items-center type-label" style="color:#7A5C1E;">Read article <svg class="ml-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></span>
        </a>"""


def esc(s):
    return html_mod.escape(s, quote=True)


def schema_block(nodes):
    """Render extra @graph nodes exactly as the deployed pages do: leading comma, 6-space indent."""
    if not nodes:
        return ""
    out = []
    for n in nodes:
        body = json.dumps(n, ensure_ascii=False, indent=2)
        body = "\n".join("      " + ln for ln in body.splitlines())
        out.append(body)
    return ",\n" + ",\n".join(out)


def extra_schema_for(slug, cfg):
    """Load optional per-slug JSON-LD nodes from .tmp/schema/<slug>.json."""
    path = os.path.join(ROOT, ".tmp", "schema", f"{slug}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        nodes = json.load(f)
    return nodes if isinstance(nodes, list) else [nodes]


def main():
    template = open(TEMPLATE_PATH, encoding="utf-8").read()

    for slug, cfg in BUILD.items():
        src = os.path.join(SRC_DIR, f"{slug}.html")
        if not os.path.exists(src):
            print(f"MISS {slug} (no source at {src})")
            continue

        _, content, words = sanitize(open(src, encoding="utf-8").read())
        reading_time = max(1, round(words / 200))

        content = "\n".join("      " + ln for ln in content.splitlines() if ln.strip())
        related = "\n".join(
            RELATED_CARD.format(slug=s, category=esc(REGISTRY[s][0]), title=esc(REGISTRY[s][1]))
            for s in related_for(slug)
        )

        d = datetime.strptime(cfg["date"], "%Y-%m-%d")
        u = datetime.strptime(cfg["updated"], "%Y-%m-%d")

        page = template.format(
            TITLE=esc(cfg["title"]),
            DESC=esc(cfg["description"]),
            SLUG=slug,
            CATEGORY=esc(REGISTRY[slug][0]),
            DATE_ISO=cfg["date"],
            UPDATED_ISO=cfg["updated"],
            DATE_DISP=d.strftime("%B %-d, %Y"),
            UPDATED_DISP=u.strftime("%b %-d, %Y"),
            READING_TIME=reading_time,
            EXTRA_SCHEMA=schema_block(extra_schema_for(slug, cfg)),
            CONTENT=content,
            RELATED=related,
        )

        # The schema "description"/"headline" fields sit inside JSON, not HTML —
        # re-escape those two occurrences as JSON strings.
        page = page.replace(
            f'"headline": "{esc(cfg["title"])}"',
            '"headline": ' + json.dumps(cfg["title"], ensure_ascii=False),
        ).replace(
            f'"description": "{esc(cfg["description"])}"',
            '"description": ' + json.dumps(cfg["description"], ensure_ascii=False),
        )

        out = os.path.join(OUT_DIR, f"{slug}.html")
        with open(out, "w", encoding="utf-8") as f:
            f.write(page)
        print(f"OK   {slug}  ({words} words, {reading_time} min)")


if __name__ == "__main__":
    main()
