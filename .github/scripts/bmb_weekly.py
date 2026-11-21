"""Weekly price bands for the bill-barroso price quiz.

Pulls the AMPI San Miguel MLS list once (about 18 requests), keeps only
aggregates (count, % price-reduced, 21 quantiles of price per m2), and writes
bill-barroso/segs_m2.json as {"asof", "total", "seg"}. No listing records are
stored. Exits non-zero, leaving the old file in place, when the pull looks wrong.
Method: same as tools/build_segs.py in the BMB project folder.
"""
import datetime, json, math, os, pathlib, sys, time, urllib.request, collections as C

IID = os.environ["AMPI_IID"]
OUT = pathlib.Path("bill-barroso/segs_m2.json")
P = (20.9143, -100.7441)  # Parroquia
KEEP = [f"res-{c}-d{i}" for c in ("USD", "MXN") for i in (1, 2, 3, 4)] + \
       ["land-USD-all", "land-USD-s2", "land-MXN-s1", "land-MXN-s2", "land-MXN-s3"]
FIELDS = ["status", "category", "currency", "price", "construction_meters", "lot_meters",
          "latitude", "longitude", "neighborhood"]

def pull():
    rows, page = [], 1
    while True:
        u = f"https://ampisanmigueldeallende.com/api/idx/properties?integration_id={IID}&per_page=100&page={page}"
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        for attempt in range(4):
            try:
                d = json.load(urllib.request.urlopen(req, timeout=60)); break
            except Exception as e:
                print("retry", page, type(e).__name__); time.sleep(8)
        else:
            sys.exit(f"page {page} failed 4 times")
        items = d.get("data", [])
        rows += [{k: it.get(k) for k in FIELDS} for it in items]
        last = d.get("meta", {}).get("last_page") or d.get("last_page")
        print("page", page, len(items))
        if not items or (last and page >= last):
            return rows
        page += 1; time.sleep(1.7)

num = lambda v: float(v) if v not in (None, "") else None

def km(lat, lng):
    R = 6371; a = (math.radians(lat), math.radians(lng)); b = (math.radians(P[0]), math.radians(P[1]))
    h = math.sin((b[0]-a[0])/2)**2 + math.cos(a[0])*math.cos(b[0])*math.sin((b[1]-a[1])/2)**2
    return 2*R*math.asin(math.sqrt(h))

def qs(v):
    v = sorted(v)
    return [round(v[f] + (v[min(f+1, len(v)-1)] - v[f]) * (k - f), 1)
            for k, f in (((len(v)-1)*i/20, int((len(v)-1)*i/20)) for i in range(21))]

def build(d):
    sale = [x for x in d if x["status"] in ("For Sale", "Price Reduction") and x["price"]]
    pts, hoods = C.Counter(), C.defaultdict(set)
    for x in d:
        k = (x["latitude"], x["longitude"]); pts[k] += 1; hoods[k].add(x["neighborhood"])
    fallback = {k for k in pts if pts[k] >= 3 and len(hoods[k]) >= 2}  # default map points, not real positions
    real = lambda x: (x["latitude"], x["longitude"]) not in fallback
    segs = {}
    def add(key, xs, val):
        xs = [x for x in xs if val(x)]
        if len(xs) >= 30:
            segs[key] = {"n": len(xs), "cut": round(sum(x["status"] == "Price Reduction" for x in xs) / len(xs) * 100),
                         "q": qs([val(x) for x in xs])}
    for cur in ("USD", "MXN"):
        hs = [x for x in sale if x["category"] == "Residential" and x["currency"] == cur and num(x["construction_meters"])
              and 40 <= num(x["construction_meters"]) <= 2000 and num(x["latitude"])]
        ppm = lambda x: x["price"] / num(x["construction_meters"])
        for k, a, b in (("d1", 0, 1), ("d2", 1, 2), ("d3", 2, 4), ("d4", 4, 999)):
            add(f"res-{cur}-{k}", [x for x in hs if real(x) and a <= km(num(x["latitude"]), num(x["longitude"])) < b], ppm)
        ls = [x for x in sale if x["category"] == "Land and Lots" and x["currency"] == cur and num(x["lot_meters"])
              and 50 <= num(x["lot_meters"]) <= 500000 and num(x["latitude"])]
        lpm = lambda x: x["price"] / num(x["lot_meters"])
        add(f"land-{cur}-all", ls, lpm)
        for k, a, b in (("s1", 0, 500), ("s2", 500, 5000), ("s3", 5000, 10**9)):
            add(f"land-{cur}-{k}", [x for x in ls if a <= num(x["lot_meters"]) < b], lpm)
    return segs, len(fallback)

rows = pull()
segs, nfall = build(rows)
prev = json.loads(OUT.read_text()) if OUT.exists() else {}
missing = [k for k in KEEP if k not in segs]
if len(rows) < 1000 or (prev.get("total") and len(rows) < 0.7 * prev["total"]) or missing:
    sys.exit(f"sanity check failed: total={len(rows)} prev={prev.get('total')} missing={missing}; old file kept")
asof = datetime.datetime.now(datetime.timezone.utc).strftime("%-d %b %Y")
OUT.write_text(json.dumps({"asof": asof, "total": len(rows), "seg": {k: segs[k] for k in KEEP}}, separators=(",", ":")))
print(f"ok: {len(rows)} listings, {nfall} fallback points, asof {asof}")
for k in KEEP:
    print(f"  {k:14s} n={segs[k]['n']:4d} median={segs[k]['q'][10]}")
