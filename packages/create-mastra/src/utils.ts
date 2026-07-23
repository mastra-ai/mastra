import * as fsPromises from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x } from 'tinyexec';

const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;

export async function getPackageVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = await fsPromises.readFile(pkgJsonPath, 'utf8').then(JSON.parse);
  return content.version;
}

function getPrereleaseChannel(version: string): string | undefined {
  const separator = version.indexOf('-');
  if (separator === -1) return undefined;
  return version
    .slice(separator + 1)
    .split('.')
    .find(identifier => !NUMERIC_IDENTIFIER_PATTERN.test(identifier));
}

function selectMatchingDistTag(version: string, output: string): string | undefined {
  const matchingTags = output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      const separator = line.indexOf(':');
      if (separator === -1) return [];
      const tag = line.slice(0, separator).trim();
      const taggedVersion = line.slice(separator + 1).trim();
      return taggedVersion === version && tag ? [tag] : [];
    });

  const prereleaseChannel = getPrereleaseChannel(version);
  const matchingPrereleaseTag = prereleaseChannel
    ? matchingTags.find(tag => prereleaseChannel === tag || prereleaseChannel.startsWith(`${tag}-`))
    : undefined;
  if (matchingPrereleaseTag) return matchingPrereleaseTag;
  if (matchingTags.includes('latest')) return 'latest';
  if (matchingTags.includes('beta')) return 'beta';
  return matchingTags.sort((a, b) => a.localeCompare(b))[0];
}

export async function getCreateVersionTag(version: string): Promise<string> {
  try {
    const { stdout } = await x('npm', ['dist-tag', 'ls', 'create-mastra'], { throwOnError: true });
    const tag = selectMatchingDistTag(version, stdout);
    if (tag) return tag;
  } catch {
    // Fall through to the documented latest fallback.
  }

  console.error('We could not resolve the create-mastra version tag, falling back to "latest"');
  return 'latest';
}
