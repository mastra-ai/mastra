// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ProcessStepListItem } from './process-step-list-item';
import type { ProcessStep } from './shared';

afterEach(() => {
  cleanup();
});

const step: ProcessStep = {
  id: 'clone-repo',
  status: 'running',
  title: 'Cloning repository',
  description: 'Fetching updates…',
  isActive: true,
};

const cardOf = (title: string) => screen.getByRole('heading', { name: title }).closest('.rounded-lg');

describe('ProcessStepListItem', () => {
  it('renders the title it is given, not one derived from the id', () => {
    render(<ProcessStepListItem step={step} isActive position={2} />);

    expect(screen.getByRole('heading', { name: 'Cloning repository' })).toBeTruthy();
    expect(screen.queryByText('Clone repo')).toBeNull();
  });

  it('leaves the active step without a card surface in the plain variant', () => {
    render(<ProcessStepListItem step={step} isActive position={2} />);
    expect(cardOf('Cloning repository')?.classList.contains('bg-surface3')).toBe(true);

    cleanup();

    render(<ProcessStepListItem step={step} isActive position={2} variant="plain" />);
    expect(cardOf('Cloning repository')?.classList.contains('bg-surface3')).toBe(false);
  });

  it('drops the filled disc and its glow from a completed marker in the plain variant', () => {
    const completed: ProcessStep = { ...step, status: 'success', isActive: false };

    render(<ProcessStepListItem step={completed} isActive={false} position={2} />);
    expect(document.querySelector('.bg-accent1Dark.shadow-glow-accent1')).toBeTruthy();

    cleanup();

    render(<ProcessStepListItem step={completed} isActive={false} position={2} variant="plain" />);
    expect(document.querySelector('.bg-accent1Dark')).toBeNull();
    expect(document.querySelector('.shadow-glow-accent1')).toBeNull();
  });
});
