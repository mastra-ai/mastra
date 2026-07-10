import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function resolveWebUiDistPath(): string {
  const override = process.env.MASTRACODE_DESKTOP_WEB_DIST;
  if (override && existsSync(override)) return override;
  if (override) throw new Error(`Configured MastraCode web UI directory does not exist: ${override}`);

  if (process.resourcesPath) {
    const packagedWebUiPath = resolve(process.resourcesPath, 'web-ui');
    if (existsSync(packagedWebUiPath)) return packagedWebUiPath;
  }

  const developmentWebUiPath = resolve(process.cwd(), 'dist/web-ui');
  if (existsSync(developmentWebUiPath)) return developmentWebUiPath;

  throw new Error(
    `MastraCode web UI is missing. Expected ${resolve(process.resourcesPath, 'web-ui')} or ${developmentWebUiPath}.`,
  );
}
