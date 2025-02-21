import fsExtra from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsExtra.readJSON(pkgJsonPath);
  return content.version;
}

export function getCreateVersionTag(): string | undefined {
  const createArg = process.argv.find(
    arg => arg.startsWith('create-mastra@') || arg.startsWith('mastra@') || arg === 'create-mastra' || arg === 'mastra',
  );

  if (!createArg) return undefined;

  const tagMatch = createArg.match(/@([a-zA-Z]+)$/);
  if (tagMatch) {
    return tagMatch[1];
  }

  return undefined;
}
