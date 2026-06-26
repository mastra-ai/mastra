import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { PlanApprovalInlineComponent, PlanResultComponent } from '../plan-approval-inline.js';

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
