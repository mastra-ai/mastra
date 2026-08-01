import { describe, expect, it } from 'vitest';

import { applyThemeMode, getThemeMode } from '../../theme.js';
import { AskQuestionBorderedBox, AskQuestionInlineComponent } from '../ask-question-inline.js';

const ITEMS = [{ label: 'Option A' }, { label: 'Option B' }];

function answeredBox(): AskQuestionBorderedBox {
  const box = new AskQuestionBorderedBox(['Which option?'], 'hint', ITEMS);
  box.setAnswered('Option A', false);
  return box;
}

describe('AskQuestionBorderedBox render caching', () => {
  it('caches settled boxes: repeated renders at the same width return the identical array', () => {
    const box = answeredBox();
    const first = box.render(80);
    expect(box.render(80)).toBe(first);
  });

  it('recomputes when the width changes and re-caches at the new width', () => {
    const box = answeredBox();
    const wide = box.render(80);
    const narrow = box.render(40);
    expect(narrow).not.toBe(wide);
    expect(box.render(40)).toBe(narrow);
  });

  it('recomputes after invalidate()', () => {
    const box = answeredBox();
    const first = box.render(80);
    box.invalidate();
    const second = box.render(80);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it('recomputes when the theme changes', () => {
    const originalMode = getThemeMode();
    const box = answeredBox();
    const first = box.render(80);
    try {
      applyThemeMode(originalMode === 'dark' ? 'light' : 'dark');
      expect(box.render(80)).not.toBe(first);
    } finally {
      applyThemeMode(originalMode);
    }
  });

  it('never caches unsettled boxes: streaming renders reflect updated args', () => {
    const component = AskQuestionInlineComponent.createStreaming();
    component.updateArgs({ question: 'Which option?', options: [ITEMS[0]] });
    const first = component.render(80);
    const firstText = first.join('\n');
    expect(firstText).toContain('Option A');
    expect(firstText).not.toContain('Option B');

    // Same width, new streamed args — a cached render would miss Option B.
    component.updateArgs({ question: 'Which option?', options: ITEMS });
    const second = component.render(80);
    expect(second).not.toBe(first);
    expect(second.join('\n')).toContain('Option B');
  });

  it('freezes with the answer after setAnswered and shows it in subsequent renders', () => {
    const component = AskQuestionInlineComponent.fromHistory('Which option?', ITEMS, 'Option B', false);
    const rendered = component.render(80).join('\n');
    expect(rendered).toContain('✓');
    expect(rendered).toContain('Option B');
  });
});
