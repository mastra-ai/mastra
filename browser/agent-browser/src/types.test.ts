import { describe, expect, it } from 'vitest';

import { closeInputSchema } from './tools/close.js';
import {
  navigateInputSchema,
  snapshotInputSchema,
  clickInputSchema,
  typeInputSchema,
  scrollInputSchema,
  screenshotInputSchema,
} from './types.js';

describe('navigateInputSchema', () => {
  it('accepts a valid URL', () => {
    const result = navigateInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid URL', () => {
    const result = navigateInputSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults waitUntil to domcontentloaded', () => {
    const result = navigateInputSchema.parse({ url: 'https://example.com' });
    expect(result.waitUntil).toBe('domcontentloaded');
  });

  it('accepts valid waitUntil values', () => {
    for (const value of ['load', 'domcontentloaded', 'networkidle'] as const) {
      const result = navigateInputSchema.safeParse({ url: 'https://example.com', waitUntil: value });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid waitUntil values', () => {
    const result = navigateInputSchema.safeParse({ url: 'https://example.com', waitUntil: 'never' });
    expect(result.success).toBe(false);
  });
});

describe('snapshotInputSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = snapshotInputSchema.parse({});
    expect(result.interactiveOnly).toBe(true);
    expect(result.maxElements).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('accepts custom values', () => {
    const result = snapshotInputSchema.parse({ interactiveOnly: false, maxElements: 100, offset: 25 });
    expect(result.interactiveOnly).toBe(false);
    expect(result.maxElements).toBe(100);
    expect(result.offset).toBe(25);
  });
});

describe('clickInputSchema', () => {
  it('requires a ref', () => {
    const result = clickInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts a ref with default button', () => {
    const result = clickInputSchema.parse({ ref: '@e5' });
    expect(result.ref).toBe('@e5');
    expect(result.button).toBe('left');
  });

  it('accepts all button types', () => {
    for (const button of ['left', 'right', 'middle'] as const) {
      const result = clickInputSchema.safeParse({ ref: '@e1', button });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid button', () => {
    const result = clickInputSchema.safeParse({ ref: '@e1', button: 'back' });
    expect(result.success).toBe(false);
  });
});

describe('typeInputSchema', () => {
  it('requires ref and text', () => {
    expect(typeInputSchema.safeParse({}).success).toBe(false);
    expect(typeInputSchema.safeParse({ ref: '@e1' }).success).toBe(false);
    expect(typeInputSchema.safeParse({ text: 'hello' }).success).toBe(false);
  });

  it('accepts ref and text with clearFirst default', () => {
    const result = typeInputSchema.parse({ ref: '@e3', text: 'hello' });
    expect(result.clearFirst).toBe(false);
  });
});

describe('scrollInputSchema', () => {
  it('requires a direction', () => {
    const result = scrollInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts all direction values', () => {
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      const result = scrollInputSchema.safeParse({ direction });
      expect(result.success).toBe(true);
    }
  });

  it('defaults amount to page', () => {
    const result = scrollInputSchema.parse({ direction: 'down' });
    expect(result.amount).toBe('page');
  });

  it('accepts numeric amount', () => {
    const result = scrollInputSchema.parse({ direction: 'down', amount: 300 });
    expect(result.amount).toBe(300);
  });

  it('accepts an optional ref for element scrolling', () => {
    const result = scrollInputSchema.parse({ direction: 'down', ref: '@e10' });
    expect(result.ref).toBe('@e10');
  });
});

describe('screenshotInputSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = screenshotInputSchema.parse({});
    expect(result.fullPage).toBe(false);
    expect(result.format).toBe('png');
    expect(result.quality).toBe(80);
  });

  it('rejects quality outside 0-100', () => {
    expect(screenshotInputSchema.safeParse({ quality: -1 }).success).toBe(false);
    expect(screenshotInputSchema.safeParse({ quality: 101 }).success).toBe(false);
  });

  it('accepts an element ref', () => {
    const result = screenshotInputSchema.parse({ ref: '@e2' });
    expect(result.ref).toBe('@e2');
  });
});

describe('closeInputSchema', () => {
  it('accepts empty input', () => {
    const result = closeInputSchema.parse({});
    expect(result.reason).toBeUndefined();
  });

  it('accepts an optional reason', () => {
    const result = closeInputSchema.parse({ reason: 'Task complete' });
    expect(result.reason).toBe('Task complete');
  });
});
