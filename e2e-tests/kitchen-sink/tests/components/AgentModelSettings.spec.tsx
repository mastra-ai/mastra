import { test, expect } from '@playwright/experimental-ct-react';
import { AgentModelSettings, AgentSettingsProvider } from '@mastra/playground-ui';
import React from 'react';

test('should work', async ({ mount }) => {
  const spy = async () => {};

  const component = await mount(
    <AgentSettingsProvider agentId="123">
      <AgentModelSettings onSave={spy} />
    </AgentSettingsProvider>,
  );

  // Check the form dirty-ness
  await expect(component.getByText('You have unsaved changes')).not.toBeVisible();
  await component.getByRole('radio', { name: 'Generate' }).click();
  await expect(component.getByText('You have unsaved changes')).toBeVisible();
  await component.getByRole('button', { name: 'Save' }).click();
  await expect(component.getByText('You have unsaved changes')).not.toBeVisible();
});
