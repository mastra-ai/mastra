import { describe, expect, it } from 'vitest';
import { serializeToolMetadata } from './serialize-state';

describe('serializeToolMetadata', () => {
  it('marks dynamic approval tools as requiring approval in serializable metadata', () => {
    const metadata = serializeToolMetadata('dynamic-tool', {
      description: 'A dynamically approved tool',
      parameters: { type: 'object' },
      requireApproval: false,
      needsApprovalFn: () => true,
    } as any);

    expect(metadata.requireApproval).toBe(true);
  });
});
