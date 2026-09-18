import { fireEvent, within } from '@testing-library/react';

const sideColumn = (container?: HTMLElement) => {
  const root = container ?? document.body;
  const column = root.querySelector('[data-trace-side-column]');
  if (!column) throw new Error('trace side column not found');
  return column as HTMLElement;
};

/** Picks a view (Messages / Feedback / Scores) in the trace panel's side column tabs. */
export const pickTraceSideView = async (name: RegExp, container?: HTMLElement) => {
  fireEvent.click(within(sideColumn(container)).getByRole('tab', { name }));
};

/** Accessible name of the currently selected side column view. */
export const traceSideViewLabel = (container?: HTMLElement) =>
  within(sideColumn(container))
    .getAllByRole('tab')
    .find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent ?? '';
