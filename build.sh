#!/bin/sh
# Builds the website into ./site from ./src.
#   src/page.html  -> site/index.html (site + questionnaire + hidden team space)
#   SITE_URL sets the public address used by Google (canonical, sitemap, share image).
#   On Netlify, the site address is picked up automatically from $URL.
set -e
cd "$(dirname "$0")"
SITE_URL="${SITE_URL:-${URL:-https://caia.netlify.app}}"
SITE_URL="${SITE_URL%/}"
rm -rf site && mkdir -p site
TITLE="Caia · Le diagnostic gratuit des commerces de quartier"
DESC="Dites à Caia ce qui coince dans votre commerce : en 2 minutes, l’assistant chiffre l’argent que vous perdez et un conseiller vous rappelle avec la solution. Gratuit, sans engagement."
{
  printf '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<title>%s</title>\n<meta name="description" content="%s">\n' "$TITLE" "$DESC"
  printf '<link rel="canonical" href="%s/">\n<meta name="robots" content="index, follow">\n' "$SITE_URL"
  printf '<meta name="theme-color" content="#FFFFFF">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
  printf '<meta property="og:type" content="website">\n<meta property="og:locale" content="fr_FR">\n<meta property="og:site_name" content="Caia">\n'
  printf '<meta property="og:title" content="%s">\n<meta property="og:description" content="%s">\n' "$TITLE" "$DESC"
  printf '<meta property="og:url" content="%s/">\n<meta property="og:image" content="%s/og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' "$SITE_URL" "$SITE_URL"
  printf '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="%s">\n<meta name="twitter:description" content="%s">\n<meta name="twitter:image" content="%s/og.png">\n' "$TITLE" "$DESC" "$SITE_URL"
  printf '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Caia","url":"%s/","logo":"%s/apple-touch-icon.png"},{"@type":"WebSite","name":"Caia","url":"%s/","inLanguage":"fr-FR"}]}</script>\n' "$SITE_URL" "$SITE_URL" "$SITE_URL"
  # Page head from the source, without its own <title>, description and preview-only tags
  sed -n '1,/<\/style>/p' src/page.html | grep -v -e '^<title>' -e 'claude:viewport' -e '^<meta name="description"'
  printf '</head>\n<body>\n<script src="/config.js"></script>\n'
  sed -n '/<\/style>/,$p' src/page.html | sed '1d'
  printf '</body>\n</html>\n'
} > site/index.html
cp src/config.js site/config.js
cp src/assets/favicon.svg src/assets/og.png site/
[ -f src/assets/apple-touch-icon.png ] && cp src/assets/apple-touch-icon.png site/
printf 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' "$SITE_URL" > site/robots.txt
printf '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>%s/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n' "$SITE_URL" > site/sitemap.xml
echo "Built ./site for $SITE_URL"
