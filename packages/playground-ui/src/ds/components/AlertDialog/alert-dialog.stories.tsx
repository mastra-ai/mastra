import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertDialog } from './alert-dialog';
import { Button } from '../Button';

const meta: Meta<typeof AlertDialog> = {
  title: 'Feedback/AlertDialog',
  component: AlertDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AlertDialog>;

export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialog.Trigger asChild>
        <Button>Open Alert Dialog</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Are you sure?</AlertDialog.Title>
          <AlertDialog.Description>
            This action cannot be undone. This will permanently delete your account and remove your data from our
            servers.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action>Continue</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  ),
};

export const DeleteConfirmation: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialog.Trigger asChild>
        <Button variant="outline">Delete Item</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete this item?</AlertDialog.Title>
          <AlertDialog.Description>
            This will permanently delete the selected item. You cannot undo this action.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Keep Item</AlertDialog.Cancel>
          <AlertDialog.Action>Delete</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  ),
};

export const LogoutConfirmation: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialog.Trigger asChild>
        <Button variant="ghost">Log out</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Log out of your account?</AlertDialog.Title>
          <AlertDialog.Description>You will need to sign in again to access your data.</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Stay signed in</AlertDialog.Cancel>
          <AlertDialog.Action>Log out</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  ),
};

export const DiscardChanges: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialog.Trigger asChild>
        <Button variant="outline">Discard changes</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Discard unsaved changes?</AlertDialog.Title>
          <AlertDialog.Description>
            You have unsaved changes that will be lost. Are you sure you want to discard them?
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
          <AlertDialog.Action>Discard</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  ),
};
