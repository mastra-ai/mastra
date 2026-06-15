// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowConditionCardView, WorkflowStepCardView } from '../index';
import type { WorkflowCardCondition } from '../index';

afterEach(() => cleanup());

describe('workflow card UI components', () => {
  it('renders a step card shell with icon indicators, timer, description, and an action slot', () => {
    render(
      <WorkflowStepCardView
        label="map-step"
        description="Map the previous output"
        displayStatus="success"
        hasStep
        mapConfig="return input"
        startedAt={1000}
        endedAt={1123}
        actionBar={<button type="button">Map config</button>}
      />,
    );

    const card = screen.getByTestId('workflow-default-node');
    expect(card.getAttribute('data-workflow-step-status')).toBe('success');
    expect(screen.getByText('map-step')).not.toBeNull();
    expect(screen.getByText('map-step').getAttribute('title')).toBe('map-step');
    expect(screen.getByText('Map the previous output')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Map step' })).not.toBeNull();
    expect(screen.queryByText('MAP')).toBeNull();
    expect(card.querySelector('[data-testid="workflow-card-progress-indicator"]')).toBeNull();
    expect(screen.getByText('123ms').className).toContain('font-mono');
    expect(screen.getByRole('button', { name: 'Map config' })).not.toBeNull();
  });

  it('renders foreach progress and sleep details without workflow providers', () => {
    render(
      <WorkflowStepCardView
        label="foreach-step"
        displayStatus="running"
        hasStep
        isForEach
        duration={1250}
        foreachProgress={{
          completedCount: 2,
          totalCount: 4,
          currentIndex: 2,
          iterationStatus: 'success',
        }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Sleep step' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Foreach step' })).not.toBeNull();
    expect(screen.queryByText('FOREACH')).toBeNull();
    expect(screen.queryByText('SLEEP')).toBeNull();
    expect(screen.getByText('2 / 4')).not.toBeNull();
    expect(screen.getByText('sleeps for')).not.toBeNull();
    expect(screen.getByText('1250ms')).not.toBeNull();
  });

  it('renders a controlled condition card and delegates code clicks', () => {
    const condition: WorkflowCardCondition = { type: 'when', fnString: 'input.value > 0' };
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const onOpenDialogChange = vi.fn<(open: boolean) => void>();
    const onConditionClick = vi.fn<(condition: WorkflowCardCondition) => void>();

    render(
      <WorkflowConditionCardView
        type="when"
        conditions={[condition]}
        previousDisplayStatus="success"
        hasNextStep
        isOpen
        onOpenChange={onOpenChange}
        openDialog={false}
        onOpenDialogChange={onOpenDialogChange}
        onConditionClick={onConditionClick}
        actionBar={<button type="button">Input</button>}
      />,
    );

    const card = screen.getByTestId('workflow-condition-node');
    expect(card.getAttribute('data-workflow-step-status')).toBe('success');
    expect(screen.getByRole('img', { name: 'When condition' })).not.toBeNull();
    expect(screen.queryByText('WHEN')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Collapse condition' })
        .compareDocumentPosition(screen.getByRole('img', { name: 'When condition' })) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(card.querySelector('[data-testid="workflow-card-progress-indicator"]')).toBeNull();
    expect(card.textContent).toContain('input.value > 0');
    expect(screen.getByRole('button', { name: 'Input' })).not.toBeNull();

    const codeBlock = card.querySelector('pre');
    expect(codeBlock).not.toBeNull();
    fireEvent.click(codeBlock!);

    expect(onConditionClick).toHaveBeenCalledTimes(1);
    expect(onConditionClick).toHaveBeenCalledWith(condition);
  });
});
