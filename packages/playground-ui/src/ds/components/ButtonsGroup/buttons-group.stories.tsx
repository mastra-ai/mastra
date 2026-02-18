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
      <Button size="default" variant="cta">
        Button 1
      </Button>
      <Button size="default" variant="cta">
        Button 2
      </Button>
      <Button size="default" variant="cta">
        Button 3
      </Button>
    </ButtonsGroup>
  ),
};

export const DefaultSpacing: Story = {
  render: () => (
    <ButtonsGroup>
      <Button size="default" variant="cta">
        Cancel
      </Button>
      <Button size="default" variant="cta">
        Save
      </Button>
    </ButtonsGroup>
  ),
};

export const CloseSpacing: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button size="default" variant="cta">
        Cancel
      </Button>
      <Button size="default" variant="cta">
        Save
      </Button>
    </ButtonsGroup>
  ),
};

export const AsSplitButton: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button size="default" variant="cta">
        Cancel
      </Button>
      <Button size="default" variant="cta" aria-label="Open Menu">
        <ChevronDownIcon />
      </Button>
    </ButtonsGroup>
  ),
};
