import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Input } from '../Input';
import { Tree } from '../Tree';
import { Txt } from './Txt';
import { TextRoles } from '@/ds/tokens/fonts';

const meta: Meta<typeof Txt> = {
  title: 'Elements/Txt',
  component: Txt,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    as: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'],
    },
    variant: {
      control: { type: 'select' },
      options: TextRoles,
    },
    tone: {
      control: { type: 'select' },
      options: [undefined, 'ink', 'muted', 'faint'],
    },
    font: {
      control: { type: 'inline-radio' },
      options: ['body', 'display', 'mono'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Txt>;

export const Default: Story = {
  args: {
    children: 'The quick brown fox jumps over the lazy dog',
  },
};

/**
 * One class per role: the weight and line height are part of the role, so two
 * components asking for the same role cannot disagree about how it looks.
 */
export const Roles: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Txt as="h1" variant="hero">
        hero · responsive welcome-page headline
      </Txt>
      <Txt variant="lead">lead · responsive introduction</Txt>
      <Txt as="h1" variant="display">
        display · 22/500 · onboarding hero
      </Txt>
      <Txt as="h1" variant="title">
        title · 18/500 · page title
      </Txt>
      <Txt as="h2" variant="heading">
        heading · 16/500 · page and panel headings
      </Txt>
      <Txt as="h3" variant="subheading">
        subheading · 14/500 · sections and cards
      </Txt>
      <Txt variant="body">body · 14/400 · prose and descriptions</Txt>
      <Txt variant="label">label · 13/500 · control labels, nav items, buttons</Txt>
      <Txt variant="card-title">card-title · 13/550 · expanded card title</Txt>
      <Txt variant="card-title-tight">card-title-tight · 13/550 · compact card title</Txt>
      <Txt variant="card-title-strong">card-title-strong · 13/600 · emphasized card title</Txt>
      <Txt variant="body-sm">body-sm · 13/400 · table cells, menus, field values</Txt>
      <Txt variant="column">column · 12/500 · column headers</Txt>
      <Txt variant="caption">caption · 12/400 · secondary copy</Txt>
      <Txt variant="eyebrow">eyebrow · 12/500 · section label</Txt>
      <Txt variant="meta">meta · 10/500 · badges and keycaps</Txt>
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Txt variant="body-sm" tone="ink">
        Ink — the reading tone, inherited by default and written only to lift text back out of a muted block
      </Txt>
      <Txt variant="body-sm" tone="muted">
        Muted — supporting copy
      </Txt>
      <Txt variant="body-sm" tone="faint">
        Faint — placeholders and absent values
      </Txt>
    </div>
  ),
};

export const Monospace: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Mono swaps the face and keeps the role. Use it for identifiers a machine wrote (model and resource ids, hashes, log lines) and for timestamps and durations. Other numbers, such as counts, stay in the body face with tabular-nums. Code goes in InlineCode or CodeBlock. Labels, headings, status, and prose stay proportional, even when they sit beside a mono value.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="flex items-baseline gap-6">
        <Txt variant="label" className="w-16 shrink-0">
          Log
        </Txt>
        <Txt variant="body" font="mono">
          12:42:07.114 INFO agent finished in 412ms
        </Txt>
      </div>
      <div className="flex items-baseline gap-6">
        <Txt variant="label" className="w-16 shrink-0">
          Run
        </Txt>
        <Txt variant="body-sm" font="mono">
          run_01JQX8K2M4
        </Txt>
      </div>
      <div className="flex items-baseline gap-6">
        <Txt variant="label" className="w-16 shrink-0">
          Started
        </Txt>
        <Txt variant="body-sm" font="mono">
          Sep 23, 12:42:07
        </Txt>
      </div>
      <div className="flex items-baseline gap-6">
        <Txt variant="label" className="w-16 shrink-0">
          Duration
        </Txt>
        <Txt variant="caption" tone="muted">
          <Txt as="span" variant="caption" font="mono">
            412ms
          </Txt>{' '}
          · <span className="tabular-nums">1,204 tokens</span>
        </Txt>
      </div>
      <div className="flex items-baseline gap-6">
        <Txt variant="label" className="w-16 shrink-0">
          Version
        </Txt>
        <Txt variant="meta" font="mono" tone="muted">
          v2.1.0 · 3f9a2c1
        </Txt>
      </div>
    </div>
  ),
};

export const AsLabel: Story = {
  args: {
    children: 'Form label',
    as: 'label',
    variant: 'label',
    htmlFor: 'input-field',
  },
};

export const TechnicalValues: Story = {
  render: () => (
    <div className="flex w-80 max-w-full flex-col gap-5">
      <div className="grid gap-2">
        <Txt as="label" htmlFor="review-command" variant="label">
          Setup command
        </Txt>
        <Input className="font-mono" id="review-command" defaultValue="pnpm install && pnpm test" />
      </div>
      <Tree>
        <Tree.File id="src/index.ts">
          <Tree.Label className="font-mono">src/index.ts</Tree.Label>
        </Tree.File>
      </Tree>
      <Txt variant="caption" tone="muted">
        Run{' '}
        <Txt as="span" variant="caption" font="mono" tone="ink">
          run_01JQX8K2M4
        </Txt>
      </Txt>
      <Txt variant="caption" tone="muted">
        <Txt as="time" variant="caption" font="mono" dateTime="2026-10-02T12:42:07Z">
          12:42:07
        </Txt>
        {' · '}
        <Txt as="span" variant="caption" font="mono">
          412ms
        </Txt>
        {' · '}
        <span className="tabular-nums">1,204 tokens</span>
      </Txt>
    </div>
  ),
};

export const TextLeaves: Story = {
  render: () => (
    <div className="flex w-80 max-w-full flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Txt as="span" variant="label">
          Layout stays on the div
        </Txt>
        <Txt as="span" variant="caption" tone="muted">
          42 items
        </Txt>
      </div>
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button type="button" className="bg-fill px-3 py-1.5" aria-pressed="true">
          <Txt as="span" variant="column" className="block">
            Agents
          </Txt>
        </button>
        <button type="button" className="px-3 py-1.5" aria-pressed="false">
          <Txt as="span" variant="column" className="block">
            Skills
          </Txt>
        </button>
      </div>
      <Button>Standard button owns its label style</Button>
    </div>
  ),
};
