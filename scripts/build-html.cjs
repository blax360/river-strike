#!/usr/bin/env node
/* Empaqueta el juego en UN solo archivo HTML autocontenido (sin servidor). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('src/index.html');
const css = read('src/css/style.css');

const jsFiles = [
  'js/00-core.js', 'js/10-audio.js', 'js/20-sprites.js', 'js/30-world.js',
  'js/40-update.js', 'js/50-render.js', 'js/60-screens.js', 'js/70-main.js'
];

// CSS inline
html = html.replace('<link rel="stylesheet" href="css/style.css">',
  '<style>\n' + css + '\n</style>');

// JS inline (en orden, cada uno en su propio bloque)
const bundle = jsFiles.map(f => '/* ===== ' + f + ' ===== */\n' + read('src/' + f)).join('\n');
html = html.replace(/<script src="js\/[^"]+"><\/script>\s*/g, '');
html = html.replace('</body>', '<script>\n' + bundle + '\n</script>\n</body>');

// metadatos extra para que se vea bien instalado en iOS/macOS
html = html.replace('</head>',
  '  <meta name="apple-mobile-web-app-capable" content="yes">\n' +
  '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n' +
  '  <meta name="theme-color" content="#04060c">\n' +
  '</head>');

const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const dest = path.join(out, 'river-strike.html');
fs.writeFileSync(dest, html, 'utf8');

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log('OK ->', dest, kb + ' KB');

// chequeos básicos: nada quedó apuntando a archivos externos
const leftovers = (html.match(/(src|href)="(?!data:|#)[^"]+"/g) || []);
console.log('referencias externas restantes:', leftovers.length ? leftovers : 'ninguna');
