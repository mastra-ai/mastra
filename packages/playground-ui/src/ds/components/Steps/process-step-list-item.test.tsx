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

describe('ProcessStepListItem', () => {
  it('renders the title it is given, not one derived from the id', () => {
    render(<ProcessStepListItem step={step} isActive position={2} />);

    expect(screen.getByRole('heading', { name: 'Cloning repository' })).toBeTruthy();
    expect(screen.queryByText('Clone repo')).toBeNull();
  });

  const markerOf = (title: string) =>
    screen.getByRole('heading', { name: title }).closest('.rounded-lg')?.lastElementChild as HTMLElement | null;
  const numberOf = (title: string) =>
    screen.getByRole('heading', { name: title }).closest('.min-w-0')?.previousElementSibling as HTMLElement | null;

  it('numbers the step in the order it was given', () => {
    render(<ProcessStepListItem step={step} isActive position={3} />);

    expect(numberOf('Cloning repository')?.textContent).toBe('3.');
  });

  it('draws a dashed ring for a step that has not started', () => {
    render(<ProcessStepListItem step={{ ...step, status: 'pending' }} isActive={false} position={1} />);

    // The default marker outlines itself; there is no icon to show yet.
    expect(markerOf('Cloning repository')?.classList.contains('border-dashed')).toBe(true);
    expect(markerOf('Cloning repository')?.querySelector('svg')).toBeNull();
  });

  it('draws the plain pending marker as a dashed ring of its own', () => {
    render(<ProcessStepListItem step={{ ...step, status: 'pending' }} isActive={false} position={1} variant="plain" />);

    const circle = markerOf('Cloning repository')?.querySelector('circle');
    expect(circle?.getAttribute('stroke-dasharray')).toBe('3 3');
  });

  it.each(['success', 'failed'])('scales a %s marker', status => {
    render(<ProcessStepListItem step={{ ...step, status }} isActive={false} position={1} />);

    expect(markerOf('Cloning repository')?.classList.contains('scale-110')).toBe(true);
  });

  it.each(['running', 'pending'])('leaves a %s marker unscaled', status => {
    render(<ProcessStepListItem step={{ ...step, status }} isActive={false} position={1} />);

    expect(markerOf('Cloning repository')?.classList.contains('scale-110')).toBe(false);
  });

  it('lets a running marker keep the spinner at its own size', () => {
    render(<ProcessStepListItem step={step} isActive position={1} />);
    expect(markerOf('Cloning repository')?.classList.contains('[&>svg]:size-4')).toBe(false);

    cleanup();

    render(<ProcessStepListItem step={{ ...step, status: 'success' }} isActive position={1} />);
    expect(markerOf('Cloning repository')?.classList.contains('[&>svg]:size-4')).toBe(true);
  });

  it('drops the description when the step has none', () => {
    render(<ProcessStepListItem step={{ ...step, description: '' }} isActive position={1} />);

    expect(screen.queryByText('Fetching updates…')).toBeNull();
  });

  it('truncates the description only in the plain variant', () => {
    render(<ProcessStepListItem step={step} isActive position={1} />);
    expect(screen.getByText('Fetching updates…').classList.contains('truncate')).toBe(false);

    cleanup();

    render(<ProcessStepListItem step={step} isActive position={1} variant="plain" />);
    expect(screen.getByText('Fetching updates…').classList.contains('truncate')).toBe(true);
  });

  it('shows the status icon rather than the waiting ring once a plain step has started', () => {
    render(<ProcessStepListItem step={{ ...step, status: 'success' }} isActive={false} position={1} variant="plain" />);

    const marker = markerOf('Cloning repository');
    expect(marker?.querySelector('svg')).toBeTruthy();
    expect(marker?.querySelector('circle[stroke-dasharray]')).toBeNull();
  });

  it('outlines only the not-yet-started default marker', () => {
    render(<ProcessStepListItem step={{ ...step, status: 'running' }} isActive position={1} />);

    expect(markerOf('Cloning repository')?.classList.contains('border-dashed')).toBe(false);
  });

  it('ignores the deprecated stepId', () => {
    render(<ProcessStepListItem step={step} stepId="something-else" isActive position={1} />);

    expect(screen.getByRole('heading', { name: 'Cloning repository' })).toBeTruthy();
    expect(screen.queryByText('something-else')).toBeNull();
  });
});
