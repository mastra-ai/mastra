import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDownIcon, CopyIcon, ScissorsIcon, ClipboardIcon } from 'lucide-react';
import { Button } from '../Button';
import { ButtonsGroup, ButtonsGroupSeparator, ButtonsGroupText } from './buttons-group';

const meta: Meta<typeof ButtonsGroup> = {
  title: 'Composite/ButtonsGroup',
  component: ButtonsGroup,
  parameters: {
    layout: 'centered',
  },
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

export const Vertical: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical">
      <Button>Top</Button>
      <Button>Middle</Button>
      <Button>Bottom</Button>
    </ButtonsGroup>
  ),
};

export const VerticalCloseSpacing: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical" spacing="close">
      <Button variant="outline">
        <CopyIcon />
        Copy
      </Button>
      <Button variant="outline">
        <ScissorsIcon />
        Cut
      </Button>
      <Button variant="outline">
        <ClipboardIcon />
        Paste
      </Button>
    </ButtonsGroup>
  ),
};

export const WithSeparator: Story = {
  render: () => (
    <ButtonsGroup>
      <Button variant="ghost">
        <CopyIcon />
        Copy
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ScissorsIcon />
        Cut
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ClipboardIcon />
        Paste
      </Button>
    </ButtonsGroup>
  ),
};

export const VerticalWithSeparator: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical">
      <Button variant="ghost">
        <CopyIcon />
        Copy
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ScissorsIcon />
        Cut
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ClipboardIcon />
        Paste
      </Button>
    </ButtonsGroup>
  ),
};

export const WithText: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button variant="outline">−</Button>
      <ButtonsGroupText>42</ButtonsGroupText>
      <Button variant="outline">+</Button>
    </ButtonsGroup>
  ),
};
