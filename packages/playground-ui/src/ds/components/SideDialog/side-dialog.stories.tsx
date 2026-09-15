import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, FileInputIcon, HashIcon, ListTreeIcon, PencilIcon, TagIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    docs: {
      description: {
        component: [
          'Modal panel that slides in from the right edge: rendered in a Portal, with a backdrop,',
          'focus trap, and Escape / click-outside to close. Stacks via the `level` prop (1-3).',
          '',
          'Used for full-screen detail/edit flows — datasets, scorers, MCP clients, the agent',
          'Evaluate tab. For a non-modal panel embedded directly in the page layout (no overlay),',
          'see `Composite/DataPanel`, which is the pattern used by the observability trace views.',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SideDialog>;

const items = [
  { id: 'item_a1b2c3', name: 'Refund request', tokens: 412 },
  { id: 'item_d4e5f6', name: 'Order status lookup', tokens: 287 },
  { id: 'item_g7h8i9', name: 'Subscription upgrade', tokens: 533 },
];

const NESTED_LEVEL_OPEN_DELAY_MS = 220;

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="text-ui-md flex justify-between gap-4">
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

  if (!item) return null;

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

const NestedLevelsDemo = ({ depth }: { depth: 2 | 3 }) => {
  const [isLevel1Open, setIsLevel1Open] = useState(false);
  const [isLevel2Open, setIsLevel2Open] = useState(false);
  const [isLevel3Open, setIsLevel3Open] = useState(false);
  const openTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearOpenTimers = useCallback(() => {
    openTimers.current.forEach(clearTimeout);
    openTimers.current = [];
  }, []);

  useEffect(
    () => () => {
      clearOpenTimers();
    },
    [clearOpenTimers],
  );

  const openDepth = (depth: 2 | 3) => {
    clearOpenTimers();
    setIsLevel1Open(true);
    setIsLevel2Open(false);
    setIsLevel3Open(false);

    openTimers.current.push(setTimeout(() => setIsLevel2Open(true), NESTED_LEVEL_OPEN_DELAY_MS));

    if (depth === 3) {
      openTimers.current.push(setTimeout(() => setIsLevel3Open(true), NESTED_LEVEL_OPEN_DELAY_MS * 2));
    }
  };

  const closeLevel1 = () => {
    clearOpenTimers();
    setIsLevel1Open(false);
    setIsLevel2Open(false);
    setIsLevel3Open(false);
  };

  const closeLevel2 = () => {
    clearOpenTimers();
    setIsLevel2Open(false);
    setIsLevel3Open(false);
  };

  return (
    <div className="p-8">
      <div className="flex gap-2">
        <Button onClick={() => openDepth(2)}>Open Nested Level 2</Button>
        {depth === 3 && (
          <Button variant="outline" onClick={() => openDepth(3)}>
            Open Nested Level 3
          </Button>
        )}
      </div>

      <SideDialog
        isOpen={isLevel1Open}
        onClose={closeLevel1}
        dialogTitle="Dataset Item"
        dialogDescription="Primary dataset item details"
        level={1}
      >
        <SideDialog.Top>
          <TextAndIcon>
            <HashIcon /> item_a1b2c3
          </TextAndIcon>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => setIsLevel2Open(true)}>
              Open Trace
            </Button>
          </div>
        </SideDialog.Top>

        <SideDialog.Content>
          <SideDialog.Header>
            <SideDialog.Heading>
              <EyeIcon /> Refund request
            </SideDialog.Heading>
            <TextAndIcon>
              <HashIcon /> level 1
            </TextAndIcon>
          </SideDialog.Header>

          <Section>
            <Section.Header>
              <Section.Heading>
                <FileInputIcon /> Overview
              </Section.Heading>
            </Section.Header>
            <div className="grid gap-2">
              <Field label="Name" value="Refund request" />
              <Field label="Tokens used" value="412" />
              <Field label="Status" value="Success" />
            </div>
          </Section>

          <Section>
            <Section.Header>
              <Section.Heading>
                <ListTreeIcon /> Linked trace
              </Section.Heading>
            </Section.Header>
            <div className="flex items-center justify-between gap-4">
              <TextAndIcon>
                <HashIcon /> trace_72f19
              </TextAndIcon>
              <Button variant="outline" size="sm" onClick={() => setIsLevel2Open(true)}>
                Open
              </Button>
            </div>
          </Section>

          <SideDialog
            isOpen={isLevel2Open}
            onClose={closeLevel2}
            dialogTitle="Trace Details"
            dialogDescription="Nested trace details for the selected dataset item"
            level={2}
          >
            <SideDialog.Top>
              <TextAndIcon>
                <HashIcon /> trace_72f19
              </TextAndIcon>
              {depth === 3 && (
                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={() => setIsLevel3Open(true)}>
                    Open Span
                  </Button>
                </div>
              )}
            </SideDialog.Top>

            <SideDialog.Content>
              <SideDialog.Header>
                <SideDialog.Heading>
                  <ListTreeIcon /> Retrieval trace
                </SideDialog.Heading>
                <TextAndIcon>
                  <HashIcon /> level 2
                </TextAndIcon>
              </SideDialog.Header>

              <Section>
                <Section.Header>
                  <Section.Heading>Trace metadata</Section.Heading>
                </Section.Header>
                <div className="grid gap-2">
                  <Field label="Trace ID" value="trace_72f19" />
                  <Field label="Latency" value="843 ms" />
                  <Field label="Steps" value="4" />
                </div>
              </Section>

              {depth === 3 && (
                <Section>
                  <Section.Header>
                    <Section.Heading>
                      <TagIcon /> Span payload
                    </Section.Heading>
                  </Section.Header>
                  <div className="flex items-center justify-between gap-4">
                    <TextAndIcon>
                      <HashIcon /> span_embed_query
                    </TextAndIcon>
                    <Button variant="outline" size="sm" onClick={() => setIsLevel3Open(true)}>
                      Open
                    </Button>
                  </div>
                </Section>
              )}

              {depth === 3 && (
                <SideDialog
                  isOpen={isLevel3Open}
                  onClose={() => setIsLevel3Open(false)}
                  dialogTitle="Span Payload"
                  dialogDescription="Third-level span payload details"
                  level={3}
                >
                  <SideDialog.Top>
                    <TextAndIcon>
                      <HashIcon /> span_embed_query
                    </TextAndIcon>
                  </SideDialog.Top>

                  <SideDialog.Content>
                    <SideDialog.Header>
                      <SideDialog.Heading>
                        <TagIcon /> Embedding query payload
                      </SideDialog.Heading>
                      <TextAndIcon>
                        <HashIcon /> level 3
                      </TextAndIcon>
                    </SideDialog.Header>

                    <Section>
                      <Section.Header>
                        <Section.Heading>Payload summary</Section.Heading>
                      </Section.Header>
                      <div className="grid gap-2">
                        <Field label="Operation" value="embedMany" />
                        <Field label="Input count" value="3" />
                        <Field label="Vector dimensions" value="1536" />
                      </div>
                    </Section>
                  </SideDialog.Content>
                </SideDialog>
              )}
            </SideDialog.Content>
          </SideDialog>
        </SideDialog.Content>
      </SideDialog>
    </div>
  );
};

export const Default: Story = {
  render: () => <DetailDialogDemo />,
};

export const Level2: Story = {
  render: () => <NestedLevelsDemo depth={2} />,
};

export const Level3: Story = {
  render: () => <NestedLevelsDemo depth={3} />,
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
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h3 className="text-ui-lg text-neutral6 mb-2 font-medium">Confirm deletion?</h3>
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
