import { describe, expect, it } from 'vitest';

import { tokenEstimate, truncateStringForTokenEstimate } from '../token-estimator.js';

describe('token estimator', () => {
  it('sanitizes special markers before estimating', async () => {
    await expect(tokenEstimate('<|endoftext|>hello<|endofprompt|>')).resolves.toBe(await tokenEstimate('hello'));
  });

  it('truncates sanitized text from either end', async () => {
    const text = `<|endoftext|>${'alpha '.repeat(100)}`;

    const fromStart = await truncateStringForTokenEstimate(text, 5, false);
    const fromEnd = await truncateStringForTokenEstimate(text, 5);

    expect(fromStart).toMatch(/^\[Truncated ~/);
    expect(fromEnd).toMatch(/^\[Truncated ~/);
    expect(fromStart).not.toContain('<|endoftext|>');
    expect(fromEnd).not.toContain('<|endoftext|>');
  });
});
