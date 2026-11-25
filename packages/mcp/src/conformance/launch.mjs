// Entry point for `pnpm test:conformance`. It runs on plain Node so that a missing `tsx` is reported
// with an install command before any scenario starts, instead of `tsx: command not found` or a module
// resolution stack after the HTTP scenario has already run.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let cli;
try {
  cli = fileURLToPath(import.meta.resolve('tsx/cli'));
} catch {
  console.error(
    [
      'The MCP conformance runner (pnpm --filter ./packages/mcp test:conformance) requires tsx, a dev dependency of @mastra/mcp.',
      'Run `pnpm install` from the repository root. If tsx is still missing, add it:',
      '  pnpm --filter ./packages/mcp add --save-dev tsx@4',
    ].join('\n'),
  );
  process.exit(1);
}

const child = spawn(process.execPath, [cli, fileURLToPath(new URL('./run.ts', import.meta.url))], {
  stdio: 'inherit',
});
child.once('exit', code => {
  process.exitCode = code ?? 1;
});
