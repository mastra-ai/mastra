import { EventEmitter } from 'node:events';

import { Container } from '@earendil-works/pi-tui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAdversarialReviewPrompt,
  handleAdversarialReviewCommand,
  parseAdversarialReviewArgs,
  parseHeadlessJsonOutput,
} from '../adversarial-review.js';
import type { SlashCommandContext } from '../types.js';

const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

function createContext(models: Array<{ id: string; hasApiKey: boolean }> = []) {
  const chatContainer = new Container();
  const ctx = {
    state: {
      chatContainer,
      ui: { requestRender: vi.fn() },
    },
    controller: {
      listAvailableModels: vi.fn(async () => models),
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
  return { ctx, chatContainer };
}

describe('parseAdversarialReviewArgs', () => {
  it('treats a numeric token as the PR number and a non-numeric token as the model', () => {
    expect(parseAdversarialReviewArgs(['1234', 'openai/gpt-5.2'])).toEqual({
      prNumber: '1234',
      model: 'openai/gpt-5.2',
    });
  });

  it('is order-independent and strips a leading #', () => {
    expect(parseAdversarialReviewArgs(['openai/gpt-5.2', '#1234'])).toEqual({
      prNumber: '1234',
      model: 'openai/gpt-5.2',
    });
  });

  it('supports omitting either argument', () => {
    expect(parseAdversarialReviewArgs([])).toEqual({});
    expect(parseAdversarialReviewArgs(['1234'])).toEqual({ prNumber: '1234' });
    expect(parseAdversarialReviewArgs(['openai/gpt-5.2'])).toEqual({ model: 'openai/gpt-5.2' });
  });
});

describe('buildAdversarialReviewPrompt', () => {
  it('targets the given PR number', () => {
    const prompt = buildAdversarialReviewPrompt('1234');
    expect(prompt).toContain('Review PR #1234.');
    expect(prompt).toContain('READ-ONLY');
  });

  it('falls back to detecting the current branch PR', () => {
    const prompt = buildAdversarialReviewPrompt();
    expect(prompt).toContain('gh pr view --json number,title,url');
  });
});

describe('parseHeadlessJsonOutput', () => {
  it('parses the final JSON object and skips non-JSON noise', () => {
    const stdout = 'some warning\n{"status":"completed","text":"LGTM","threadId":"t-1"}\n';
    expect(parseHeadlessJsonOutput(stdout)).toEqual({ status: 'completed', text: 'LGTM', threadId: 't-1' });
  });

  it('returns undefined when no JSON is present', () => {
    expect(parseHeadlessJsonOutput('garbage output')).toBeUndefined();
  });
});

describe('handleAdversarialReviewCommand', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('rejects an unknown model without spawning', async () => {
    const { ctx } = createContext([{ id: 'openai/gpt-5.2', hasApiKey: true }]);

    await handleAdversarialReviewCommand(ctx, ['no-such/model']);

    expect(ctx.showError).toHaveBeenCalledWith(
      'Unknown model: "no-such/model". Use /models to see available model IDs.',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('spawns a headless instance with the model and PR-targeted prompt', async () => {
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);
    const { ctx } = createContext([{ id: 'openai/gpt-5.2', hasApiKey: true }]);

    await handleAdversarialReviewCommand(ctx, ['1234', 'openai/gpt-5.2']);
    child.emit('close', 0);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [execPath, spawnArgs, options] = spawnMock.mock.calls[0]!;
    expect(execPath).toBe(process.execPath);
    expect(spawnArgs).toContain(process.argv[1]);
    const promptIndex = spawnArgs.indexOf('--prompt');
    expect(spawnArgs[promptIndex + 1]).toContain('Review PR #1234.');
    const modelIndex = spawnArgs.indexOf('--model');
    expect(spawnArgs[modelIndex + 1]).toBe('openai/gpt-5.2');
    const outputIndex = spawnArgs.indexOf('--output');
    expect(spawnArgs[outputIndex + 1]).toBe('json');
    expect(spawnArgs).not.toContain('--continue');
    expect(spawnArgs).not.toContain('--thread');
    expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
  });

  it('omits --model when no model is given', async () => {
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);
    const { ctx } = createContext();

    await handleAdversarialReviewCommand(ctx, ['1234']);
    child.emit('close', 0);

    const [, spawnArgs] = spawnMock.mock.calls[0]!;
    expect(spawnArgs).not.toContain('--model');
  });

  it('renders the review text in chat when the run completes', async () => {
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);
    const { ctx, chatContainer } = createContext();

    await handleAdversarialReviewCommand(ctx, ['1234']);
    const childrenBefore = chatContainer.children.length;

    child.stdout.emit('data', Buffer.from('{"status":"completed","text":"## Review\\nLooks good","threadId":"t-1"}\n'));
    child.emit('close', 0);

    expect(chatContainer.children.length).toBeGreaterThan(childrenBefore);
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('does not render a review component when the run fails', async () => {
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);
    const { ctx, chatContainer } = createContext();

    await handleAdversarialReviewCommand(ctx, ['1234']);
    const childrenBefore = chatContainer.children.length;

    child.stderr.emit('data', Buffer.from('Error: something exploded\n'));
    child.emit('close', 1);

    expect(chatContainer.children.length).toBe(childrenBefore);
  });
});
