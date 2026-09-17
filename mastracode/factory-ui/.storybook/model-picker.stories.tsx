import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FactoryModelControls } from './fixtures/factory-model-controls';
const meta = { title: 'Applications/Factory/Model picker' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function PersonalPicker() {
  const [mode, setMode] = useState('build');
  return <FactoryModelControls personal mode={mode} onModeChange={setMode} state="ready" />;
}

export const WithPacks: Story = { render: () => <PersonalPicker /> };
