import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, FileInputIcon, HashIcon, ListTreeIcon, PencilIcon, TagIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '../../icons/Icon';
import { Button } from '../Button';
import { Section } from '../Section';
import { TextAndIcon } from '../Text';
import { SideDialog } from './side-dialog';

const meta: Meta<typeof SideDialog> = {
  title: 'Layout/SideDialog',
  component: SideDialog,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SideDialog>;

const items = [
  { id: 'item_a1b2c3', name: 'Refund request', tokens: 412 },
  { id: 'item_d4e5f6', name: 'Order status lookup', tokens: 287 },
  { id: 'item_g7h8i9', name: 'Subscription upgrade', tokens: 533 },
];

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 text-ui-md">
    <span className="text-neutral3">{label}</span>
    <span className="text-neutral5">{value}</span>
  </div>
);

/**
 * Mirrors real usage: `Top` holds a breadcrumb (`TextAndIcon`), `Nav`, and trailing
 * actions; `Header` lives inside `Content` alongside the body sections.
 */
const DetailDialogDemo = ({ level = 1 }: { level?: 1 | 2 | 3 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const item = items[index];

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>Open Side Dialog</Button>
      <SideDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dialogTitle="Dataset Item"
        dialogDescription={`Item: ${item.id}`}
        level={level}
      >
        <SideDialog.Top>
          <TextAndIcon>
            <HashIcon /> {item.id}
          </TextAndIcon>
          |
          <SideDialog.Nav
            onPrevious={index > 0 ? () => setIndex(index - 1) : undefined}
            onNext={index < items.length - 1 ? () => setIndex(index + 1) : undefined}
          />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Icon>
                <PencilIcon />
              </Icon>
              Edit
            </Button>
            <Button variant="outline" size="sm">
              <Icon>
                <Trash2Icon />
              </Icon>
              Delete
            </Button>
          </div>
        </SideDialog.Top>

        <SideDialog.Content>
          <SideDialog.Header>
            <SideDialog.Heading>
              <EyeIcon /> {item.name}
            </SideDialog.Heading>
            <TextAndIcon>
              <HashIcon /> {item.id}
            </TextAndIcon>
          </SideDialog.Header>

          <Section>
            <Section.Header>
              <Section.Heading>
                <FileInputIcon /> Overview
              </Section.Heading>
            </Section.Header>
            <div className="grid gap-2">
              <Field label="Name" value={item.name} />
              <Field label="Tokens used" value={String(item.tokens)} />
              <Field label="Status" value="Success" />
            </div>
          </Section>

          <Section>
            <Section.Header>
              <Section.Heading>
                <TagIcon /> Metadata
              </Section.Heading>
            </Section.Header>
            <div className="grid gap-2">
              <Field label="Source" value="production" />
              <Field label="Created" value="May 21, 2026" />
            </div>
          </Section>
        </SideDialog.Content>
      </SideDialog>
    </div>
  );
};

export const Default: Story = {
  render: () => <DetailDialogDemo />,
};

export const Level2: Story = {
  render: () => <DetailDialogDemo level={2} />,
};

export const Level3: Story = {
  render: () => <DetailDialogDemo level={3} />,
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
          <TextAndIcon>
            <HashIcon /> customer-support
          </TextAndIcon>
        </SideDialog.Top>

        <SideDialog.Content>
          <SideDialog.Header>
            <SideDialog.Heading>
              <ListTreeIcon /> Customer Support Agent
            </SideDialog.Heading>
          </SideDialog.Header>

          <Section>
            <Section.Header>
              <Section.Heading>Configuration</Section.Heading>
            </Section.Header>
            <div className="grid gap-2">
              <Field label="Model" value="GPT-4" />
              <Field label="Temperature" value="0.7" />
            </div>
          </Section>

          <SideDialog.CodeSection
            title="Agent Configuration"
            codeStr={`{
  "name": "customer-support",
  "model": "gpt-4",
  "temperature": 0.7
}`}
          />
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-ui-lg font-medium text-neutral6 mb-2">Confirm deletion?</h3>
            <p className="text-ui-md text-neutral3 mb-6">
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
