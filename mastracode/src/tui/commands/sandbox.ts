import fs from 'node:fs';
import path from 'node:path';
import { Spacer } from '@mariozechner/pi-tui';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

async function sandboxAddPath(ctx: SlashCommandContext, rawPath: string): Promise<void> {
  const harnessState = ctx.state.harness.getState() as {
    sandboxAllowedPaths?: string[];
  };
  const currentPaths = harnessState.sandboxAllowedPaths ?? [];
  const resolved = path.resolve(rawPath);

  if (currentPaths.includes(resolved)) {
    ctx.showInfo(`Path already allowed: ${resolved}`);
    return;
  }
  try {
    await fs.promises.access(resolved);
  } catch {
    ctx.showError(`Path does not exist: ${resolved}`);
    return;
  }
  const updated = [...currentPaths, resolved];
  ctx.state.harness.setState({ sandboxAllowedPaths: updated } as any);
  await ctx.state.harness.setThreadSetting({ key: 'sandboxAllowedPaths', value: updated });
  ctx.showInfo(`Added to sandbox: ${resolved}`);
}

async function sandboxRemovePath(ctx: SlashCommandContext, rawPath: string, currentPaths: string[]): Promise<void> {
  const resolved = path.resolve(rawPath);
  const match = currentPaths.find(p => p === resolved || p === rawPath);
  if (!match) {
    ctx.showError(`Path not in allowed list: ${resolved}`);
    return;
  }
  const updated = currentPaths.filter(p => p !== match);
  ctx.state.harness.setState({ sandboxAllowedPaths: updated } as any);
  await ctx.state.harness.setThreadSetting({ key: 'sandboxAllowedPaths', value: updated });
  ctx.showInfo(`Removed from sandbox: ${match}`);
}

async function showSandboxAddPrompt(ctx: SlashCommandContext): Promise<void> {
  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: 'Enter path to allow',
        formatResult: answer => {
          return `Path: ${path.resolve(answer)}`;
        },
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          await sandboxAddPath(ctx, answer);
          resolve();
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve();
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = questionComponent;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(questionComponent);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

export async function handleSandboxCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const harnessState = ctx.state.harness.getState() as {
    sandboxAllowedPaths?: string[];
  };
  const currentPaths = harnessState.sandboxAllowedPaths ?? [];

  const subcommand = args[0]?.toLowerCase();
  if (subcommand === 'add' && args.length > 1) {
    await sandboxAddPath(ctx, args.slice(1).join(' ').trim());
    return;
  }
  if (subcommand === 'remove' && args.length > 1) {
    await sandboxRemovePath(ctx, args.slice(1).join(' ').trim(), currentPaths);
    return;
  }

  // Interactive mode — show inline selector
  const options: Array<{ label: string; description?: string }> = [
    { label: 'Add path', description: 'Allow access to another directory' },
  ];

  for (const p of currentPaths) {
    options.push({
      label: `Remove: ${p}`,
      description: p,
    });
  }

  const pathsSummary = currentPaths.length
    ? `${currentPaths.length} allowed path${currentPaths.length > 1 ? 's' : ''}`
    : 'no extra paths';

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `Sandbox settings (${pathsSummary})`,
        options,
        formatResult: answer => {
          if (answer === 'Add path') return 'Adding sandbox path…';
          if (answer.startsWith('Remove: ')) {
            return `Removed: ${answer.replace('Remove: ', '')}`;
          }
          return answer;
        },
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          if (answer === 'Add path') {
            resolve();
            await showSandboxAddPrompt(ctx);
          } else if (answer.startsWith('Remove: ')) {
            const targetPath = answer.replace('Remove: ', '');
            if (currentPaths.includes(targetPath)) {
              await sandboxRemovePath(ctx, targetPath, currentPaths);
            }
            resolve();
          } else {
            resolve();
          }
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve();
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = questionComponent;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(questionComponent);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
