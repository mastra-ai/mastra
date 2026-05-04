import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubagentsCommand } from '../subagents.js';
import type { SlashCommandContext } from '../types.js';

const askQuestionMock = vi.fn();

vi.mock('../../components/ask-question-inline.js', () => ({
  AskQuestionInlineComponent: class {
    props: any;

    constructor(props: any) {
      askQuestionMock(props);
      this.props = props;
    }
  },
}));

function createContext(subagents?: Array<{ id: string; name: string; description: string }>) {
  const chatContainer = {
    addChild: vi.fn(),
    invalidate: vi.fn(),
  };

  const ctx = {
    state: {
      harness: {
        config: {
          subagents,
        },
      },
      ui: {
        requestRender: vi.fn(),
      },
      chatContainer,
      activeInlineQuestion: undefined,
    },
    authStorage: {},
    showError: vi.fn(),
    showInfo: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, chatContainer };
}

describe('handleSubagentsCommand', () => {
  beforeEach(() => {
    askQuestionMock.mockReset();
  });

  it('falls back to built-in subagent types when no custom subagents are configured', async () => {
    const { ctx, chatContainer } = createContext();

    const promise = handleSubagentsCommand(ctx);

    expect(askQuestionMock).toHaveBeenCalledTimes(1);
    const question = askQuestionMock.mock.calls[0]?.[0];
    expect(question.question).toBe('Select subagent type');
    expect(question.options).toEqual([
      { label: 'Explore', description: 'Read-only codebase exploration' },
      { label: 'Plan', description: 'Read-only analysis and planning' },
      { label: 'Execute', description: 'Task execution with write access' },
    ]);
    expect(chatContainer.addChild).toHaveBeenCalledTimes(3);

    question.onCancel();
    await promise;
  });

  it('falls back to built-in subagent types when subagents is an empty array', async () => {
    const { ctx } = createContext([]);

    const promise = handleSubagentsCommand(ctx);

    expect(askQuestionMock).toHaveBeenCalledTimes(1);
    const question = askQuestionMock.mock.calls[0]?.[0];
    expect(question.options).toEqual([
      { label: 'Explore', description: 'Read-only codebase exploration' },
      { label: 'Plan', description: 'Read-only analysis and planning' },
      { label: 'Execute', description: 'Task execution with write access' },
    ]);

    question.onCancel();
    await promise;
  });

  it('renders configured subagents from the harness config', async () => {
    const { ctx } = createContext([
      {
        id: 'explore',
        name: 'Explore',
        description: 'Read-only codebase exploration',
      },
      {
        id: 'plan',
        name: 'Plan',
        description: 'Read-only analysis and planning',
      },
      {
        id: 'execute',
        name: 'Execute',
        description: 'Task execution with write access',
      },
      {
        id: 'test-writer',
        name: 'Test Writer',
        description: 'Write tests for the specified module',
      },
    ]);

    const promise = handleSubagentsCommand(ctx);

    expect(askQuestionMock).toHaveBeenCalledTimes(1);
    const question = askQuestionMock.mock.calls[0]?.[0];
    expect(question.options).toEqual([
      { label: 'Explore', description: 'Read-only codebase exploration' },
      { label: 'Plan', description: 'Read-only analysis and planning' },
      { label: 'Execute', description: 'Task execution with write access' },
      { label: 'Test Writer', description: 'Write tests for the specified module' },
    ]);

    question.onCancel();
    await promise;
  });
});
