import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveFactoryUISource(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  return join(dirname(__dirname), 'dist', 'factory');
}

/**
 * Resolve the Factory SPA dir the dev server should serve (via `MASTRACODE_UI_DIST`).
 *
 * Prefers a locally built UI at `<publicDir>/factory` (e.g. `build:ui` output) by
 * returning `undefined` — the server already picks that up as `cwd/factory`.
 * Otherwise falls back to the SPA bundled with the CLI, or `undefined` when no
 * prebuilt UI exists (behavior unchanged: no SPA middleware is mounted).
 *
 * Only used by `mastra dev`. `mastra build` no longer copies the SPA into the
 * deploy artifact — the runtime resolves it directly from
 * `node_modules/mastra/dist/factory/` via `@mastra/factory` spa-static.
 */
export function resolveFactoryUIDevDist(
  publicDir: string,
  factoryUISource = resolveFactoryUISource(),
): string | undefined {
  if (existsSync(join(publicDir, 'factory', 'index.html'))) return undefined;
  return existsSync(join(factoryUISource, 'index.html')) ? factoryUISource : undefined;
}
