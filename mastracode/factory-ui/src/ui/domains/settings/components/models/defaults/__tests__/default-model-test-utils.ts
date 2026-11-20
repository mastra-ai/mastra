import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

export async function openPicker(user: UserEvent, pickerName: string) {
  const picker = await screen.findByRole('button', { name: pickerName });
  await waitFor(() => expect(picker).toBeEnabled());
  await user.click(picker);
  await screen.findByPlaceholderText('Search models');
  return picker;
}

export async function findModelOption(modelId: string) {
  return waitFor(() => {
    const option = screen.getAllByRole('option').find(candidate => candidate.getAttribute('data-value') === modelId);
    if (!option) throw new Error(`No option for ${modelId}`);
    return option;
  });
}

export async function pickModel(user: UserEvent, pickerName: string, modelId: string) {
  const picker = await openPicker(user, pickerName);
  await user.click(await findModelOption(modelId));
  return picker;
}
