import { execFileSync } from 'node:child_process';

export async function publishPackages(args, tag, monorepoDir, registry) {
  const publishArgs = args.map(arg => arg.replace(/^--filter=(['"])(.*)\1$/, '--filter=$2'));

  execFileSync(
    'pnpm',
    [...publishArgs, 'publish', `--registry=${registry.toString()}`, '--no-git-checks', `--tag=${tag}`],
    {
      cwd: monorepoDir,
      stdio: ['inherit', 'inherit', 'inherit'],
    },
  );
}
