import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function resolveRendererDistPath(): string {
  const override = process.env.MASTRACODE_DESKTOP_RENDERER_DIST;
  if (override && existsSync(override)) return override;
  if (override) throw new Error(`Configured MastraCode renderer directory does not exist: ${override}`);

  if (process.resourcesPath) {
    const packagedRendererPath = resolve(process.resourcesPath, 'app.asar', 'dist', 'renderer');
    if (existsSync(packagedRendererPath)) return packagedRendererPath;
  }

  const developmentRendererPath = resolve(process.cwd(), 'dist/renderer');
  if (existsSync(developmentRendererPath)) return developmentRendererPath;

  throw new Error(
    `MastraCode renderer is missing. Expected ${resolve(process.resourcesPath, 'app.asar', 'dist', 'renderer')} or ${developmentRendererPath}.`,
  );
}
