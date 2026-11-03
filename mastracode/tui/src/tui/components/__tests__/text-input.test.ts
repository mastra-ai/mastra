import { describe, expect, it } from 'vitest';

import { MaskedInput } from '../masked-input.js';
import { TextInput } from '../text-input.js';

const plain = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;]*m|\x1b_[^\x07]*\x07/g, ''));

describe('TextInput', () => {
  it("draws the prompt's › instead of pi-tui's >", () => {
    const input = new TextInput();
    input.setValue('fast-claude');
    expect(plain(input.render(40))[0]).toMatch(/^› fast-claude/);
  });

  it('is what MaskedInput draws, with the value masked', () => {
    const input = new MaskedInput();
    input.setValue('sk-secret');
    expect(plain(input.render(40))[0]).toMatch(/^› \*{9}/);
  });
});
