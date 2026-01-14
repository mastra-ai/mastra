import type { Meta, StoryObj } from '@storybook/react-vite';
import { SideDialog } from './side-dialog';
import { Button } from '../Button';
import { useState } from 'react';

const meta: Meta<typeof SideDialog> = {
  title: 'Layout/SideDialog',
  component: SideDialog,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SideDialog>;

const SideDialogDemo = ({
  variant = 'default',
  level = 1,
}: {
  variant?: 'default' | 'confirmation';
  level?: 1 | 2 | 3;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>Open Side Dialog</Button>
      <SideDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dialogTitle="Dialog Title"
        dialogDescription="Dialog description"
        variant={variant}
        level={level}
      >
        <SideDialog.Top>
          <SideDialog.Header>
            <SideDialog.Heading>Side Dialog</SideDialog.Heading>
          </SideDialog.Header>
          <SideDialog.Nav onNext={() => console.log('Next')} onPrevious={() => console.log('Previous')} />
        </SideDialog.Top>
        <SideDialog.Content>
          <div className="p-6">
            <p className="text-icon5">This is the side dialog content area.</p>
            <p className="text-icon3 mt-2">You can put any content here.</p>
          </div>
        </SideDialog.Content>
      </SideDialog>
    </div>
  );
};

export const Default: Story = {
  render: () => <SideDialogDemo />,
};

export const Level2: Story = {
  render: () => <SideDialogDemo level={2} />,
};

export const Level3: Story = {
  render: () => <SideDialogDemo level={3} />,
};

const SideDialogWithCodeDemo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>Open with Code Section</Button>
      <SideDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dialogTitle="Agent Details"
        dialogDescription="View agent configuration and code"
      >
        <SideDialog.Top>
          <SideDialog.Header>
            <SideDialog.Heading>Customer Support Agent</SideDialog.Heading>
          </SideDialog.Header>
        </SideDialog.Top>
        <SideDialog.Content>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-icon6 mb-2">Configuration</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-icon3">Model</span>
                  <span className="text-icon5">GPT-4</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-icon3">Temperature</span>
                  <span className="text-icon5">0.7</span>
                </div>
              </div>
            </div>
            <SideDialog.CodeSection
              title="Agent Configuration"
              codeStr={`{
  "name": "customer-support",
  "model": "gpt-4",
  "temperature": 0.7
}`}
            />
          </div>
        </SideDialog.Content>
      </SideDialog>
    </div>
  );
};

export const WithCodeSection: Story = {
  render: () => <SideDialogWithCodeDemo />,
};

const ConfirmationDialogDemo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>Open Confirmation</Button>
      <SideDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dialogTitle="Confirm Action"
        dialogDescription="Please confirm your action"
        variant="confirmation"
      >
        <SideDialog.Content>
          <div className="p-6 flex flex-col items-center justify-center h-full">
            <h3 className="text-lg font-medium text-icon6 mb-2">Confirm deletion?</h3>
            <p className="text-sm text-icon3 mb-6 text-center">
              This action cannot be undone. The agent will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsOpen(false)}>Delete</Button>
            </div>
          </div>
        </SideDialog.Content>
      </SideDialog>
    </div>
  );
};

export const Confirmation: Story = {
  render: () => <ConfirmationDialogDemo />,
};
