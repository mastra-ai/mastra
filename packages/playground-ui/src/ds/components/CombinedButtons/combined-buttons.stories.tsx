import type { Meta, StoryObj } from '@storybook/react-vite';
import { CombinedButtons } from './combined-buttons';
import { Button } from '../Button';
import { ChevronDown, Plus, Settings, Trash } from 'lucide-react';

const meta: Meta<typeof CombinedButtons> = {
  title: 'Composite/CombinedButtons',
  component: CombinedButtons,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CombinedButtons>;

export const Default: Story = {
  render: () => (
    <CombinedButtons>
      <Button>Action</Button>
      <Button>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </CombinedButtons>
  ),
};

export const ThreeButtons: Story = {
  render: () => (
    <CombinedButtons>
      <Button>Edit</Button>
      <Button>Copy</Button>
      <Button>Delete</Button>
    </CombinedButtons>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <CombinedButtons>
      <Button>
        <Plus className="h-4 w-4" />
        Add
      </Button>
      <Button>
        <Settings className="h-4 w-4" />
      </Button>
    </CombinedButtons>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <CombinedButtons>
      <Button>
        <Plus className="h-4 w-4" />
      </Button>
      <Button>
        <Settings className="h-4 w-4" />
      </Button>
      <Button>
        <Trash className="h-4 w-4" />
      </Button>
    </CombinedButtons>
  ),
};

export const SplitButton: Story = {
  render: () => (
    <CombinedButtons>
      <Button variant="light">Save draft</Button>
      <Button variant="light">
        <ChevronDown className="h-4 w-4" />
      </Button>
    </CombinedButtons>
  ),
};
