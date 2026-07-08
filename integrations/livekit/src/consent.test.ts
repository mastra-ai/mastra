import { describe, expect, it, vi } from 'vitest';
import { createConsentTool } from './consent';

// Minimal stand-in for the tool execution context: only the agent identity fields the tool reads.
function ctx(agent?: { resourceId?: string; threadId?: string }) {
  return { agent } as Parameters<NonNullable<ReturnType<typeof createConsentTool>['execute']>>[1];
}

describe('createConsentTool', () => {
  it('captures the grant with the caller identity from the tool context', async () => {
    const onGrant = vi.fn();
    const tool = createConsentTool({ onGrant });
    const result = await tool.execute!(
      { item: 'summaryStorage', granted: true },
      ctx({ resourceId: 'caller-1', threadId: 'call-1' }),
    );
    expect(onGrant).toHaveBeenCalledWith({
      item: 'summaryStorage',
      granted: true,
      resourceId: 'caller-1',
      threadId: 'call-1',
    });
    expect(result).toEqual({ recorded: true, item: 'summaryStorage', granted: true });
  });

  it('records a declined decision', async () => {
    const onGrant = vi.fn();
    const tool = createConsentTool({ onGrant });
    await tool.execute!({ item: 'summaryStorage', granted: false }, ctx({ resourceId: 'r' }));
    expect(onGrant).toHaveBeenCalledWith(
      expect.objectContaining({ granted: false, resourceId: 'r', threadId: undefined }),
    );
  });

  it('passes undefined identity when the call is not memory-scoped', async () => {
    const onGrant = vi.fn();
    const tool = createConsentTool({ onGrant });
    await tool.execute!({ item: 'x', granted: true }, ctx(undefined));
    expect(onGrant).toHaveBeenCalledWith(expect.objectContaining({ resourceId: undefined, threadId: undefined }));
  });

  it('defaults the tool id to recordConsent and allows an override', () => {
    expect(createConsentTool({ onGrant: vi.fn() }).id).toBe('recordConsent');
    expect(createConsentTool({ onGrant: vi.fn(), id: 'grantConsent' }).id).toBe('grantConsent');
  });

  it('does not throw when onGrant is async', async () => {
    const onGrant = vi.fn(async () => {});
    const tool = createConsentTool({ onGrant, items: ['summaryStorage'] });
    await expect(tool.execute!({ item: 'summaryStorage', granted: true }, ctx({ resourceId: 'r' }))).resolves.toEqual({
      recorded: true,
      item: 'summaryStorage',
      granted: true,
    });
  });
});
