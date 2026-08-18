import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';

export async function resolvePublishedVersion(registry: string, packageName: string, tag: string) {
  const response = await fetch(`${registry}/${encodeURIComponent(packageName)}`);
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
  const packagePaths = await glob('**/package.json', { cwd: root, absolute: true });
  for (const packagePath of packagePaths) {
    const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown> & {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const field of ['dependencies', 'devDependencies'] as const) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if (spec === 'experiment-worker-e2e-test') {
          const version = await resolvePublishedVersion(options.registry, name, options.tag);
          manifest[field]![name] =
            manifest.packageManager === 'yarn@4.9.2' && name === 'mastra'
              ? `${options.registry}/mastra/-/mastra-${version}.tgz`
              : version;
        }
      }
    }
    await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await writeFile(join(root, '.npmrc'), `registry=${options.registry}\nstrict-peer-dependencies=false\n`);
  try {
    const yarnConfigPath = join(root, '.yarnrc.yml');
    const yarnConfig = await readFile(yarnConfigPath, 'utf8');
    const registryUrl = new URL(options.registry);
    await writeFile(
      yarnConfigPath,
      `${yarnConfig}npmRegistryServer: "https://registry.npmjs.org"\nnpmScopes:\n  mastra:\n    npmRegistryServer: "${options.registry}"\nunsafeHttpWhitelist:\n  - "${registryUrl.hostname}"\n`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  return root;
}
