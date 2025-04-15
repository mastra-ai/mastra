import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import fsExtra from 'fs-extra';

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsExtra.readJSON(pkgJsonPath);
  return content.version;
}

export async function getCreateVersionTag(): Promise<string | undefined> {
  try {
    const pkgPath = fileURLToPath(import.meta.resolve('create-mastra/package.json'));
    const json = await fsExtra.readJSON(pkgPath);

    const { stdout } = await execa('npm', ['dist-tag', 'create-mastra']);
    const tagLine = stdout.split('\n').find(distLine => distLine.includes(`: ${json.version}`));
    const tag = tagLine ? tagLine.split(':')[0].trim() : 'latest';

    return tag;
  } catch {
    console.error('We could not resolve the create-mastra version tag, falling back to "latest"');
  }

  return 'latest';
}
