import os
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

FAL_KEY = os.getenv("FAL_KEY")
OUTPUT_DIR = Path(".tmp/slides")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "Authorization": f"Key {FAL_KEY}",
    "Content-Type": "application/json",
}

PROMPT = """
A single 9:16 vertical image composed as a 2x3 photo grid — 6 equal illustrated panels in 2 columns and 3 rows,
separated by thin white gutters. Each panel is a hand-crafted editorial illustration:
loose collage aesthetic, mixed media feel, layered textures, cut-paper shapes combined with ink drawing,
muted navy and warm gold palette with cream and off-white accents, playful but intelligent,
human and slightly imperfect. Not flat design — illustrated. Not photorealistic — drawn and assembled.

Panel 1 (top-left) — FROM ZERO TO LIVE:
Illustrated collage. A hand-drawn clock face dissolving into two browser windows — one ghostly empty,
one glowing with a website. Ink line work over muted navy wash. Loose gestural marks around the clock.
Warm gold ink drips from the clock hands. Feels like a studio sketchbook page torn and reassembled.

Panel 2 (top-right) — INFRASTRUCTURE:
Cream background. Cut-paper collage of a laptop, a small envelope, and a receipt strip
layered at organic angles — edges slightly torn, not perfectly cut.
A coffee ring stain in the corner. Ink hatching for shadow. Warm and tactile.

Panel 3 (middle-left) — FRAMEWORK:
Deep navy wash background. A hand-drawn terminal window on the left, a loose sketch of a printed page on the right.
Between them a diagonal gold ink line. Gestural pencil marks in the margins.
Feels like a designer's working notebook mid-process.

Panel 4 (middle-right) — REAL DATA:
Navy background. Five overlapping illustrated file folders in slightly different cream and gold tones,
each with a hand-lettered score number: 54, 41, 49, 44, 35.
A magnifying glass drawn in loose ink strokes laid across them at an angle.
Worn, layered, archival feeling — like found documents in a case file.

Panel 5 (bottom-left) — SERVICE CARDS:
Off-white background. Six illustrated cards sketched in ink — uneven borders, slightly wobbly lines,
gold checkmarks hand-drawn inside each. Cards overlap organically.
One card corner bent. Feels like index cards pinned to a studio wall.

Panel 6 (bottom-right) — THE RESULT:
Dark background with a deep navy ink wash. A loose gestural illustration of a laptop,
screen glowing gold and navy. Around it small celebratory marks — stars, arrows, small ink bursts.
Warm and human — the feeling of finishing something real.
"""

def generate():
    print("Generating 2x3 fotogrid — gpt-image-2...")
    payload = {
        "prompt": PROMPT.strip(),
        "image_size": {"width": 1080, "height": 1920},  # 9:16
        "num_images": 1,
        "quality": "high",
    }
    resp = requests.post(
        "https://fal.run/openai/gpt-image-2",
        json=payload,
        headers=HEADERS,
        timeout=180,
    )
    resp.raise_for_status()
    data = resp.json()
    image_url = data["images"][0]["url"]

    img_resp = requests.get(image_url, timeout=60)
    img_resp.raise_for_status()
    out_path = OUTPUT_DIR / "fotogrid_2x3.jpg"
    out_path.write_bytes(img_resp.content)
    print(f"  Saved → {out_path}")
    return str(out_path)

if __name__ == "__main__":
    try:
        p = generate()
        print(f"\nDone. Image saved to {p}")
    except Exception as e:
        print(f"ERROR: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text)
