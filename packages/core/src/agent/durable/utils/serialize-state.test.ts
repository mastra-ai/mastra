import { describe, expect, it } from 'vitest';
import type { CoreTool } from '../../../tools/types';
import { serializeToolMetadata } from './serialize-state';

type ApprovalMetadataToolFixture = CoreTool & {
  requireApproval?: boolean;
  needsApproval?: boolean | ((args: unknown) => boolean);
  needsApprovalFn?: (args: unknown) => boolean;
};

describe('serializeToolMetadata', () => {
  it('marks dynamic approval tools as requiring approval in serializable metadata', () => {
    const metadata = serializeToolMetadata('dynamic-tool', {
      description: 'A dynamically approved tool',
      parameters: { type: 'object' },
      requireApproval: false,
      needsApprovalFn: () => true,
    } as ApprovalMetadataToolFixture);

    expect(metadata.requireApproval).toBe(true);
  });

  it('marks raw AI SDK approval tools as requiring approval in serializable metadata', () => {
    const booleanMetadata = serializeToolMetadata('raw-boolean-tool', {
      description: 'A raw AI SDK approval tool',
      parameters: { type: 'object' },
      needsApproval: true,
    } as ApprovalMetadataToolFixture);
    const dynamicMetadata = serializeToolMetadata('raw-dynamic-tool', {
      description: 'A raw AI SDK dynamic approval tool',
      parameters: { type: 'object' },
      needsApproval: () => true,
    } as ApprovalMetadataToolFixture);

    expect(booleanMetadata.requireApproval).toBe(true);
    expect(dynamicMetadata.requireApproval).toBe(true);
  });

  it('does not mark tools as requiring approval when static approval metadata is false or omitted', () => {
    const booleanMetadata = serializeToolMetadata('raw-boolean-tool', {
      description: 'A raw AI SDK tool without approval',
      parameters: { type: 'object' },
      needsApproval: false,
    } as ApprovalMetadataToolFixture);
    const omittedMetadata = serializeToolMetadata('plain-tool', {
      description: 'A tool without approval metadata',
      parameters: { type: 'object' },
    } as ApprovalMetadataToolFixture);
    const explicitMetadata = serializeToolMetadata('explicit-tool', {
      description: 'A tool with approval disabled',
      parameters: { type: 'object' },
      requireApproval: false,
    } as ApprovalMetadataToolFixture);

    expect(booleanMetadata.requireApproval).toBe(false);
    expect(omittedMetadata.requireApproval).toBe(false);
    expect(explicitMetadata.requireApproval).toBe(false);
  });

  it('serializes function-valued approval metadata as approval-bearing without evaluating it', () => {
    const metadata = serializeToolMetadata('raw-dynamic-tool', {
      description: 'A raw AI SDK tool with conditional approval',
      parameters: { type: 'object' },
      needsApproval: () => false,
    } as ApprovalMetadataToolFixture);

    expect(metadata.requireApproval).toBe(true);
  });

  it('respects explicit static approval metadata', () => {
    const metadata = serializeToolMetadata('approval-tool', {
      description: 'A statically approved tool',
      parameters: { type: 'object' },
      requireApproval: true,
    } as ApprovalMetadataToolFixture);

    expect(metadata.requireApproval).toBe(true);
  });
});
