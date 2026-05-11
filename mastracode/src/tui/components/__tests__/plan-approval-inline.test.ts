import { describe, expect, it, vi } from 'vitest';

import { PlanApprovalInlineComponent } from '../plan-approval-inline.js';

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
});
