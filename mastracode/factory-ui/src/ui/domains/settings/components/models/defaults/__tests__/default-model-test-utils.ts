import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

export async function pickModel(user: UserEvent, comboboxName: string, modelId: string) {
  const picker = await screen.findByRole('combobox', { name: comboboxName });
  await waitFor(() => expect(picker).toBeEnabled());
  await user.click(picker);
  const option = await screen.findByRole('option', { name: new RegExp(modelId.replace('/', '\\/')) });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  return picker;
}
