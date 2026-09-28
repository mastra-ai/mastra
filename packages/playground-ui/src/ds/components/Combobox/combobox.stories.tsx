import type { Meta, StoryObj } from '@storybook/react-vite';
import { Activity, BarChart3, Database, Gauge, GitBranch, ListChecks, ScrollText } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Combobox } from './combobox';

const meta: Meta<typeof Combobox> = {
  title: 'Composite/Combobox',
  component: Combobox,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'ghost'],
    },
    showChevron: {
      control: { type: 'boolean' },
    },
    iconOnlyValue: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

const iconClassName = 'h-4 w-4 shrink-0 text-muted-foreground';
const badgeClassName = 'rounded-full border border-border px-2 py-0.5 text-meta text-muted-foreground';

const frameworkOptions = [
  { label: 'React', value: 'react' },
  { label: 'Vue', value: 'vue' },
  { label: 'Angular', value: 'angular' },
  { label: 'Svelte', value: 'svelte' },
  { label: 'Next.js', value: 'nextjs' },
  { label: 'Nuxt', value: 'nuxt' },
];

const modelOptions = [
  { label: 'GPT-4', value: 'gpt-4' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku' },
];

const capabilityOptions = [
  {
    label: 'Logs',
    value: 'logs',
    description: 'Inspect application output',
    start: <ScrollText className={iconClassName} />,
    end: <span className={badgeClassName}>Live</span>,
  },
  {
    label: 'Traces',
    value: 'traces',
    description: 'Follow request spans',
    start: <GitBranch className={iconClassName} />,
    end: <span className={badgeClassName}>8 services</span>,
  },
  {
    label: 'Metrics',
    value: 'metrics',
    description: 'Monitor service health',
    start: <Gauge className={iconClassName} />,
    end: <span className={badgeClassName}>42 charts</span>,
  },
  {
    label: 'Datasets',
    value: 'datasets',
    description: 'Review evaluation data',
    start: <Database className={iconClassName} />,
    end: <span className={badgeClassName}>12 sets</span>,
  },
  {
    label: 'Workflows',
    value: 'workflows',
    description: 'Run multi-step processes',
    start: <ListChecks className={iconClassName} />,
    end: <span className={badgeClassName}>6 active</span>,
  },
  {
    label: 'Scorers',
    value: 'scorers',
    description: 'Evaluate generated output',
    start: <BarChart3 className={iconClassName} />,
    end: <span className={badgeClassName}>Quality</span>,
  },
  {
    label: 'Signals',
    value: 'signals',
    description: 'Watch runtime activity',
    start: <Activity className={iconClassName} />,
    end: <span className={badgeClassName}>Beta</span>,
  },
];

export const Default: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    className: 'w-[200px]',
  },
};

export const WithError: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    name: 'framework',
    error: 'Choose a framework.',
    'aria-label': 'Framework',
    className: 'w-[200px]',
  },
};

export const WithValue: Story = {
  args: {
    options: frameworkOptions,
    value: 'react',
    placeholder: 'Select a framework...',
    className: 'w-[200px]',
  },
};

export const ModelSelector: Story = {
  args: {
    options: modelOptions,
    placeholder: 'Select a model...',
    searchPlaceholder: 'Search models...',
    className: 'w-[220px]',
  },
};

export const Disabled: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    disabled: true,
    className: 'w-[200px]',
  },
};

export const CustomEmptyText: Story = {
  args: {
    options: [],
    placeholder: 'Select an option...',
    emptyText: 'No options available',
    className: 'w-[200px]',
  },
};

export const ManyOptions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Long lists scroll inside `ScrollArea`: an overlay scrollbar, fades at the clipped edges, and scroll padding that keeps the keyboard-highlighted row clear of the fade.',
      },
    },
  },
  args: {
    options: Array.from({ length: 40 }, (_, index) => ({ label: `Option ${index + 1}`, value: `${index + 1}` })),
    placeholder: 'Select an option...',
    className: 'w-[200px]',
  },
};

export const IconOnlyValue: Story = {
  args: {
    options: [
      {
        label: 'Database',
        value: 'database',
        start: <Database className={iconClassName} />,
        displayLabel: <span className="sr-only">Database</span>,
      },
      {
        label: 'Metrics',
        value: 'metrics',
        start: <Gauge className={iconClassName} />,
        displayLabel: <span className="sr-only">Metrics</span>,
      },
      {
        label: 'Branches',
        value: 'branches',
        start: <GitBranch className={iconClassName} />,
        displayLabel: <span className="sr-only">Branches</span>,
      },
    ],
    value: 'database',
    'aria-label': 'Source',
    showChevron: false,
    iconOnlyValue: true,
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['default', 'ghost'] as const).map(variant => (
        <Fragment key={variant}>
          <Combobox variant={variant} options={frameworkOptions} placeholder={variant} className="w-50" />
        </Fragment>
      ))}
    </div>
  ),
};

export const WithDescriptions: Story = {
  args: {
    options: [
      { label: 'GPT-4', value: 'gpt-4', description: 'Most capable model' },
      { label: 'GPT-4 Turbo', value: 'gpt-4-turbo', description: 'Faster, cheaper GPT-4' },
      { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', description: 'Fast and economical' },
      { label: 'Claude 3 Opus', value: 'claude-3-opus', description: "Anthropic's most powerful" },
    ],
    value: 'gpt-4-turbo',
    placeholder: 'Select a model...',
    className: 'w-[280px]',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['sm', 'md', 'lg'] as const).map(size => (
        <Fragment key={size}>
          <Combobox size={size} options={frameworkOptions} placeholder={size} className="w-50" />
        </Fragment>
      ))}
    </div>
  ),
};

export const Multiple: Story = {
  render: function MultipleStory() {
    const [value, setValue] = useState<string[]>(['logs', 'traces', 'metrics']);
    const selectedCapabilities = capabilityOptions.filter(option => value.includes(option.value));

    return (
      <div className="flex w-90 flex-col gap-3">
        <Combobox
          multiple
          options={capabilityOptions}
          value={value}
          onValueChange={setValue}
          placeholder="Select capabilities..."
          searchPlaceholder="Search capabilities..."
          emptyText="No capabilities found."
          className="w-full"
        />
        <div className="flex flex-wrap gap-1.5">
          {selectedCapabilities.map(option => (
            <span
              key={option.value}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-meta text-muted-foreground"
            >
              {option.label}
            </span>
          ))}
        </div>
      </div>
    );
  },
};

/** Selected, described and multi items side by side, to compare against the menu components. */
export const KitchenSink: Story = {
  render: () => (
    <div className="flex w-56 flex-col gap-4">
      <Combobox
        placeholder="Single"
        value="react"
        options={[
          { label: 'Plain item', value: 'plain' },
          { label: 'React', value: 'react' },
          {
            label: 'With description',
            value: 'described',
            description: 'A second line under the label',
          },
        ]}
      />
      <Combobox multiple placeholder="Multiple" value={['react', 'vue']} options={frameworkOptions} />
    </div>
  ),
};
