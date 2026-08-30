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

  const markerOf = (title: string) =>
    screen.getByRole('heading', { name: title }).closest('.rounded-lg')?.lastElementChild as HTMLElement | null;
  const numberOf = (title: string) =>
    screen.getByRole('heading', { name: title }).closest('.min-w-0')?.previousElementSibling as HTMLElement | null;

  it('numbers the step in the order it was given', () => {
    render(<ProcessStepListItem step={step} isActive position={3} />);

    expect(numberOf('Cloning repository')?.textContent).toBe('3.');
  });

  it.each([
    ['the active step', { isActive: true, status: 'running' }, 'text-neutral5'],
    ['a finished step', { isActive: false, status: 'success' }, 'text-neutral5'],
    ['a step still waiting its turn', { isActive: false, status: 'pending' }, 'text-neutral3'],
    ['a step that failed', { isActive: false, status: 'failed' }, 'text-neutral3'],
  ])('reads %s at the right weight', (_, { isActive, status }, expected) => {
    render(<ProcessStepListItem step={{ ...step, status }} isActive={isActive} position={1} />);

    const heading = screen.getByRole('heading', { name: 'Cloning repository' });
    expect(heading.classList.contains(expected)).toBe(true);
    expect(numberOf('Cloning repository')?.classList.contains(expected)).toBe(true);
  });

  it('leaves an inactive step without the card surface', () => {
    render(<ProcessStepListItem step={step} isActive={false} position={1} />);

    expect(cardOf('Cloning repository')?.classList.contains('bg-surface3')).toBe(false);
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

  it.each([
    ['success', 'bg-accent1Dark', 'bg-accent2Dark'],
    ['failed', 'bg-accent2Dark', 'bg-accent1Dark'],
  ])('gives a %s marker its own fill, not the other one', (status, ownFill, otherFill) => {
    render(<ProcessStepListItem step={{ ...step, status }} isActive={false} position={1} />);

    const marker = markerOf('Cloning repository');
    expect(marker?.classList.contains(ownFill)).toBe(true);
    expect(marker?.classList.contains(otherFill)).toBe(false);
    expect(marker?.classList.contains('scale-110')).toBe(true);
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

  it.each([
    ['success', '[&>svg]:text-positive1'],
    ['failed', '[&>svg]:text-negative1'],
  ])('tints a plain %s marker on the icon itself', (status, tint) => {
    render(<ProcessStepListItem step={{ ...step, status }} isActive={false} position={1} variant="plain" />);
    expect(markerOf('Cloning repository')?.classList.contains(tint)).toBe(true);

    cleanup();

    // A step still under way carries no outcome color yet.
    render(<ProcessStepListItem step={{ ...step, status: 'running' }} isActive position={1} variant="plain" />);
    expect(markerOf('Cloning repository')?.classList.contains(tint)).toBe(false);
  });

  it.each([
    ['success', '[&>svg]:text-notice-success-fg'],
    ['failed', '[&>svg]:text-notice-destructive-fg'],
  ])('tints a default %s marker on the icon itself', (status, tint) => {
    render(<ProcessStepListItem step={{ ...step, status }} isActive={false} position={1} />);
    expect(markerOf('Cloning repository')?.classList.contains(tint)).toBe(true);

    cleanup();

    render(<ProcessStepListItem step={{ ...step, status: 'running' }} isActive position={1} />);
    expect(markerOf('Cloning repository')?.classList.contains(tint)).toBe(false);
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

  it('leaves a running default marker unfilled and unglowing', () => {
    render(<ProcessStepListItem step={{ ...step, status: 'running' }} isActive position={1} />);

    const marker = markerOf('Cloning repository');
    expect(marker?.classList.contains('bg-accent1Dark')).toBe(false);
    expect(marker?.classList.contains('shadow-glow-accent1')).toBe(false);
  });

  it('reserves border space for the card only in the default variant', () => {
    render(<ProcessStepListItem step={step} isActive={false} position={1} />);
    // The transparent border keeps the row from shifting when it becomes active.
    expect(cardOf('Cloning repository')?.classList.contains('border-transparent')).toBe(true);

    cleanup();

    render(<ProcessStepListItem step={step} isActive={false} position={1} variant="plain" />);
    expect(cardOf('Cloning repository')?.classList.contains('border-transparent')).toBe(false);
  });

  it('ignores the deprecated stepId', () => {
    render(<ProcessStepListItem step={step} stepId="something-else" isActive position={1} />);

    expect(screen.getByRole('heading', { name: 'Cloning repository' })).toBeTruthy();
    expect(screen.queryByText('something-else')).toBeNull();
  });
});
