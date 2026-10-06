// Optional asset authoring tool. Paper is packed into a temporary directory;
// it is never an application dependency and is not needed for package builds.
// Requires the playground's Playwright, Chromium, and Python Pillow.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../packages/playground/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const output = fileURLToPath(new URL('../packages/playground-ui/src/ds/components/GrainFill/', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'grain-masks-'));
const presets = [
  { name: 'dark', theme: 'dark', offset: 0 },
  { name: 'dark-color', theme: 'dark', offset: 0.12 },
  { name: 'light', theme: 'light', offset: 0 },
  { name: 'light-color', theme: 'light', offset: 0.12 },
  { name: 'light-info', theme: 'light', offset: 0, info: true },
];
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><body></body></html>');
      return;
    }
    if (!url.pathname.startsWith('/dist/') || url.pathname.includes('..')) {
      response.writeHead(404).end();
      return;
    }
    const source = await readFile(join(scratch, 'package', url.pathname));
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'text/javascript');
    response.end(source);
  } catch {
    response.writeHead(404).end();
  }
});
let browser;
try {
  execFileSync('npm', ['pack', '@paper-design/shaders@0.0.81', '--pack-destination', scratch], { stdio: 'ignore' });
  execFileSync('tar', ['-xzf', join(scratch, 'paper-design-shaders-0.0.81.tgz'), '-C', scratch]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing authoring server port');
  browser = await chromium.launch({ executablePath: process.env.GRAIN_CHROMIUM_PATH });
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const masks = await page.evaluate(
    async ({ baseUrl, presets }) => {
      const shaders = await import(`${baseUrl}/dist/index.js`);
      const texture = shaders.getShaderNoiseTexture();
      await texture.decode();
      const results = {};
      for (const { name, theme, offset, info } of presets) {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:0;top:0;width:464px;height:200px';
        document.body.append(host);
        // Project the CSS palette onto a single tint axis. Noise stays in the
        // gradient's mixing field instead of becoming bright surface speckles.
        let weights = [0.7, 0.43, 0.323, 0.22, 0.105];
        if (theme === 'light') weights = info ? [0.75, 0.5, 0.25, 0, 0] : [0.55, 0.25, 0, 0, 0];
        const mount = new shaders.ShaderMount(
          host,
          shaders.grainGradientFragmentShader,
          {
            u_colorBack: [1, 1, 1, 1],
            u_colors: weights.map(weight => [weight, weight, weight, 1]),
            u_colorsCount: 5,
            u_softness: 1,
            u_intensity: theme === 'dark' ? 0.2 : 0.1,
            u_noise: theme === 'dark' ? 0.4 : 0.15,
            u_shape: shaders.GrainGradientShapes.wave,
            u_noiseTexture: texture,
            u_fit: shaders.ShaderFitOptions[shaders.defaultPatternSizing.fit],
            u_scale: 1,
            u_rotation: 270,
            u_offsetX: -0.1,
            u_offsetY: offset,
            u_originX: 0.5,
            u_originY: 0.5,
            u_worldWidth: 0,
            u_worldHeight: 0,
          },
          { preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false },
          0,
          0,
          2,
        );
        try {
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          const canvas = host.querySelector('canvas');
          // Headless Chromium can report CSS pixels in its device-pixel resize
          // observation. Correct the render scale before exporting fine grain.
          if (canvas.width < 928) {
            mount.setMinPixelRatio((2 * 928) / canvas.width);
            await new Promise(requestAnimationFrame);
          }
          if (canvas.width !== 928 || canvas.height !== 400) {
            throw new Error(`Expected a 2× grain capture; got ${canvas.width}×${canvas.height}`);
          }
          results[name] = canvas.toDataURL('image/png');
        } finally {
          mount.dispose();
          host.remove();
        }
      }
      return results;
    },
    { baseUrl: `http://127.0.0.1:${address.port}`, presets },
  );
  const manifest = join(scratch, 'masks.json');
  await writeFile(manifest, JSON.stringify(masks));
  execFileSync('python3', [
    '-c',
    `
import base64, io, json, sys
from pathlib import Path
from PIL import Image
for name, source in json.loads(Path(sys.argv[1]).read_text()).items():
    image = Image.open(io.BytesIO(base64.b64decode(source.split(',')[1]))).convert('RGB')
    image.save(Path(sys.argv[2]) / ('grain-mask-' + name + '.webp'), quality=75, method=6)
`,
    manifest,
    output,
  ]);
  console.log('Generated five shared 928×400 grain masks.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
