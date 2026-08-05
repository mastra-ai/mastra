import { describe, expect, it } from 'vitest';

import { applyThemeMode, getSelectListTheme, getThemeMode } from '../../theme.js';
import { AskQuestionBorderedBox, AskQuestionInlineComponent } from '../ask-question-inline.js';
import { WrappingSelectList } from '../wrapping-select-list.js';

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
    // Byte-identity contract: cached output equals a fresh instance's output.
    expect(narrow).toEqual(answeredBox().render(40));
    expect(box.render(80)).toEqual(answeredBox().render(80));
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

  it('never caches interactive boxes: a selection move is reflected in the next render at the same width', () => {
    const selectList = new WrappingSelectList(
      ITEMS.map(i => ({ value: i.label, label: i.label })),
      5,
      getSelectListTheme(),
    );
    const box = new AskQuestionBorderedBox(['Which option?'], 'hint', ITEMS, selectList);
    const first = box.render(80);
    expect(first.join('\n')).toContain('→ Option A');

    // Same width, selection moved — a cached render would still show Option A selected.
    selectList.setSelectedIndex(1);
    const second = box.render(80);
    expect(second).not.toBe(first);
    expect(second.join('\n')).toContain('→ Option B');
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
