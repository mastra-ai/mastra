/**
 * Schema Tests
 *
 * Tests for the 17 flat browser tool schemas.
 * These schemas are defined in @mastra/core/browser.
 */

import {
  gotoInputSchema,
  snapshotInputSchema,
  clickInputSchema,
  typeInputSchema,
  pressInputSchema,
  selectInputSchema,
  scrollInputSchema,
  screenshotInputSchema,
  closeInputSchema,
  hoverInputSchema,
  backInputSchema,
  uploadInputSchema,
  dialogInputSchema,
  waitInputSchema,
  tabsInputSchema,
  dragInputSchema,
  evaluateInputSchema,
} from '@mastra/core/browser';
import { describe, expect, it } from 'vitest';

// =============================================================================
// Core Tools (9)
// =============================================================================

describe('gotoInputSchema', () => {
  it('accepts valid URL', () => {
    const result = gotoInputSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts URL with waitUntil', () => {
    const result = gotoInputSchema.safeParse({ url: 'https://example.com', waitUntil: 'networkidle' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid waitUntil values', () => {
    const result = gotoInputSchema.safeParse({ url: 'https://example.com', waitUntil: 'never' });
    expect(result.success).toBe(false);
  });

  it('requires url', () => {
    const result = gotoInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('snapshotInputSchema', () => {
  it('accepts empty input', () => {
    const result = snapshotInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts interactiveOnly option', () => {
    const result = snapshotInputSchema.safeParse({ interactiveOnly: true });
    expect(result.success).toBe(true);
  });

  it('accepts maxDepth option', () => {
    const result = snapshotInputSchema.safeParse({ maxDepth: 5 });
    expect(result.success).toBe(true);
  });
});

describe('clickInputSchema', () => {
  it('accepts ref', () => {
    const result = clickInputSchema.safeParse({ ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('accepts ref with button', () => {
    const result = clickInputSchema.safeParse({ ref: '@e5', button: 'right' });
    expect(result.success).toBe(true);
  });

  it('accepts ref with clickCount for double-click', () => {
    const result = clickInputSchema.safeParse({ ref: '@e5', clickCount: 2 });
    expect(result.success).toBe(true);
  });

  it('accepts ref with modifiers', () => {
    const result = clickInputSchema.safeParse({ ref: '@e5', modifiers: ['Control', 'Shift'] });
    expect(result.success).toBe(true);
  });

  it('requires ref', () => {
    const result = clickInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('typeInputSchema', () => {
  it('accepts ref and text', () => {
    const result = typeInputSchema.safeParse({ ref: '@e5', text: 'hello world' });
    expect(result.success).toBe(true);
  });

  it('accepts clear option', () => {
    const result = typeInputSchema.safeParse({ ref: '@e5', text: 'new text', clear: true });
    expect(result.success).toBe(true);
  });

  it('accepts delay option', () => {
    const result = typeInputSchema.safeParse({ ref: '@e5', text: 'slow', delay: 100 });
    expect(result.success).toBe(true);
  });

  it('requires ref', () => {
    const result = typeInputSchema.safeParse({ text: 'hello' });
    expect(result.success).toBe(false);
  });

  it('requires text', () => {
    const result = typeInputSchema.safeParse({ ref: '@e5' });
    expect(result.success).toBe(false);
  });
});

describe('pressInputSchema', () => {
  it('accepts key', () => {
    const result = pressInputSchema.safeParse({ key: 'Enter' });
    expect(result.success).toBe(true);
  });

  it('accepts key combinations', () => {
    const result = pressInputSchema.safeParse({ key: 'Control+a' });
    expect(result.success).toBe(true);
  });

  it('accepts key with modifiers array', () => {
    const result = pressInputSchema.safeParse({ key: 'a', modifiers: ['Control'] });
    expect(result.success).toBe(true);
  });

  it('requires key', () => {
    const result = pressInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('selectInputSchema', () => {
  it('accepts ref with value', () => {
    const result = selectInputSchema.safeParse({ ref: '@e5', value: 'option1' });
    expect(result.success).toBe(true);
  });

  it('accepts ref with label', () => {
    const result = selectInputSchema.safeParse({ ref: '@e5', label: 'Option One' });
    expect(result.success).toBe(true);
  });

  it('accepts ref with index', () => {
    const result = selectInputSchema.safeParse({ ref: '@e5', index: 0 });
    expect(result.success).toBe(true);
  });

  it('requires ref', () => {
    const result = selectInputSchema.safeParse({ value: 'option1' });
    expect(result.success).toBe(false);
  });
});

describe('scrollInputSchema', () => {
  it('accepts direction', () => {
    const result = scrollInputSchema.safeParse({ direction: 'down' });
    expect(result.success).toBe(true);
  });

  it('accepts direction with amount', () => {
    const result = scrollInputSchema.safeParse({ direction: 'down', amount: 500 });
    expect(result.success).toBe(true);
  });

  it('accepts ref to scroll into view', () => {
    const result = scrollInputSchema.safeParse({ direction: 'down', ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('requires direction', () => {
    const result = scrollInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid direction', () => {
    const result = scrollInputSchema.safeParse({ direction: 'diagonal' });
    expect(result.success).toBe(false);
  });
});

describe('screenshotInputSchema', () => {
  it('accepts empty input', () => {
    const result = screenshotInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts ref', () => {
    const result = screenshotInputSchema.safeParse({ ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('accepts fullPage option', () => {
    const result = screenshotInputSchema.safeParse({ fullPage: true });
    expect(result.success).toBe(true);
  });
});

describe('closeInputSchema', () => {
  it('accepts empty input', () => {
    const result = closeInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Extended Tools (7)
// =============================================================================

describe('hoverInputSchema', () => {
  it('accepts ref', () => {
    const result = hoverInputSchema.safeParse({ ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('requires ref', () => {
    const result = hoverInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('backInputSchema', () => {
  it('accepts empty input', () => {
    const result = backInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('uploadInputSchema', () => {
  it('accepts ref and files', () => {
    const result = uploadInputSchema.safeParse({ ref: '@e5', files: ['/path/to/file.txt'] });
    expect(result.success).toBe(true);
  });

  it('accepts multiple files', () => {
    const result = uploadInputSchema.safeParse({ ref: '@e5', files: ['/path/to/file1.txt', '/path/to/file2.txt'] });
    expect(result.success).toBe(true);
  });

  it('requires ref', () => {
    const result = uploadInputSchema.safeParse({ files: ['/path/to/file.txt'] });
    expect(result.success).toBe(false);
  });

  it('requires files', () => {
    const result = uploadInputSchema.safeParse({ ref: '@e5' });
    expect(result.success).toBe(false);
  });
});

describe('dialogInputSchema', () => {
  it('accepts accept action', () => {
    const result = dialogInputSchema.safeParse({ action: 'accept' });
    expect(result.success).toBe(true);
  });

  it('accepts dismiss action', () => {
    const result = dialogInputSchema.safeParse({ action: 'dismiss' });
    expect(result.success).toBe(true);
  });

  it('accepts accept with text for prompts', () => {
    const result = dialogInputSchema.safeParse({ action: 'accept', text: 'user input' });
    expect(result.success).toBe(true);
  });

  it('requires action', () => {
    const result = dialogInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('waitInputSchema', () => {
  it('accepts ref', () => {
    const result = waitInputSchema.safeParse({ ref: '@e5' });
    expect(result.success).toBe(true);
  });

  it('accepts ref with state', () => {
    const result = waitInputSchema.safeParse({ ref: '@e5', state: 'visible' });
    expect(result.success).toBe(true);
  });

  it('accepts timeout', () => {
    const result = waitInputSchema.safeParse({ ref: '@e5', timeout: 5000 });
    expect(result.success).toBe(true);
  });

  it('accepts empty input for simple delay', () => {
    const result = waitInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('tabsInputSchema', () => {
  it('accepts list action', () => {
    const result = tabsInputSchema.safeParse({ action: 'list' });
    expect(result.success).toBe(true);
  });

  it('accepts new action', () => {
    const result = tabsInputSchema.safeParse({ action: 'new' });
    expect(result.success).toBe(true);
  });

  it('accepts new action with url', () => {
    const result = tabsInputSchema.safeParse({ action: 'new', url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts switch action with index', () => {
    const result = tabsInputSchema.safeParse({ action: 'switch', index: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts close action', () => {
    const result = tabsInputSchema.safeParse({ action: 'close' });
    expect(result.success).toBe(true);
  });

  it('accepts close action with index', () => {
    const result = tabsInputSchema.safeParse({ action: 'close', index: 2 });
    expect(result.success).toBe(true);
  });

  it('requires action', () => {
    const result = tabsInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('dragInputSchema', () => {
  it('accepts sourceRef and targetRef', () => {
    const result = dragInputSchema.safeParse({ sourceRef: '@e5', targetRef: '@e10' });
    expect(result.success).toBe(true);
  });

  it('requires sourceRef', () => {
    const result = dragInputSchema.safeParse({ targetRef: '@e10' });
    expect(result.success).toBe(false);
  });

  it('requires targetRef', () => {
    const result = dragInputSchema.safeParse({ sourceRef: '@e5' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Escape Hatch (1)
// =============================================================================

describe('evaluateInputSchema', () => {
  it('accepts script', () => {
    const result = evaluateInputSchema.safeParse({ script: 'return document.title' });
    expect(result.success).toBe(true);
  });

  it('requires script', () => {
    const result = evaluateInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
