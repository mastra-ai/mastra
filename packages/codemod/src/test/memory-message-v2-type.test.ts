import { describe, expect, it } from 'vitest';
import moveCoreImports from '../codemods/v1/mastra-core-imports';
import transformer from '../codemods/v1/memory-message-v2-type';
import { applyTransform, testTransform } from './test-utils';

describe('memory-message-v2-type', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'memory-message-v2-type');
  });

  it.each([
    ['import move before type rename', [moveCoreImports, transformer]],
    ['type rename before import move', [transformer, moveCoreImports]],
  ] as const)('produces a valid v1 import when the %s', (_name, transforms) => {
    const input = `import type { MastraMessageV2 } from '@mastra/core';
const message = {} as MastraMessageV2;
`;
    const expected = `import type { MastraDBMessage } from '@mastra/core/agent';
const message = {} as MastraDBMessage;
`;

    const output = transforms.reduce((source, transform) => applyTransform(transform, source), input);

    expect(output).toBe(expected);
  });
});
