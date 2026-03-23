/**
 * Schema Tests
 *
 * Tests for the 19 grouped browser tool schemas.
 * These schemas are defined in @mastra/core/browser and use discriminated unions.
 */

import {
  navigateInputSchema,
  interactInputSchema,
  inputInputSchema,
  scrollInputSchema,
  extractInputSchema,
  formInputSchema,
} from '@mastra/core/browser';
import { describe, expect, it } from 'vitest';

describe('navigateInputSchema', () => {
  it('accepts goto action with valid URL', () => {
    const result = navigateInputSchema.safeParse({ action: 'goto', url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects goto action with invalid URL', () => {
    const result = navigateInputSchema.safeParse({ action: 'goto', url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults waitUntil to domcontentloaded for goto', () => {
    const result = navigateInputSchema.parse({ action: 'goto', url: 'https://example.com' });
    if (result.action === 'goto') {
      expect(result.waitUntil).toBe('domcontentloaded');
    }
  });

  it('accepts valid waitUntil values for goto', () => {
    for (const waitUntil of ['load', 'domcontentloaded', 'networkidle'] as const) {
      const result = navigateInputSchema.safeParse({ action: 'goto', url: 'https://example.com', waitUntil });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid waitUntil values', () => {
    const result = navigateInputSchema.safeParse({ action: 'goto', url: 'https://example.com', waitUntil: 'never' });
    expect(result.success).toBe(false);
  });

  it('accepts back action', () => {
    const result = navigateInputSchema.safeParse({ action: 'back' });
    expect(result.success).toBe(true);
  });

  it('accepts forward action', () => {
    const result = navigateInputSchema.safeParse({ action: 'forward' });
    expect(result.success).toBe(true);
  });

  it('accepts reload action', () => {
    const result = navigateInputSchema.safeParse({ action: 'reload' });
    expect(result.success).toBe(true);
  });

  it('accepts close action', () => {
    const result = navigateInputSchema.safeParse({ action: 'close' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown action', () => {
    const result = navigateInputSchema.safeParse({ action: 'teleport' });
    expect(result.success).toBe(false);
  });
});

describe('interactInputSchema', () => {
  it('accepts click action with ref', () => {
    const result = interactInputSchema.safeParse({ action: 'click', ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('requires ref for click action', () => {
    const result = interactInputSchema.safeParse({ action: 'click' });
    expect(result.success).toBe(false);
  });

  it('defaults button to left for click', () => {
    const result = interactInputSchema.parse({ action: 'click', ref: '@e5' });
    if (result.action === 'click') {
      expect(result.button).toBe('left');
    }
  });

  it('accepts all button types for click', () => {
    for (const button of ['left', 'right', 'middle'] as const) {
      const result = interactInputSchema.safeParse({ action: 'click', ref: '@e1', button });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid button for click', () => {
    const result = interactInputSchema.safeParse({ action: 'click', ref: '@e1', button: 'back' });
    expect(result.success).toBe(false);
  });

  it('accepts double_click action', () => {
    const result = interactInputSchema.safeParse({ action: 'double_click', ref: '@e1' });
    expect(result.success).toBe(true);
  });

  it('accepts hover action', () => {
    const result = interactInputSchema.safeParse({ action: 'hover', ref: '@e1' });
    expect(result.success).toBe(true);
  });

  it('accepts focus action', () => {
    const result = interactInputSchema.safeParse({ action: 'focus', ref: '@e1' });
    expect(result.success).toBe(true);
  });

  it('accepts drag action with source and target refs', () => {
    const result = interactInputSchema.safeParse({ action: 'drag', sourceRef: '@e1', targetRef: '@e2' });
    expect(result.success).toBe(true);
  });

  it('accepts tap action', () => {
    const result = interactInputSchema.safeParse({ action: 'tap', ref: '@e1' });
    expect(result.success).toBe(true);
  });
});

describe('inputInputSchema', () => {
  it('accepts fill action with ref and value', () => {
    const result = inputInputSchema.safeParse({ action: 'fill', ref: '@e3', value: 'hello' });
    expect(result.success).toBe(true);
  });

  it('requires ref for fill action', () => {
    const result = inputInputSchema.safeParse({ action: 'fill', value: 'hello' });
    expect(result.success).toBe(false);
  });

  it('requires value for fill action', () => {
    const result = inputInputSchema.safeParse({ action: 'fill', ref: '@e3' });
    expect(result.success).toBe(false);
  });

  it('accepts type action with ref and text', () => {
    const result = inputInputSchema.safeParse({ action: 'type', ref: '@e3', text: 'hello' });
    expect(result.success).toBe(true);
  });

  it('accepts press action with ref and key', () => {
    const result = inputInputSchema.safeParse({ action: 'press', ref: '@e3', key: 'Enter' });
    expect(result.success).toBe(true);
  });

  it('accepts clear action', () => {
    const result = inputInputSchema.safeParse({ action: 'clear', ref: '@e3' });
    expect(result.success).toBe(true);
  });

  it('accepts select_all action', () => {
    const result = inputInputSchema.safeParse({ action: 'select_all', ref: '@e3' });
    expect(result.success).toBe(true);
  });
});

describe('scrollInputSchema', () => {
  it('accepts scroll action with direction', () => {
    const result = scrollInputSchema.safeParse({ action: 'scroll', direction: 'down' });
    expect(result.success).toBe(true);
  });

  it('requires action field', () => {
    const result = scrollInputSchema.safeParse({ direction: 'down' });
    expect(result.success).toBe(false);
  });

  it('accepts all direction values for scroll', () => {
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      const result = scrollInputSchema.safeParse({ action: 'scroll', direction });
      expect(result.success).toBe(true);
    }
  });

  it('accepts numeric amount for scroll', () => {
    const result = scrollInputSchema.parse({ action: 'scroll', direction: 'down', amount: 300 });
    if (result.action === 'scroll') {
      expect(result.amount).toBe(300);
    }
  });

  it('accepts optional ref for element scrolling', () => {
    const result = scrollInputSchema.parse({ action: 'scroll', direction: 'down', ref: '@e10' });
    if (result.action === 'scroll') {
      expect(result.ref).toBe('@e10');
    }
  });

  it('accepts into_view action with ref', () => {
    const result = scrollInputSchema.safeParse({ action: 'into_view', ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('requires ref for into_view action', () => {
    const result = scrollInputSchema.safeParse({ action: 'into_view' });
    expect(result.success).toBe(false);
  });
});

describe('extractInputSchema', () => {
  it('accepts snapshot action with defaults', () => {
    const result = extractInputSchema.parse({ action: 'snapshot' });
    if (result.action === 'snapshot') {
      expect(result.interactiveOnly).toBe(true);
      expect(result.maxElements).toBe(50);
      expect(result.offset).toBe(0);
    }
  });

  it('accepts snapshot action with custom values', () => {
    const result = extractInputSchema.parse({
      action: 'snapshot',
      interactiveOnly: false,
      maxElements: 100,
      offset: 25,
    });
    if (result.action === 'snapshot') {
      expect(result.interactiveOnly).toBe(false);
      expect(result.maxElements).toBe(100);
      expect(result.offset).toBe(25);
    }
  });

  it('accepts screenshot action with defaults', () => {
    const result = extractInputSchema.parse({ action: 'screenshot' });
    if (result.action === 'screenshot') {
      expect(result.fullPage).toBe(false);
    }
  });

  it('accepts screenshot action with fullPage', () => {
    const result = extractInputSchema.parse({ action: 'screenshot', fullPage: true });
    if (result.action === 'screenshot') {
      expect(result.fullPage).toBe(true);
    }
  });

  it('accepts screenshot action with element ref', () => {
    const result = extractInputSchema.parse({ action: 'screenshot', ref: '@e2' });
    if (result.action === 'screenshot') {
      expect(result.ref).toBe('@e2');
    }
  });

  it('accepts text action with ref', () => {
    const result = extractInputSchema.safeParse({ action: 'text', ref: '@e1' });
    expect(result.success).toBe(true);
  });

  it('accepts html action with ref', () => {
    const result = extractInputSchema.safeParse({ action: 'html', ref: '@e1' });
    expect(result.success).toBe(true);
  });

  it('accepts title action', () => {
    const result = extractInputSchema.safeParse({ action: 'title' });
    expect(result.success).toBe(true);
  });

  it('accepts url action', () => {
    const result = extractInputSchema.safeParse({ action: 'url' });
    expect(result.success).toBe(true);
  });
});

describe('formInputSchema', () => {
  it('accepts select action with value', () => {
    const result = formInputSchema.safeParse({ action: 'select', ref: '@e5', value: 'opt1' });
    expect(result.success).toBe(true);
  });

  it('accepts select action with label', () => {
    const result = formInputSchema.safeParse({ action: 'select', ref: '@e5', label: 'Option One' });
    expect(result.success).toBe(true);
  });

  it('accepts select action with index', () => {
    const result = formInputSchema.safeParse({ action: 'select', ref: '@e5', index: 0 });
    expect(result.success).toBe(true);
  });

  it('requires ref for select action', () => {
    const result = formInputSchema.safeParse({ action: 'select', value: 'opt1' });
    expect(result.success).toBe(false);
  });

  it('accepts check action', () => {
    const result = formInputSchema.safeParse({ action: 'check', ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('accepts uncheck action', () => {
    const result = formInputSchema.safeParse({ action: 'uncheck', ref: '@e5' });
    expect(result.success).toBe(true);
  });
});
