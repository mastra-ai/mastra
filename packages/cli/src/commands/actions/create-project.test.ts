import { describe, expect, it, vi } from 'vitest';

import { createProject } from './create-project';

const { mockCreate, mockTrackCommandExecution, mockTrackEvent } = vi.hoisted(() => ({
  mockCreate: vi.fn(() => Promise.resolve()),
  mockTrackCommandExecution: vi.fn(({ execution }: { execution: () => Promise<void> }) => execution()),
  mockTrackEvent: vi.fn(),
}));

vi.mock('../create/create', () => ({
  create: mockCreate,
}));

vi.mock('../..', () => ({
  analytics: {
    trackEvent: mockTrackEvent,
    trackCommandExecution: mockTrackCommandExecution,
  },
}));

describe('createProject', () => {
  it('passes the positional project name to create with --default', async () => {
    await createProject('my-app', { default: true });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'my-app',
        components: ['agents', 'tools', 'workflows'],
      }),
    );
  });

  it('passes the positional project name to create without --default', async () => {
    await createProject('my-app', {
      components: ['agents'],
      llm: 'openai',
      dir: 'src/',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'my-app',
        directory: 'src/',
        components: ['agents'],
        llmProvider: 'openai',
      }),
    );
  });

  it('passes undefined when no positional project name is provided', async () => {
    await createProject(undefined, { default: true });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ projectName: undefined }));
  });

  it('records the positional project name in analytics args', async () => {
    await createProject('my-app', { default: true });

    expect(mockTrackCommandExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'create',
        args: expect.objectContaining({ projectName: 'my-app' }),
      }),
    );
  });
});
