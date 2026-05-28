import { describe, expect, it, vi } from 'vitest';

import { PlanApprovalInlineComponent, PlanResultComponent } from '../plan-approval-inline.js';

describe('PlanApprovalInlineComponent', () => {
  it('includes a goal option and calls onGoal when selected', () => {
    const onGoal = vi.fn();
    const component = new PlanApprovalInlineComponent(
      {
        planId: 'plan-1',
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
        planId: 'plan-1',
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

  it('forces a full redraw when entering feedback mode', () => {
    const ui = { requestRender: vi.fn() };
    const component = new PlanApprovalInlineComponent(
      {
        planId: 'plan-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject: vi.fn(),
      },
      ui as any,
    );

    (component as any).handleSelection('edit');
    component.handleInput('a');
    const rendered = component.render(80).join('\n');

    expect(ui.requestRender).toHaveBeenCalledWith(true);
    expect(rendered).toContain('Provide feedback for revision:');
    expect(rendered).toContain('a');
  });

  it('renders requested changes below the plan after feedback is submitted', () => {
    const onReject = vi.fn();
    const component = new PlanApprovalInlineComponent(
      {
        planId: 'plan-1',
        title: 'Ship it',
        plan: 'Build the feature',
        onApprove: vi.fn(),
        onGoal: vi.fn(),
        onReject,
      },
      {} as any,
    );

    (component as any).handleReject('Add verification steps');
    const lines = component.render(80);
    const planLineIndex = lines.findIndex(line => line.includes('Build the feature'));
    const feedbackLineIndex = lines.findIndex(line => line.includes('Requested changes: Add verification steps'));

    expect(onReject).toHaveBeenCalledWith('Add verification steps');
    expect(planLineIndex).toBeGreaterThan(-1);
    expect(feedbackLineIndex).toBeGreaterThan(planLineIndex);
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
