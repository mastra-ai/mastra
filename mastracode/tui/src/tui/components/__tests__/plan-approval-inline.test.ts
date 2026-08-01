import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { applyThemeMode, getThemeMode } from '../../theme.js';
import {
  PlanApprovalInlineComponent,
  PlanContentBox,
  PlanDiffBox,
  PlanResultComponent,
} from '../plan-approval-inline.js';

describe('PlanApprovalInlineComponent', () => {
  it('includes a goal option and calls onGoal when selected', () => {
    const onGoal = vi.fn();
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal,
        onReject: vi.fn(),
      },
      {} as any,
    );

    const selectList = (component as any).selectList;
    expect(
      selectList.items.some(
        (item: { value: string; label: string }) => item.value === 'goal' && item.label.includes('Use as /goal'),
      ),
    ).toBe(true);

    (component as any).handleSelection('goal');

    expect(onGoal).toHaveBeenCalledTimes(1);
  });

  it('renders the plan inside a border', () => {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      {} as any,
    );

    const rendered = component.render(80).join('\n');

    expect(rendered).toContain('╭');
    expect(rendered).toContain('Build the feature');
    expect(rendered).toContain('╰');
  });

  it('calls onReject directly when "Request changes" is selected (no feedback input)', () => {
    const onReject = vi.fn();
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject,
      },
      {} as any,
    );

    (component as any).handleSelection('changes');

    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('shows hint about sending revision feedback after rejection', () => {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      {} as any,
    );

    (component as any).handleReject();
    const rendered = component.render(80).join('\n');

    expect(rendered).toContain('Changes requested');
    expect(rendered).toContain('Send a message with your revision feedback');
  });

  it('keeps long plan lines within the rendered width on narrow terminals', () => {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: `Build ${'VeryLongPlanToken'.repeat(12)} safely`,
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      {} as any,
    );

    const width = 42;
    const lines = component.render(width);

    expect(lines.some(line => line.includes('VeryLongPlanToken'))).toBe(true);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
  });

  it('shows a diff when previousPlan is provided on resubmission', () => {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature\nAdd tests\nUpdate docs',
        previousPlan: 'Build the feature\nRun tests\nUpdate docs',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      {} as any,
    );

    const rendered = component.render(80).join('\n');

    expect(rendered).toContain('Changes from previous plan');
    // The diff should show removed and added lines
    expect(rendered).toContain('- Run tests');
    expect(rendered).toContain('+ Add tests');
  });

  it('shows full plan content when no previousPlan is provided', () => {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      {} as any,
    );

    const rendered = component.render(80).join('\n');

    expect(rendered).not.toContain('Changes from previous plan');
    expect(rendered).toContain('Build the feature');
  });

  it('has only 3 select options: approve, goal, changes', () => {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: 'tc-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      {} as any,
    );

    const selectList = (component as any).selectList;
    const values = selectList.items.map((item: { value: string }) => item.value);
    expect(values).toEqual(['approve', 'goal', 'changes']);
  });

  describe.each([
    ['PlanContentBox', () => new PlanContentBox('# Title\n\nSome plan body that wraps when narrow enough.')],
    ['PlanDiffBox', () => new PlanDiffBox('Build the feature\nRun tests', 'Build the feature\nAdd tests')],
  ])('%s render caching', (_name, create) => {
    it('returns the identical cached array on repeated renders at the same width', () => {
      const box = create();
      const first = box.render(80);
      const second = box.render(80);
      // Same reference proves no recompute happened (markdown lex + wrap skipped).
      expect(second).toBe(first);
    });

    it('recomputes when the width changes and re-caches at the new width', () => {
      const box = create();
      const wide = box.render(80);
      const narrow = box.render(42);
      expect(narrow).not.toBe(wide);
      for (const line of narrow) {
        expect(visibleWidth(line)).toBeLessThanOrEqual(42);
      }
      expect(box.render(42)).toBe(narrow);
      // Byte-identity contract: cached output equals a fresh instance's output.
      expect(narrow).toEqual(create().render(42));
      expect(box.render(80)).toEqual(create().render(80));
    });

    it('recomputes after invalidate()', () => {
      const box = create();
      const first = box.render(80);
      box.invalidate();
      const second = box.render(80);
      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    });

    it('recomputes when the theme changes', () => {
      const originalMode = getThemeMode();
      const box = create();
      const first = box.render(80);
      try {
        applyThemeMode(originalMode === 'dark' ? 'light' : 'dark');
        const second = box.render(80);
        expect(second).not.toBe(first);
      } finally {
        applyThemeMode(originalMode);
      }
    });
  });

  it('renders persisted requested changes below the plan', () => {
    const component = new PlanResultComponent({
      title: 'Ship it',
      plan: 'Build the feature',
      isApproved: false,
      feedback: 'Add verification steps',
    });

    const lines = component.render(80);
    const statusIndex = lines.findIndex(line => line.includes('Changes requested'));
    const planLineIndex = lines.findIndex(line => line.includes('Build the feature'));
    const feedbackLineIndex = lines.findIndex(line => line.includes('Requested changes: Add verification steps'));

    expect(statusIndex).toBeGreaterThan(-1);
    expect(planLineIndex).toBeGreaterThan(-1);
    expect(statusIndex).toBeGreaterThan(planLineIndex);
    expect(feedbackLineIndex).toBeGreaterThan(statusIndex);
  });
});
