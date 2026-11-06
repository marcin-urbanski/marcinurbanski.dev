#!/bin/sh
# Share cards and the touch icon, made offline from the running site; nothing here runs at request time.
#
# Screenshots the home page (its hero) and each post in public/writing/ (its title) at 1200×630 under reduced
# motion, so every effect shows its final state, and saves them as public/og/home.jpg and public/og/<slug>.jpg for
# og:image. Then renders public/favicon.svg at 180×180 on the page background (--bg in public/styles.css) as
# public/apple-touch-icon.png. iOS fills a transparent touch icon with black and Chrome's screenshots carry an alpha
# channel, so the icon goes through a 24-bit BMP to come out as an RGB PNG (IHDR colour type 2) with no alpha.
# Needs macOS (sips), Google Chrome, and the site running: wrangler pages dev --port 8788.
#
#     sh tools/og-images.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
site=http://localhost:8788
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsS -o /dev/null "$site/" || { echo "Start the site first: wrangler pages dev --port 8788" >&2; exit 1; }

# shot <url> <width> <height> <png>: one headless Chrome screenshot, with a throwaway profile.
shot() {
  "$chrome" --headless --disable-gpu --no-first-run --user-data-dir="$tmp/profile" \
    --force-prefers-reduced-motion --hide-scrollbars --window-size="$2,$3" \
    --virtual-time-budget=4000 --screenshot="$4" "$1" 2>/dev/null
}

# card <path> <name>: the page at <path> as public/og/<name>.jpg, at quality 82 to stay well under 300 KB.
card() {
  shot "$site$1" 1200 630 "$tmp/$2.png"
  sips -s format jpeg -s formatOptions 82 "$tmp/$2.png" --out "$root/public/og/$2.jpg" >/dev/null
  echo "public/og/$2.jpg"
}

mkdir -p "$root/public/og"
card / home
for post in "$root"/public/writing/*/; do
  slug=$(basename "$post")
  card "/writing/$slug/" "$slug"
done

# The touch icon: the favicon on an opaque page of --bg, so its rounded corners blend into the same colour.
bg=$(sed -n 's/^ *--bg: *\(#[0-9a-fA-F]*\);.*/\1/p' "$root/public/styles.css")
cp "$root/public/favicon.svg" "$tmp/favicon.svg"
printf '<!doctype html><style>html,body{margin:0;background:%s}img{display:block}</style><img src="favicon.svg" width="180" height="180" alt="">' \
  "$bg" > "$tmp/icon.html"
shot "file://$tmp/icon.html" 180 180 "$tmp/icon.png"
sips -s format bmp "$tmp/icon.png" --out "$tmp/icon.bmp" >/dev/null
sips -s format png "$tmp/icon.bmp" --out "$root/public/apple-touch-icon.png" >/dev/null
echo "public/apple-touch-icon.png"
