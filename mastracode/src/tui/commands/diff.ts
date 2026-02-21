import { DiffOutputComponent } from '../components/diff-output.js';
import { fg } from '../theme.js';
import type { SlashCommandContext } from './types.js';

export async function handleDiffCommand(ctx: SlashCommandContext, filePath?: string): Promise<void> {
  const { state } = ctx;

  if (filePath) {
    try {
      const { execa } = await import('execa');
      const result = await execa('git', ['diff', filePath], {
        cwd: process.cwd(),
        reject: false,
      });

      if (!result.stdout.trim()) {
        const staged = await execa('git', ['diff', '--cached', filePath], {
          cwd: process.cwd(),
          reject: false,
        });
        if (!staged.stdout.trim()) {
          ctx.showInfo(`No changes detected for: ${filePath}`);
          return;
        }
        const component = new DiffOutputComponent(`git diff --cached ${filePath}`, staged.stdout);
        state.chatContainer.addChild(component);
        state.ui.requestRender();
        return;
      }

      const component = new DiffOutputComponent(`git diff ${filePath}`, result.stdout);
      state.chatContainer.addChild(component);
      state.ui.requestRender();
    } catch (error) {
      ctx.showError(error instanceof Error ? error.message : 'Failed to get diff');
    }
    return;
  }

  // No path specified — show summary of all tracked modified files
  if (state.modifiedFiles.size === 0) {
    try {
      const { execa } = await import('execa');
      const result = await execa('git', ['diff', '--stat'], {
        cwd: process.cwd(),
        reject: false,
      });
      const staged = await execa('git', ['diff', '--cached', '--stat'], {
        cwd: process.cwd(),
        reject: false,
      });

      const output = [result.stdout, staged.stdout].filter(Boolean).join('\n');
      if (output.trim()) {
        const component = new DiffOutputComponent('git diff --stat', output);
        state.chatContainer.addChild(component);
        state.ui.requestRender();
      } else {
        ctx.showInfo('No file changes detected in this session or working tree.');
      }
    } catch {
      ctx.showInfo('No file changes tracked in this session.');
    }
    return;
  }

  const lines: string[] = [`Modified files (${state.modifiedFiles.size}):`];
  for (const [fp, info] of state.modifiedFiles) {
    const opCounts = new Map<string, number>();
    for (const op of info.operations) {
      opCounts.set(op, (opCounts.get(op) || 0) + 1);
    }
    const ops = Array.from(opCounts.entries())
      .map(([op, count]) => (count > 1 ? `${op}×${count}` : op))
      .join(', ');
    lines.push(`  ${fg('path', fp)} ${fg('muted', `(${ops})`)}`);
  }
  lines.push('');
  lines.push(fg('muted', 'Use /diff <path> to see the git diff for a specific file.'));

  ctx.showInfo(lines.join('\n'));
}
