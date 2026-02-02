import type { Meta, StoryObj } from '@storybook/react-vite';
import { ButtonsGroup } from './buttons-group';
import { Button } from '../Button';

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

export const TwoButtons: Story = {
  render: () => (
    <ButtonsGroup>
      <Button variant="outline">Cancel</Button>
      <Button>Save</Button>
    </ButtonsGroup>
  ),
};

export const ManyButtons: Story = {
  render: () => (
    <ButtonsGroup>
      <Button variant="ghost">Reset</Button>
      <Button variant="outline">Cancel</Button>
      <Button variant="light">Draft</Button>
      <Button>Submit</Button>
    </ButtonsGroup>
  ),
};

export const ActionButtons: Story = {
  render: () => (
    <ButtonsGroup>
      <Button variant="outline">Edit</Button>
      <Button variant="outline">Duplicate</Button>
      <Button>Run</Button>
    </ButtonsGroup>
  ),
};
