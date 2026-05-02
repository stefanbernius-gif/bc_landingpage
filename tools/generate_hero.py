import os
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

FAL_KEY = os.getenv("FAL_KEY")
OUTPUT_DIR = Path("assets")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "Authorization": f"Key {FAL_KEY}",
    "Content-Type": "application/json",
}

PROMPT = """
Abstract data network visualization for a premium B2B consulting website hero.
Deep navy blue (#002349) background — very dark, almost black on the left third for white text overlay.
Right two-thirds: a luminous web of interconnected nodes and edges — a knowledge graph or neural network.
Nodes are glowing turquoise (#37C3C4) orbs of varying sizes, some larger and brighter as hub nodes.
Edges are thin turquoise lines connecting nodes, some solid, some fading with a pulse-glow effect.
The network radiates outward from a central bright cluster on the right, creating depth and motion.
Subtle secondary connections in a deeper teal, giving layered dimensionality.
A faint hexagonal grid underlays the entire background in very dark navy — barely visible, structural.
The overall effect: a living, intelligent data web — strategic, precise, technological.
No people, no text, no logos, no charts. Pure abstract network geometry and light.
Wide 16:9 landscape, 1920x1080. Extremely high detail on the right two-thirds. Left third stays dark.
"""

def generate():
    print("Generating hero background image...")
    payload = {
        "prompt": PROMPT.strip(),
        "image_size": {"width": 1920, "height": 1080},
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
    out_path = OUTPUT_DIR / "hero-bg.jpg"
    out_path.write_bytes(img_resp.content)
    print(f"Saved → {out_path}")
    return str(out_path)

if __name__ == "__main__":
    try:
        p = generate()
        print(f"Done: {p}")
    except Exception as e:
        print(f"ERROR: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text)
