import sys
src = open('app-src.html').read()
url, key = sys.argv[1], sys.argv[2]
import datetime
src = src.replace('__SB_URL__', url).replace('__SB_KEY__', key).replace('__BUILD__', datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))
sw = open('site/sw.tpl.js').read().replace('__SB_URL__', url).replace('__SB_KEY__', key)
open('site/sw.js','w').write(sw)
i = src.index('<div id="app">')
head, body = src[:i], src[i:]
html = f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F3F1F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14111A" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Nido">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<style>body{{margin:0}}[hidden]{{display:none!important}}img{{max-width:100%}}#app{{padding-top:env(safe-area-inset-top,0px)}}</style>
{head}
</head>
<body>
{body}
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {{}}));</script>
</body>
</html>
'''
open('site/index.html', 'w').write(html)
