import type { Meta, StoryObj } from '@storybook/react-vite';
import { ButtonsGroup } from './buttons-group';
import { Button } from '../Button';
import { ChevronDown, ChevronDownIcon } from 'lucide-react';

const meta: Meta<typeof ButtonsGroup> = {
  title: 'Composite/ButtonsGroup',
  component: ButtonsGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ButtonsGroup>;

export const Default: Story = {
  render: () => (
    <ButtonsGroup>
      <Button size="default" variant="standard">
        Button 1
      </Button>
      <Button size="default" variant="standard">
        Button 2
      </Button>
      <Button size="default" variant="standard">
        Button 3
      </Button>
    </ButtonsGroup>
  ),
};

export const DefaultSpacing: Story = {
  render: () => (
    <ButtonsGroup>
      <Button size="default" variant="standard">
        Cancel
      </Button>
      <Button size="default" variant="standard">
        Save
      </Button>
    </ButtonsGroup>
  ),
};

export const CloseSpacing: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button size="default" variant="standard">
        Cancel
      </Button>
      <Button size="default" variant="standard">
        Save
      </Button>
    </ButtonsGroup>
  ),
};

export const AsSplitButton: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button size="default" variant="standard">
        Cancel
      </Button>
      <Button size="default" variant="standard" aria-label="Open Menu">
        <ChevronDownIcon />
      </Button>
    </ButtonsGroup>
  ),
};
