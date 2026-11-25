import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

export async function pickPackModel(user: UserEvent, pickerName: string, modelName: string, container?: HTMLElement) {
  const picker = await (container ? within(container) : screen).findByRole('button', { name: pickerName });
  await waitFor(() => expect(picker).toBeEnabled());
  await user.click(picker);
  await user.click(await screen.findByRole('option', { name: modelName }));
}
