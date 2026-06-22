import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lastInput: undefined as { getValue(): string } | undefined,
}));

vi.mock('@earendil-works/pi-tui', () => {
  class MockInput {
    focused = false;
    onSubmit?: (value: string) => void;
    onEscape?: () => void;
    private value = '';

    constructor() {
      mocks.lastInput = this;
    }

    getValue(): string {
      return this.value;
    }

    setValue(value: string): void {
      this.value = value;
    }

    handleInput(data: string): void {
      if (data === '\r') {
        this.onSubmit?.(this.value);
      } else if (data === '\x1b') {
        this.onEscape?.();
      } else {
        this.value += data;
      }
    }

    invalidate(): void {}

    render(_width: number): string[] {
      return [`input:${this.value}`];
    }
  }

  return { Input: MockInput };
});

import { MaskedInput } from '../masked-input';

describe('MaskedInput', () => {
  beforeEach(() => {
    mocks.lastInput = undefined;
  });

  it('masks rendered text while preserving the real value', () => {
    const input = new MaskedInput();
    input.setValue('sk-secret-token');

    const lines = input.render(40);

    expect(lines.join('\n')).toContain('***************');
    expect(lines.join('\n')).not.toContain('sk-secret-token');
    expect(input.getValue()).toBe('sk-secret-token');
    expect(mocks.lastInput?.getValue()).toBe('sk-secret-token');
  });

  it('submits the unmasked value after rendering', () => {
    const input = new MaskedInput();
    const onSubmit = vi.fn();
    input.onSubmit = onSubmit;
    input.setValue('postgres://user:pass@example.test/db');

    input.render(80);
    input.handleInput('\r');

    expect(onSubmit).toHaveBeenCalledWith('postgres://user:pass@example.test/db');
  });
});
