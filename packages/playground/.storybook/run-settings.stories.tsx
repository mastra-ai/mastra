import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ComposerModelSettingsView as ModelSettings } from '../src/domains/agents/components/composer-model-settings-view';
import { ComposerRunSettings } from '../src/domains/agents/components/composer-run-settings';
import type { ModelSettingsMethod } from '../src/domains/agents/components/composer-run-settings';
import type { ModelSettings as ModelSettingsValues } from '../src/types';

const methods: ModelSettingsMethod[] = [
  { value: 'generate', label: 'Generate' },
  { value: 'streamSubscription', label: 'Stream subscription (default)' },
  { value: 'stream', label: 'Stream' },
  {
    value: 'network',
    label: 'Network',
    unavailable: 'Network is not available. Please make sure you have at least one sub-agent.',
  },
];

function RunSettingsExample({ legacy = false, canEdit = true }: { legacy?: boolean; canEdit?: boolean }) {
  const initialMethod = legacy ? 'streamLegacy' : 'streamSubscription';
  const [method, setMethod] = useState(initialMethod);
  const [requireToolApproval, setRequireToolApproval] = useState(false);
  const [settings, setSettings] = useState<ModelSettingsValues>({});
  return (
    <ModelSettings
      value={settings}
      onChange={setSettings}
      canEdit={canEdit}
      onReset={() => {
        setSettings({});
        setMethod(initialMethod);
        setRequireToolApproval(false);
      }}
    >
      <ComposerRunSettings
        method={method}
        onMethodChange={setMethod}
        requireToolApproval={requireToolApproval}
        onToolApprovalChange={setRequireToolApproval}
        canEdit={canEdit}
        methods={
          legacy
            ? [
                { value: 'generateLegacy', label: 'Generate (Legacy)' },
                { value: 'streamLegacy', label: 'Stream (Legacy)' },
              ]
            : methods
        }
      />
    </ModelSettings>
  );
}

const meta = { title: 'Applications/Studio/Run settings', component: RunSettingsExample } satisfies Meta<
  typeof RunSettingsExample
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Model settings' }));
    await expect(screen.getByRole('radio', { name: 'Network' })).toHaveAttribute('aria-disabled', 'true');
    await expect(screen.getByRole('radio', { name: 'Network' })).toHaveAccessibleDescription(
      'Network is not available. Please make sure you have at least one sub-agent.',
    );
    await waitFor(() =>
      expect(
        screen.getByText('Network is not available. Please make sure you have at least one sub-agent.'),
      ).toBeVisible(),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Network' }));
    await expect(screen.getByRole('radio', { name: 'Stream subscription (default)' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Generate' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Require Tool Approval' }));
    await expect(screen.getByRole('radio', { name: 'Generate' })).toBeChecked();
    await expect(screen.getByRole('checkbox', { name: 'Require Tool Approval' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await expect(screen.getByRole('radio', { name: 'Stream subscription (default)' })).toBeChecked();
    await expect(screen.getByRole('checkbox', { name: 'Require Tool Approval' })).not.toBeChecked();
  },
};
export const LegacyMethods: Story = { args: { legacy: true } };
export const ReadOnly: Story = { args: { canEdit: false } };
