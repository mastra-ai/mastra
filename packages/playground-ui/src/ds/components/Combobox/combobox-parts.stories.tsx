import type { Meta, StoryObj } from '@storybook/react-vite';
import { Filter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';
import { Dialog, DialogBody, DialogCancel, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../Dialog';
import { Field, FieldError, FieldLabel } from '../Field';
import {
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemContent,
  ComboboxItemDescription,
  ComboboxItemEnd,
  ComboboxItemTitle,
  ComboboxLabel,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from './combobox-parts';

type Option = { value: string; label: string; kind?: 'Agent' | 'Workflow' | 'Scorer'; description?: string };

const toOption = (kind: Option['kind']) => (label: string) => ({
  value: label.toLowerCase().replace(/ /g, '-'),
  label,
  kind,
});

const agents: Option[] = [
  'Mastra Docs',
  'Chef Agent',
  'Chef Agent Responses',
  'Billing Agent',
  'Balance Agent',
  'Gateway Agent',
  'Ask User Agent',
  'Approval Demo Agent',
  'Dynamic Agent',
  'Supervisor Agent',
].map(toOption('Agent'));

const workflows: Option[] = ['Weather Workflow', 'Recipe Workflow'].map(toOption('Workflow'));

const scorers: Option[] = [
  {
    value: 'answer-relevancy',
    label: 'Answer Relevancy Scorer',
    description: 'Evaluates the relevancy of an LLM output to an input.',
  },
  { value: 'always-pass', label: 'Always Pass', description: 'Always returns a perfect score.' },
  {
    value: 'every-other-run',
    label: 'Every Other Run',
    description: 'Passes one run out of two, alternating between 1 and 0.',
  },
  {
    value: 'tone',
    label: 'Tone Scorer',
    description: 'Analyzes the tone and sentiment of agent responses using sentiment analysis.',
  },
  {
    value: 'answer-similarity',
    label: 'Answer Similarity Scorer',
    description: 'Evaluates how similar an agent output is to a ground truth answer.',
  },
].map(scorer => ({ ...scorer, kind: 'Scorer' as const }));

const datasets: Option[] = [
  { value: 'recipes', label: 'Quick recipes' },
  { value: 'docs', label: 'Common Mastra questions' },
];

const itemCounts: Record<string, number> = { recipes: 4, docs: 5 };

const targetGroups = [
  { value: 'Agents', items: agents },
  { value: 'Workflows', items: workflows },
  { value: 'Scorers', items: scorers },
];

function OptionList() {
  return (
    <ComboboxList>
      {(item: Option) => (
        <ComboboxItem key={item.value} value={item}>
          {item.label}
        </ComboboxItem>
      )}
    </ComboboxList>
  );
}

function DatasetPicker() {
  const [value, setValue] = useState<Option | null>(datasets[0] ?? null);
  return (
    <ComboboxRoot items={datasets} value={value} onValueChange={setValue} autoHighlight>
      <ComboboxInput placeholder="Select a dataset">{value ? `${itemCounts[value.value]} items` : null}</ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>No datasets found.</ComboboxEmpty>
        <OptionList />
      </ComboboxContent>
    </ComboboxRoot>
  );
}

function TargetPicker() {
  const [value, setValue] = useState<Option | null>(null);
  return (
    <ComboboxRoot items={targetGroups} value={value} onValueChange={setValue} autoHighlight>
      <ComboboxInput placeholder="Pick an agent, workflow or scorer" />
      <ComboboxContent>
        <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
        <ComboboxList>
          {(group: (typeof targetGroups)[number], index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {index > 0 ? <ComboboxSeparator /> : null}
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(item: Option) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

function ScorersPicker({ initial }: { initial: Option[] }) {
  const [value, setValue] = useState<Option[]>(initial);
  return (
    <ComboboxRoot multiple items={scorers} value={value} onValueChange={setValue} autoHighlight>
      <ComboboxChips>
        <ComboboxValue>
          {(items: Option[]) => (
            <>
              {items.map(item => (
                <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={items.length === 0 ? 'No scoring, read the outputs yourself' : undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>No scorers found.</ComboboxEmpty>
        <ComboboxList>
          {(item: Option) => (
            <ComboboxItem key={item.value} value={item}>
              <ComboboxItemContent>
                <ComboboxItemTitle>{item.label}</ComboboxItemTitle>
                <ComboboxItemDescription>{item.description}</ComboboxItemDescription>
              </ComboboxItemContent>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

const meta: Meta = {
  title: 'Composite/Combobox/Parts',
  parameters: { layout: 'centered' },
  decorators: [Story => <div className="w-80">{Story()}</div>],
};

export default meta;
type Story = StoryObj;

/** Search in the field: type to filter. `children` add a muted detail before the chevron. */
export const Basic: Story = {
  render: () => (
    <Field>
      <FieldLabel>Dataset</FieldLabel>
      <DatasetPicker />
    </Field>
  ),
};

/** Labelled sections with separators: agents, workflows and scorers in one field. */
export const Groups: Story = {
  render: () => (
    <Field>
      <FieldLabel>Target</FieldLabel>
      <TargetPicker />
    </Field>
  ),
};

/** Title over a description, and a muted detail at the end. */
export const CustomItems: Story = {
  render: function CustomItemsStory() {
    const all = [...agents.slice(0, 3), ...workflows, ...scorers.slice(0, 2)];
    const [value, setValue] = useState<Option | null>(null);
    return (
      <ComboboxRoot items={all} value={value} onValueChange={setValue} autoHighlight>
        <ComboboxInput aria-label="Target" placeholder="Pick a target…" />
        <ComboboxContent>
          <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.value} value={item}>
                <ComboboxItemContent>
                  <ComboboxItemTitle>{item.label}</ComboboxItemTitle>
                  {item.description ? <ComboboxItemDescription>{item.description}</ComboboxItemDescription> : null}
                </ComboboxItemContent>
                <ComboboxItemEnd>{item.kind}</ComboboxItemEnd>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    );
  },
};

/** Chips in the field, each with ×. Backspace in the empty input removes the last one. */
export const Multiple: Story = {
  render: () => (
    <Field>
      <FieldLabel>Scorers</FieldLabel>
      <ScorersPicker initial={scorers.slice(3, 4)} />
    </Field>
  ),
};

/** Once chips don't fit, they wrap and the field takes the Textarea corner; the chevron stays on the first row. */
export const MultipleWrapping: Story = {
  render: () => (
    <Field>
      <FieldLabel>Scorers</FieldLabel>
      <ScorersPicker initial={scorers.slice(0, 4)} />
    </Field>
  ),
};

export const MultipleEmpty: Story = {
  render: () => (
    <Field>
      <FieldLabel>Scorers</FieldLabel>
      <ScorersPicker initial={[]} />
    </Field>
  ),
};

/** An × in the field clears the value. */
export const Clear: Story = {
  render: function ClearStory() {
    const [value, setValue] = useState<Option | null>(agents[0] ?? null);
    return (
      <Field>
        <FieldLabel>Agent</FieldLabel>
        <ComboboxRoot items={agents} value={value} onValueChange={setValue} autoHighlight>
          <ComboboxInput placeholder="Pick an agent…" showClear />
          <ComboboxContent>
            <ComboboxEmpty>No agents found.</ComboboxEmpty>
            <OptionList />
          </ComboboxContent>
        </ComboboxRoot>
      </Field>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-4">
      <Field disabled>
        <FieldLabel>Dataset</FieldLabel>
        <ComboboxRoot items={datasets} defaultValue={datasets[1]} disabled>
          <ComboboxInput placeholder="Select a dataset" />
          <ComboboxContent>
            <OptionList />
          </ComboboxContent>
        </ComboboxRoot>
      </Field>
      <Field disabled>
        <FieldLabel>Scorers</FieldLabel>
        <ComboboxRoot multiple items={scorers} defaultValue={scorers.slice(3, 4)} disabled>
          <ComboboxChips>
            <ComboboxValue>
              {(items: Option[]) => (
                <>
                  {items.map(item => (
                    <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent>
            <OptionList />
          </ComboboxContent>
        </ComboboxRoot>
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Field invalid>
      <FieldLabel required>Target</FieldLabel>
      <TargetPicker />
      <FieldError>Pick what to run.</FieldError>
    </Field>
  ),
};

/** The list portals into the dialog, so it stays interactive above the modal backdrop. */
export const InDialog: Story = {
  render: function InDialogStory() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New experiment</DialogTitle>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <Field>
                <FieldLabel>Target</FieldLabel>
                <TargetPicker />
              </Field>
              <Field>
                <FieldLabel>Dataset</FieldLabel>
                <DatasetPicker />
              </Field>
              <Field>
                <FieldLabel>Scorers</FieldLabel>
                <ScorersPicker initial={scorers.slice(3, 4)} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};

/**
 * Compact triggers keep the search inside the popup: a field-look trigger, a ghost one for toolbars
 * and breadcrumbs, and an icon-only one (name it with `aria-label`). The popup sizes to its content.
 */
export const CompactTrigger: Story = {
  render: function CompactTriggerStory() {
    const [agent, setAgent] = useState<Option | null>(agents[1] ?? null);
    const [workflow, setWorkflow] = useState<Option | null>(workflows[0] ?? null);
    const [filter, setFilter] = useState<Option | null>(null);
    return (
      <div className="flex items-center gap-3">
        <ComboboxRoot items={agents} value={agent} onValueChange={setAgent} autoHighlight>
          <ComboboxTrigger className="w-44" aria-label="Agent">
            <ComboboxValue placeholder="Pick an agent" />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxSearch placeholder="Search agents…" />
            <ComboboxEmpty>No agents found.</ComboboxEmpty>
            <OptionList />
          </ComboboxContent>
        </ComboboxRoot>
        <ComboboxRoot items={workflows} value={workflow} onValueChange={setWorkflow} autoHighlight>
          <ComboboxTrigger variant="ghost" size="sm" aria-label="Workflow">
            <ComboboxValue placeholder="Workflow" />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxSearch placeholder="Search workflows…" />
            <ComboboxEmpty>No workflows found.</ComboboxEmpty>
            <OptionList />
          </ComboboxContent>
        </ComboboxRoot>
        <ComboboxRoot items={agents} value={filter} onValueChange={setFilter} autoHighlight>
          <ComboboxTrigger variant="ghost" size="icon-md" icon={<Filter />} aria-label="Filter by agent">
            <ComboboxValue placeholder="All agents" />
          </ComboboxTrigger>
          <ComboboxContent align="end">
            <ComboboxSearch placeholder="Search agents…" />
            <ComboboxEmpty>No agents found.</ComboboxEmpty>
            <OptionList />
          </ComboboxContent>
        </ComboboxRoot>
      </div>
    );
  },
};
