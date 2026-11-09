import { createHash } from 'node:crypto';
import { readFile, lstat, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const packageRoot = join(root, 'node_modules/@mastra/libsql');
const patchName = '@mastra+libsql+1.29.0.patch';
const expectedPatch = '217d41ef6f3acc51ace5cbaa6911ecbe60aebeb0c7058f35728835e8816ab4a3';
const files = {
  'dist/index.cjs': {
    original: 'ddd4831d1d95c3c1fd9e4f37834c1810f8e26df558580db367c1694227fc6323',
    corrected: 'ebf4288535175a213418d46a7f5ee68d3bbe36859f4e201f7845a53ec563ab1c',
  },
  'dist/index.cjs.map': {
    original: '5391ae52df70c6ea4423b0e525b797ebd13b9c289b36ee78aa203c83100d00e2',
    corrected: 'fcac759075f6e35dd095e5ec2e02067df70f1071a05248219c9b1b782aa82ac5',
  },
  'dist/index.js': {
    original: '44e459981d2598b8482abdf54e905bdd296bc854c7c46faf472bba4ffbb19930',
    corrected: '5489d4875c57403e738ff162147a527bc7d95edc979741d94cdba9d13df0a2c5',
  },
  'dist/index.js.map': {
    original: '32bae768c6a56192cfc346d4ede4b63f030c4f3fe679d5a1f78af3a3ecc6c76c',
    corrected: 'bcc41e5a91fdf045da8905f0c29909bfd65cd2dc9c293aadfae053c1b151ca59',
  },
};
/** @param {Uint8Array} value */
const hash = value => createHash('sha256').update(value).digest('hex');

async function installedHashes() {
  const packageStat = await lstat(packageRoot);
  const distStat = await lstat(join(packageRoot, 'dist'));
  if (
    !packageStat.isDirectory() ||
    packageStat.isSymbolicLink() ||
    !distStat.isDirectory() ||
    distStat.isSymbolicLink()
  ) {
    throw new Error('The local LibSQL patch requires regular package and dist directories.');
  }
  /** @type {Record<string, string>} */
  const hashes = {};
  for (const name of Object.keys(files)) {
    const path = join(packageRoot, name);
    if (!(await lstat(path)).isFile()) throw new Error('The local LibSQL patch refuses non-regular compiled files.');
    hashes[name] = hash(await readFile(path));
  }
  return hashes;
}

const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
if (metadata.version !== '1.29.0')
  throw new Error('Unsupported @mastra/libsql version. Review this local privacy patch before using another release.');
const patchDirectory = join(root, 'patches');
const patchDirectoryStat = await lstat(patchDirectory);
if (!patchDirectoryStat.isDirectory() || patchDirectoryStat.isSymbolicLink())
  throw new Error('The reviewed patch directory must be a regular directory.');
const entries = await readdir(patchDirectory);
if (entries.length !== 1 || entries[0] !== patchName)
  throw new Error('The patch directory must contain only the reviewed LibSQL patch.');
const patchPath = join(patchDirectory, patchName);
if (!(await lstat(patchPath)).isFile()) throw new Error('The reviewed LibSQL patch must be a regular file.');
if (hash(await readFile(patchPath)) !== expectedPatch)
  throw new Error('The reviewed LibSQL patch payload changed. Restore or review it before installing.');
const observed = await installedHashes();
if (Object.entries(files).every(([name, value]) => observed[name] === value.corrected)) {
  console.log('Local LibSQL privacy patch already verified.');
} else {
  if (!Object.entries(files).every(([name, value]) => observed[name] === value.original)) {
    throw new Error(
      'Unsupported LibSQL compiled bytes or partial patch state. Reinstall the reviewed original package before retrying.',
    );
  }
  const toolMetadataPath = require.resolve('patch-package/package.json');
  const toolMetadata = JSON.parse(await readFile(toolMetadataPath, 'utf8'));
  if (toolMetadata.version !== '8.0.1') throw new Error('The local LibSQL privacy patch requires patch-package 8.0.1.');
  const bin = typeof toolMetadata.bin === 'string' ? toolMetadata.bin : toolMetadata.bin?.['patch-package'];
  const binary = typeof bin === 'string' && resolve(dirname(toolMetadataPath), bin);
  if (!binary || !binary.startsWith(dirname(toolMetadataPath) + '/'))
    throw new Error('Invalid local patch-package executable.');
  const result = spawnSync(process.execPath, [binary, '--error-on-fail', '--patch-dir', 'patches'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0)
    throw new Error('Applying the local LibSQL privacy patch failed. Stop and restore a clean reviewed installation.');
  const patched = await installedHashes();
  if (!Object.entries(files).every(([name, value]) => patched[name] === value.corrected)) {
    throw new Error('LibSQL privacy patch verification failed. Stop and restore a clean reviewed installation.');
  }
  console.log('Local LibSQL privacy patch applied and verified.');
}
