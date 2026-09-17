import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ComposerModelSettingsView } from '../src/domains/agents/components/composer-model-settings-view';
import type { ComposerModelSettingsViewProps } from '../src/domains/agents/components/composer-model-settings-view';

function SettingsExample(props: ComposerModelSettingsViewProps) {
  const [value, setValue] = useState(props.value);
  return (
    <ComposerModelSettingsView
      {...props}
      value={value}
      onChange={setValue}
      onReset={() => {
        setValue({});
      }}
    />
  );
}
const meta = {
  title: 'Applications/Studio/Model settings',
  component: ComposerModelSettingsView,
  render: props => <SettingsExample {...props} />,
  args: {
    value: {},
    onChange: fn(),
    onReset: fn(),
  },
} satisfies Meta<typeof ComposerModelSettingsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const ReadOnly: Story = { args: { canEdit: false } };
export const SamplingRestriction: Story = {
  args: {
    value: { temperature: 0.5 },
    samplingNotice: 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.',
  },
};
export const AdvancedOptions: Story = {
  args: { value: { seed: 0, maxRetries: 0 } },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Model settings' }));
    await expect(screen.getByRole('slider', { name: 'Temperature' })).toBeEnabled();
    await expect(screen.getByRole('slider', { name: 'Top P' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Advanced Settings' }));
    await expect(screen.getByRole('spinbutton', { name: 'Seed' })).toHaveValue(0);
    await expect(screen.getByRole('spinbutton', { name: 'Max Retries' })).toHaveValue(0);
    const editor = screen.getByRole('textbox', { name: 'Provider Options' });
    const selectAll = navigator.platform.startsWith('Mac') ? '{Meta>}a{/Meta}' : '{Control>}a{/Control}';
    await userEvent.click(editor);
    await userEvent.keyboard(selectAll);
    await userEvent.paste('[]');
    await userEvent.click(screen.getByRole('button', { name: 'Save Provider Options' }));
    await expect(screen.getByRole('alert')).toHaveTextContent('Provider options must be an object of provider objects');
    await userEvent.click(editor);
    await userEvent.keyboard(selectAll);
    await userEvent.paste('{"openai":{"reasoningEffort":"low"}}');
    await userEvent.click(screen.getByRole('button', { name: 'Save Provider Options' }));
    await expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
};
