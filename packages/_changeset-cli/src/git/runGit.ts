import { execFileSync } from 'node:child_process';

export function runGit(args: string[]): void {
  execFileSync('git', args, { stdio: 'inherit' });
}
