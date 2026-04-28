import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown, ChevronDownIcon } from 'lucide-react';
import { Button } from '../Button';
import { ButtonsGroup } from './buttons-group';

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
      <Button>Button 1</Button>
      <Button>Button 2</Button>
      <Button>Button 3</Button>
    </ButtonsGroup>
  ),
};

export const DefaultSpacing: Story = {
  render: () => (
    <ButtonsGroup>
      <Button>Cancel</Button>
      <Button>Save</Button>
    </ButtonsGroup>
  ),
};

export const CloseSpacing: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button>Cancel</Button>
      <Button>Save</Button>
    </ButtonsGroup>
  ),
};

export const AsSplitButton: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button>Cancel</Button>
      <Button aria-label="Open Menu">
        <ChevronDownIcon />
      </Button>
    </ButtonsGroup>
  ),
};
