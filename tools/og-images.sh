#!/bin/sh
# Share cards and the touch icon, made offline from public/; nothing here runs at request time.
#
# Screenshots the home page (its hero) and each post in public/writing/ (its title) at 1200×630 under reduced
# motion, so every effect shows its final state, and saves them as public/og/home.jpg and public/og/<slug>.jpg for
# og:image. Every card is shot from a copy of public/ that python3 serves on its own port, so its root-absolute URLs
# and fonts load as they do on the site; the run stops if that port is taken, rather than shoot whatever else
# answers there. The posts are copied as they are. The home card would otherwise change on every run, so the copy's
# index.html hides the header clock's time (the "Southampton" label stays) and seeds Math.random, which the portrait
# uses to dither the bottom edge of the face. It also runs requestAnimationFrame callbacks from a 16ms timer: in some
# runs, headless Chrome draws no frame until the virtual time budget has run out, and the portrait, which starts
# after the first frame, then missed the card. The face's measure steps wait for idle callbacks, which under virtual
# time come only at their 1s timeout, so the shots get 8 virtual seconds; that costs no real time. A new home card
# that differs from the committed one is reported, as with the seed it should come out the same until the page
# changes.
# Then renders public/favicon.svg at 180×180 on the page background (--bg in
# public/styles.css) as public/apple-touch-icon.png. iOS fills a transparent touch icon with black and Chrome's
# screenshots carry an alpha channel, so the icon goes through a 24-bit BMP to come out as an RGB PNG (IHDR colour
# type 2) with no alpha.
# Needs macOS (sips, python3), Google Chrome, and port 8789 free.
#
#     sh tools/og-images.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# shot <url> <width> <height> <png>: one headless Chrome screenshot, with a throwaway profile.
shot() {
  "$chrome" --headless --disable-gpu --no-first-run --user-data-dir="$tmp/profile" \
    --force-prefers-reduced-motion --hide-scrollbars --window-size="$2,$3" \
    --virtual-time-budget=8000 --screenshot="$4" "$1" 2>/dev/null
}

# card <url> <name>: the page at <url> as public/og/<name>.jpg, at quality 82 to stay well under 300 KB. Chrome
# screenshots an error page and exits 0, so the page is fetched first and the run stops before a card is overwritten.
card() {
  curl -fsS -o /dev/null "$1" || { echo "Could not load $1; public/og/$2.jpg is left as it was" >&2; exit 1; }
  shot "$1" 1200 630 "$tmp/$2.png"
  sips -s format jpeg -s formatOptions 82 "$tmp/$2.png" --out "$root/public/og/$2.jpg" >/dev/null
  echo "public/og/$2.jpg"
}

mkdir -p "$root/public/og"

# The copy of public/ described above. Math.random becomes a Park–Miller generator with a fixed seed. sed
# leaves the page as it is when it finds no </head>, and the card would then change on every run without a word.
copy=http://127.0.0.1:8789
cp -R "$root/public" "$tmp/site"
seed='<script>Math.random = (s => () => (s = s * 16807 % 2147483647) / 2147483647)(1);</script>'
frames='<script>requestAnimationFrame = f => setTimeout(() => f(performance.now()), 16);'
frames="$frames cancelAnimationFrame = id => clearTimeout(id);</script>"
grep -q '</head>' "$root/public/index.html" || { echo "public/index.html has no </head>" >&2; exit 1; }
sed "s|</head>|<style>[data-clock]{visibility:hidden!important}</style>$seed$frames</head>|" \
  "$root/public/index.html" > "$tmp/site/index.html"
python3 -m http.server 8789 --bind 127.0.0.1 --directory "$tmp/site" >/dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; rm -rf "$tmp"' EXIT
# When something else already listens on 8789, python3 exits at once, but curl may reach the other server before it
# does, so the page served is compared with the copy before it is shot.
busy="Port 8789 is taken or python3 -m http.server exited; free the port and run again"
tries=0
until curl -fs -o /dev/null "$copy/" 2>/dev/null; do
  kill -0 "$server" 2>/dev/null || { echo "$busy" >&2; exit 1; }
  tries=$((tries + 1))
  [ "$tries" -lt 50 ] || { echo "The copy of the site did not start on port 8789" >&2; exit 1; }
  sleep 0.1
done
if ! curl -fs "$copy/" | cmp -s - "$tmp/site/index.html" || ! kill -0 "$server" 2>/dev/null; then
  echo "$busy" >&2; exit 1
fi
card "$copy/" home
if git -C "$root" show HEAD:public/og/home.jpg > "$tmp/home-head.jpg" 2>/dev/null &&
  ! cmp -s "$tmp/home-head.jpg" "$root/public/og/home.jpg"; then
  echo "public/og/home.jpg differs from the committed card: look at it before committing" >&2
fi

for post in "$root"/public/writing/*/; do
  slug=$(basename "$post")
  card "$copy/writing/$slug/" "$slug"
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
