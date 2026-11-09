import { describe, expect, it } from 'vitest';
import { refusalText, slimElement } from './semantic.js';

describe('semantic result boundaries', () => {
  it('bounds daemon refusal text', () => {
    expect(refusalText({ code: 'denied', message: 'x'.repeat(500) })).toHaveLength(400);
  });

  it('keeps only bounded model-facing element fields', () => {
    expect(
      slimElement({
        id: 'element-1',
        role: 'button',
        name: 'Save',
        content: { kind: 'text', value: 'ready' },
        actions: [{ availability: 'available', name: 'activate' }],
      }),
    ).toMatchObject({ id: 'element-1', role: 'button', name: 'Save', text: 'ready', actions: ['activate'] });
  });
});
