import * as fsPromises from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x } from 'tinyexec';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsPromises.readFile(pkgJsonPath, 'utf8').then(JSON.parse);
  return content.version;
}

export async function getCreateVersionTag(): Promise<string | undefined> {
  try {
    const pkgPath = fileURLToPath(import.meta.resolve('create-mastra/package.json'));
    const json = await fsPromises.readFile(pkgPath, 'utf8').then(JSON.parse);

    const { stdout } = await x('npm', ['dist-tag', 'create-mastra'], { throwOnError: true });
    const tagLine = stdout.split('\n').find(distLine => distLine.endsWith(`: ${json.version}`));
    const tag = tagLine ? tagLine.split(':')[0].trim() : 'latest';

    return tag;
  } catch {
    console.error('We could not resolve the create-mastra version tag, falling back to "latest"');
  }

  return 'latest';
}
