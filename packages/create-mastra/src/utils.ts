import { readFile } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
  return content.version;
}

export async function getCreateVersionTag(): Promise<string | undefined> {
  try {
    const pkgPath = fileURLToPath(import.meta.resolve('create-mastra/package.json'));
    const json = JSON.parse(await readFile(pkgPath, 'utf-8'));

    const { stdout } = await execa('npm', ['dist-tag', 'create-mastra']);
    const tagLine = stdout.split('\n').find(distLine => distLine.endsWith(`: ${json.version}`));
    const tag = tagLine ? tagLine.split(':')[0].trim() : 'latest';

    return tag;
  } catch {
    console.error('We could not resolve the create-mastra version tag, falling back to "latest"');
  }

  return 'latest';
}
