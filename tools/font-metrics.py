"""Metric overrides for the local fallback faces in public/styles.css, run once offline (macOS).

While a web font in public/fonts/ loads, its text shows in a local system font. Scaling that font to the web
font's width and line box keeps the text where it will be after the swap, so the page barely moves. For each
fallback face this prints the four descriptors to paste into its @font-face:

- size-adjust: the web font's average advance over the site's own copy set in that family (with each font's pair
  kerning), divided by the local font's; for the monospace face, the advance of "M", since every glyph has the same
  width. An average over the alphabet alone weights rare letters as much as "e" and "t",
  skips capitals and kerning, and left Arial about 6% wider than Geist on real paragraphs, enough to wrap a line;
- ascent-override, descent-override, line-gap-override: the web font's hhea metrics over its unitsPerEm, divided
  by size-adjust (the browser scales the overrides by size-adjust too).

The variable web fonts are measured at the weight the face stands in for. Newsreader is also measured at opsz 48:
the browser sets the optical size to the font size (font-optical-sizing: auto), and the site's serif phrases run
from 22px to 200px with most between 28px and 68px, where the default opsz 18 is several percent narrower than what
renders. Against the rendered page, opsz 48 left the phrases within about 2.5% of Newsreader; opsz 72 made them 2-7%
wider. Needs fontTools and brotli (for woff2):

    pip3 install --user fonttools brotli
    python3 tools/font-metrics.py
"""
import html
import re
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = Path(__file__).resolve().parent.parent / "public" / "fonts"
SYSTEM = [Path("/System/Library/Fonts"), Path("/Library/Fonts"), Path("/System/Library/Fonts/Supplemental")]


def visible(markup):
    """Text of an HTML fragment, whitespace collapsed."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", markup)))


def site_copy():
    """The text of every page set in Geist: no scripts and styles, and no pre or code, which are in Geist Mono."""
    pages = FONTS.parent.glob("**/*.html")
    return " ".join(visible(re.sub(r"<(script|style|pre|code)\b[\s\S]*?</\1>", " ", p.read_text())) for p in pages)


def serif_copy():
    """The phrases set in Newsreader: the serif is used only by .home-page em, so the <em>s of the home page."""
    return " ".join(visible(m) for m in re.findall(r"<em\b[^>]*>([\s\S]*?)</em>", (FONTS.parent / "index.html").read_text()))


COPY = site_copy()
# (fallback face, web font file, axes it is measured at, local font file, sample text)
FACES = [
    ("Geist Fallback 300 499", "geist-latin-v5.woff2", {"wght": 400}, "Arial.ttf", COPY),
    ("Geist Fallback 500 700", "geist-latin-v5.woff2", {"wght": 600}, "Arial Bold.ttf", COPY),
    # Menlo first; Courier New's "M" is within 0.3% of Menlo's, so one size-adjust suits both.
    ("Geist Mono Fallback", "geist-mono-latin-v6.woff2", {"wght": 400}, "Menlo.ttc", "M"),
    ("Newsreader Fallback (italic)", "newsreader-italic-latin-v26.woff2", {"wght": 400, "opsz": 48}, "Georgia Italic.ttf",
     serif_copy()),
]


def system_font(name):
    for folder in SYSTEM:
        if (folder / name).exists():
            return TTFont(folder / name, fontNumber=0)
    raise SystemExit(f"{name} is not in {', '.join(map(str, SYSTEM))}")


def kerning(font):
    """The font's GPOS "kern" lookups for Latin, as a function (left glyph, right glyph) -> advance change."""
    if "GPOS" not in font:
        return lambda left, right: 0
    gpos = font["GPOS"].table
    scripts = {r.ScriptTag: r.Script for r in gpos.ScriptList.ScriptRecord}
    features = [gpos.FeatureList.FeatureRecord[i] for i in (scripts.get("latn") or scripts["DFLT"]).DefaultLangSys.FeatureIndex]
    lookups = []
    for index in (i for f in features if f.FeatureTag == "kern" for i in f.Feature.LookupListIndex):
        lookup = gpos.LookupList.Lookup[index]
        tables = [t.ExtSubTable if lookup.LookupType == 9 else t for t in lookup.SubTable]
        lookups.append([(t, {g: i for i, g in enumerate(t.Coverage.glyphs)}) for t in tables if type(t).__name__ == "PairPos"])

    def x_advance(value):
        return (getattr(value, "XAdvance", 0) or 0) if value else 0

    def pair(table, covered, left, right):
        """The pair's adjustment in this subtable, or None when the subtable does not cover the pair."""
        if left not in covered:
            return None
        if table.Format == 2:
            row = table.Class1Record[table.ClassDef1.classDefs.get(left, 0)]
            return x_advance(row.Class2Record[table.ClassDef2.classDefs.get(right, 0)].Value1)
        record = next((r for r in table.PairSet[covered[left]].PairValueRecord if r.SecondGlyph == right), None)
        return x_advance(record.Value1) if record else None

    # Within a lookup the first subtable that covers the pair applies; every lookup applies in turn.
    return lambda left, right: sum(
        next((v for v in (pair(t, c, left, right) for t, c in tables) if v is not None), 0) for tables in lookups)


def advance(font, text):
    """Average advance of the characters in text, kerned, in ems."""
    cmap, hmtx, kern = font.getBestCmap(), font["hmtx"], kerning(font)
    glyphs = [cmap[ord(c)] for c in text]
    total = sum(hmtx[g][0] for g in glyphs) + sum(kern(a, b) for a, b in zip(glyphs, glyphs[1:]))
    return total / len(glyphs) / font["head"].unitsPerEm


def overrides(web, local, text):
    # Measure only what both fonts draw; the rest (arrows, symbols) falls through to other fonts anyway.
    common = set(web.getBestCmap()) & set(local.getBestCmap())
    text = "".join(c for c in text if ord(c) in common)
    size = advance(web, text) / advance(local, text)
    em, hhea = web["head"].unitsPerEm, web["hhea"]
    return {
        "size-adjust": size,
        "ascent-override": hhea.ascent / em / size,
        "descent-override": -hhea.descent / em / size,
        "line-gap-override": hhea.lineGap / em / size,
    }


def main():
    for face, web_file, axes, local_file, text in FACES:
        web = instantiateVariableFont(TTFont(FONTS / web_file), axes)
        values = overrides(web, system_font(local_file), text)
        print(f"/* {face}: {local_file} */")
        print(" ".join(f"{k}: {v * 100:.2f}%;" for k, v in values.items()))


if __name__ == "__main__":
    main()
