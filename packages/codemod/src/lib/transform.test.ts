import { describe, expect, it } from 'vitest';
import { transform } from './transform';

describe('transform', () => {
  it('rejects unknown codemod names', async () => {
    await expect(transform('v1/does-not-exist', '.', {}, { logStatus: false })).rejects.toThrow(
      'Unknown codemod "v1/does-not-exist". Available codemods: v1/mastra-core-imports',
    );
  });
});
