import { lstat, mkdir, readdir, rename, rm, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEvidenceProfile, validateEvidenceProfile } from '../src/mastra/runtime/profile.ts';
import { generateCorpus, demoProfile, demoQuestionnaireRows } from '../tests/fixtures/corpus.ts';

export async function prepareDemo(root = resolve('.runtime')) {
  await mkdir(root, { recursive: true });
  const destination = resolve(root, 'demo');
  // An operator's existing profile wins; never seed fictional paths into custom configuration.
  let profileExists = false;
  try {
    await lstat(resolve(root, 'profile.json'));
    profileExists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (profileExists) {
    try {
      await loadEvidenceProfile(root);
    } catch {
      throw new Error(
        'DEMO_PARTIAL_PRESERVED: existing configuration or sources require repair; nothing was replaced.',
      );
    }
    return 'preserved';
  }
  const writeProfile = async () => {
    const profile = await validateEvidenceProfile(demoProfile(destination));
    await writeFile(resolve(root, 'profile.json'), JSON.stringify(profile, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  };
  try {
    const stat = await lstat(destination);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('DEMO_PATH_UNSAFE');
    const files = await readdir(destination);
    for (const expected of ['questionnaire.xlsx', 'questionnaire.docx', 'manifest.json', 'evidence'])
      if (!files.includes(expected))
        throw new Error('DEMO_PARTIAL_PRESERVED: inspect .runtime/demo; existing data was preserved.');
    await writeProfile();
    return 'preserved';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = await mkdtemp(resolve(root, '.demo-'));
  try {
    await generateCorpus(temporary, demoQuestionnaireRows());
    await rename(temporary, destination);
    await writeProfile();
    return 'created';
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareDemo();
  console.log('Local fictional demo prepared. Existing demo data is preserved.');
}
