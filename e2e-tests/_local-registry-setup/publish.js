import { execFileSync } from 'node:child_process';

export async function publishPackages(args, tag, monorepoDir, registry) {
  execFileSync('pnpm', [...args, 'publish', `--registry=${registry.toString()}`, '--no-git-checks', `--tag=${tag}`], {
    cwd: monorepoDir,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
}
