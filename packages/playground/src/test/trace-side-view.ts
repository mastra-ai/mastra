import { fireEvent, screen, within } from '@testing-library/react';

const switcher = (container?: HTMLElement) =>
  (container ? within(container) : screen).getByRole('combobox', { name: 'Side column view' });

/** Picks a view (Messages / Feedback / Scores) in the trace panel's side column dropdown. */
export const pickTraceSideView = async (name: RegExp, container?: HTMLElement) => {
  fireEvent.click(switcher(container));
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
};

/** Accessible name of the currently selected side column view. */
export const traceSideViewLabel = (container?: HTMLElement) => switcher(container).textContent ?? '';
