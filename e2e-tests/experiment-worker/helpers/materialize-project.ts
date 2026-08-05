import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function resolvePublishedVersion(registry: string, packageName: string, tag: string) {
  const response = await fetch(`${registry}/${packageName.replace('/', '%2f')}`);
  if (!response.ok) throw new Error(`Could not read ${packageName} metadata from ${registry}: ${response.status}`);
  const metadata = (await response.json()) as { 'dist-tags'?: Record<string, string> };
  const version = metadata['dist-tags']?.[tag];
  if (!version) throw new Error(`Missing ${packageName}@${tag} in ${registry}`);
  return version;
}

export async function materializeProject(options: {
  fixtureDir: string;
  runRoot: string;
  registry: string;
  tag: string;
  scenarioId: string;
}) {
  const root = await mkdtemp(join(options.runRoot, `${options.scenarioId}-`));
  await cp(options.fixtureDir, root, { recursive: true });
  const packagePath = join(root, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown> & {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const field of ['dependencies', 'devDependencies'] as const) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (spec === 'experiment-worker-e2e-test') {
        manifest[field]![name] = await resolvePublishedVersion(options.registry, name, options.tag);
      }
    }
  }
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(root, '.npmrc'), `registry=${options.registry}\nstrict-peer-dependencies=false\n`);
  return root;
}
