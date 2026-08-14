import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function publishPackages(args, tag, monorepoDir, registry) {
  const publishArgs = args.map(arg => arg.replace(/^--filter=(['"])(.*)\1$/, '--filter=$2'));
  const selfOnlyFilters = publishArgs.filter(arg => arg.startsWith('--filter=') && !arg.endsWith('...'));
  const recursiveFilters = publishArgs.filter(arg => !selfOnlyFilters.includes(arg));
  const registryArgs = [`--registry=${registry.toString()}`, '--no-git-checks', `--tag=${tag}`];

  if (recursiveFilters.length > 0) {
    execFileSync('pnpm', [...recursiveFilters, 'publish', ...registryArgs], {
      cwd: monorepoDir,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
  }

  for (const filter of selfOnlyFilters) {
    const packageDir = execFileSync('pnpm', [filter, 'exec', 'pwd'], {
      cwd: monorepoDir,
      encoding: 'utf8',
    }).trim();
    const packDir = mkdtempSync(join(tmpdir(), 'mastra-e2e-pack-'));
    try {
      execFileSync('pnpm', ['pack', '--pack-destination', packDir], {
        cwd: packageDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      const tarball = readdirSync(packDir).find(file => file.endsWith('.tgz'));
      if (!tarball) {
        throw new Error(`pnpm pack did not create a tarball for ${filter}`);
      }
      execFileSync('npm', ['publish', join(packDir, tarball), ...registryArgs], {
        cwd: packageDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
    } finally {
      rmSync(packDir, { recursive: true, force: true });
    }
  }
}
