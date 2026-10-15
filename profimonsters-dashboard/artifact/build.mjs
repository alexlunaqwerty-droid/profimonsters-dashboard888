// Сборка автономной версии в один HTML: node artifact/build.mjs
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
mkdirSync(path.join(root, 'dist'), { recursive: true });

execSync(`npx tailwindcss -c tailwind.config.ts -i src/app/globals.css -o dist/app.css --minify`, { cwd: root, stdio: 'inherit' });

const res = await build({
  entryPoints: [path.join(root, 'artifact/entry.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  jsx: 'automatic',
  alias: { '@': path.join(root, 'src') },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'error',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(path.join(root, 'dist/app.css'), 'utf8');

const html = `<title>Profimonsters Дашборд</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="pm-root"></div>
<script>${js}</script>
`;
writeFileSync(path.join(root, 'dist/profimonsters-dashboard.html'), html);
console.log('dist/profimonsters-dashboard.html', Math.round(html.length / 1024), 'KB');
