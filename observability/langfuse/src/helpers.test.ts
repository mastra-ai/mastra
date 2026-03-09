import { buildTracingOptions } from '@mastra/observability';
import { describe, expect, it } from 'vitest';
import { withLangfusePrompt } from './helpers';

describe('withLangfusePrompt', () => {
  it('should add prompt metadata with name and version', () => {
    const result = buildTracingOptions(withLangfusePrompt({ name: 'test-prompt', version: 1 }));

    expect(result).toEqual({
      metadata: {
        langfuse: {
          prompt: {
            name: 'test-prompt',
            version: 1,
          },
        },
      },
    });
  });

  it('should add prompt metadata with id only', () => {
    const result = buildTracingOptions(withLangfusePrompt({ id: 'prompt-uuid-123' }));

    expect(result).toEqual({
      metadata: {
        langfuse: {
          prompt: {
            id: 'prompt-uuid-123',
          },
        },
      },
    });
  });

  it('should add prompt metadata with all fields', () => {
    const result = buildTracingOptions(withLangfusePrompt({ name: 'test-prompt', version: 2, id: 'prompt-uuid' }));

    expect(result).toEqual({
      metadata: {
        langfuse: {
          prompt: {
            name: 'test-prompt',
            version: 2,
            id: 'prompt-uuid',
          },
        },
      },
    });
  });

  it('should work with Langfuse SDK prompt object format', () => {
    // Simulating what langfuse.getPrompt() returns
    const langfusePrompt = {
      name: 'sdk-prompt',
      version: 3,
      id: 'sdk-uuid',
      prompt: 'You are a helpful assistant',
      config: { temperature: 0.7 },
      labels: ['production'],
    };

    const result = buildTracingOptions(withLangfusePrompt(langfusePrompt));

    expect(result).toEqual({
      metadata: {
        langfuse: {
          prompt: {
            name: 'sdk-prompt',
            version: 3,
            id: 'sdk-uuid',
          },
        },
      },
    });
  });

  it('should compose with other updaters', () => {
    const withUserId = (userId: string) => (opts: any) => ({
      ...opts,
      metadata: { ...opts.metadata, userId },
    });

    const result = buildTracingOptions(withLangfusePrompt({ name: 'test-prompt', version: 1 }), withUserId('user-123'));

    expect(result).toEqual({
      metadata: {
        langfuse: {
          prompt: {
            name: 'test-prompt',
            version: 1,
          },
        },
        userId: 'user-123',
      },
    });
  });

  it('should preserve existing metadata', () => {
    const customUpdater = (opts: any) => ({
      ...opts,
      metadata: {
        ...opts.metadata,
        customField: 'custom-value',
      },
    });

    const result = buildTracingOptions(customUpdater, withLangfusePrompt({ name: 'test-prompt', version: 1 }));

    expect(result).toEqual({
      metadata: {
        customField: 'custom-value',
        langfuse: {
          prompt: {
            name: 'test-prompt',
            version: 1,
          },
        },
      },
    });
  });
});
