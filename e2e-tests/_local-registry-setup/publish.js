import { execSync } from 'node:child_process';

export function publishPackages(args, tag, monorepoDir, registry) {
  execSync(`pnpm ${args.join(' ')} publish --registry=${registry} --no-git-checks --tag=${tag}`, {
    cwd: monorepoDir,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
}
