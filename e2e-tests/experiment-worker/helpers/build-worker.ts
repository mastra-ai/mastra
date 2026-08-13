import { join } from 'node:path';
import { runCommand } from './command.js';

export async function buildWorker(
  projectRoot: string,
  outputDirectory = join(projectRoot, '.mastra', 'experiment-worker'),
  packageManager: 'pnpm' | 'npm' | 'yarn' = 'pnpm',
) {
  const command = packageManager === 'yarn' ? 'corepack' : packageManager;
  const execArgs =
    packageManager === 'npm'
      ? ['exec', '--', 'mastra']
      : packageManager === 'yarn'
        ? ['yarn', 'exec', 'mastra']
        : ['exec', 'mastra'];
  const result = await runCommand(command, [...execArgs, 'experiment', 'build', '--output-dir', outputDirectory], {
    cwd: projectRoot,
    timeoutMs: 180_000,
  });
  if (result.exitCode !== 0) {
    throw new Error(`mastra experiment build failed (${result.exitCode})\n${result.stdout}\n${result.stderr}`);
  }
  return { result, artifactRoot: outputDirectory };
}
