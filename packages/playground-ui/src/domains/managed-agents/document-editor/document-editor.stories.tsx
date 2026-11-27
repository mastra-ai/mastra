import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { DocumentEditor } from './index';
import { Badge } from '@/ds/components/Badge';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { CodeDiff } from '@/ds/components/CodeDiff';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { DiffStat } from '@/ds/components/DiffStat';
import { MarkdownDiff } from '@/ds/components/MarkdownDiff';
import { MarkdownEditor } from '@/ds/components/MarkdownEditor';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { PageLayout } from '@/ds/components/PageLayout';
import { SaveBar } from '@/ds/components/SaveBar';
import { Txt } from '@/ds/components/Txt';
import { VersionTimeline } from '@/ds/components/VersionTimeline';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconFloppyDisk1 } from '@/ds/icons/central/IconFloppyDisk1';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';

type SaveState = 'dirty' | 'draft' | 'published' | 'failed';
type Mode = 'ready' | 'loading' | 'viewer' | 'compare' | 'leaving';
type Version = { version: string; when: string; by: string; state?: 'draft' | 'published'; usedBy?: string[] };
type Doc = {
  parents: string[];
  current: string;
  heading: string;
  description: string;
  body: string;
  save: SaveState;
  facts: { label: string; items: { name: string; value: string }[] }[];
  versions: Version[];
};

const TONE = `Write like a colleague who knows the account, not like a vendor.

## Do

- Use the customer’s first name and plain words.
- Lead with the answer, then the detail.
- Name the next step and who owns it.

## Don’t

- Promise dates, prices or refunds.
- Use “just”, “simply” or exclamation marks.`;

const TONE_V2 = `Write like a friendly vendor who knows the product.

## Do

- Use the customer’s first name.
- Lead with the answer, then the detail.

## Don’t

- Promise dates, prices or refunds.`;

const DOCS = {
  instructions: {
    parents: ['Agents', 'Kit'],
    current: 'Edit',
    heading: 'Instructions',
    description: 'What Kit does and when it stops to ask.',
    body: `## Role

You help the sales team with deals in Attio. Look up the deal before you answer, and say which record you used.

## What to do

- Use \`search_records\` first, then \`get_record\` for the one that matches.
- Draft follow-ups in the rep’s voice. Never send them.

## When to stop and ask

- Anything that changes a deal’s stage.
- Discounts over 10%.`,
    save: 'dirty',
    facts: [{ label: 'Uses', items: [{ name: 'Tone of voice', value: 'Prompt, v3' }] }],
    versions: [
      { version: 'v4', when: '5 min ago', by: 'Justin', state: 'draft' },
      { version: 'v3', when: 'Nov 24', by: 'Charlie', state: 'published', usedBy: ['Kit'] },
      { version: 'v2', when: 'Nov 12', by: 'Justin' },
      { version: 'v1', when: 'Nov 3', by: 'Abhi' },
    ],
  },
  prompt: {
    parents: ['Prompts'],
    current: 'Tone of voice',
    heading: 'Prompt',
    description: 'Agents read this with their own instructions. Publishing moves the agents on v3 to v4.',
    body: TONE,
    save: 'draft',
    facts: [],
    versions: [
      { version: 'v4', when: '5 min ago', by: 'Justin', state: 'draft' },
      { version: 'v3', when: '2 days ago', by: 'Charlie', state: 'published', usedBy: ['Kit', 'Triage', 'Support'] },
      { version: 'v2', when: 'Nov 12', by: 'Abhi', usedBy: ['Release notes'] },
      { version: 'v1', when: 'Nov 3', by: 'Justin' },
    ],
  },
  skill: {
    parents: ['Skills'],
    current: 'Deal summaries',
    heading: 'SKILL.md',
    description: 'Use when someone asks about a deal’s status, value or next step.',
    body: `Answer deal questions as a short table, then one line on what to do next.

## Format

- Columns: deal, stage, value, owner, last touch.
- Sort by close date, soonest first.

## Example

See \`examples/table.md\` for a filled-in answer.`,
    save: 'published',
    facts: [
      {
        label: 'Files',
        items: [
          { name: 'examples/table.md', value: '1.2 KB' },
          { name: 'reference/stages.md', value: '3.4 KB' },
        ],
      },
    ],
    versions: [
      { version: 'v2', when: 'Nov 20', by: 'Charlie', state: 'published', usedBy: ['Kit', 'Support'] },
      { version: 'v1', when: 'Nov 14', by: 'Justin' },
    ],
  },
} satisfies Record<string, Doc>;

const SAVE_STATUS: Record<SaveState, string> = {
  dirty: 'You have unsaved edits.',
  draft: 'Saved as a draft. Publish to use it in new conversations.',
  published: 'Published. New conversations use this version.',
  failed: 'Couldn’t publish. Your draft is saved and agents keep using v3.',
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-sidebar p-2">
      <MainCard>{children}</MainCard>
    </div>
  );
}

function Crumbs({ doc }: { doc: Doc }) {
  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
      <Crumb as="a" href="#">
        Acme
      </Crumb>
      <Crumb as="a" href="#">
        sales-assistant
      </Crumb>
      {doc.parents.map(parent => (
        <Crumb key={parent} as="a" href="#">
          {parent}
        </Crumb>
      ))}
      <Crumb as="span" isCurrent>
        {doc.current}
      </Crumb>
    </Breadcrumb>
  );
}

function EditorSaveBar({ state }: { state: SaveState }) {
  return (
    <SaveBar
      status={SAVE_STATUS[state]}
      tone={state === 'failed' ? 'error' : state === 'published' ? 'success' : 'neutral'}
    >
      <Button variant="ghost" size="sm" icon={<IconFloppyDisk1 />} disabled={state !== 'dirty'}>
        Save
      </Button>
      <Button variant="primary" size="sm" icon={<IconCheckmark2Medium />} disabled={state === 'published'}>
        {state === 'failed' ? 'Try again' : 'Publish'}
      </Button>
    </SaveBar>
  );
}

function CompareBar() {
  return (
    <SaveBar status="Viewing v2 by Abhi, Nov 12.">
      <Button variant="ghost" size="sm">
        Close
      </Button>
      <Button variant="primary" size="sm" icon={<IconArrowRotateCounterClockwise />}>
        Restore v2
      </Button>
    </SaveBar>
  );
}

const restoreActions = (
  <>
    <Button variant="ghost" size="sm">
      Compare
    </Button>
    <Button variant="ghost" size="sm" icon={<IconArrowRotateCounterClockwise />}>
      Restore
    </Button>
  </>
);

function Timeline({ versions, unsaved, comparing }: { versions: Version[]; unsaved: boolean; comparing: boolean }) {
  return (
    <VersionTimeline aria-label="Version history">
      {unsaved ? <VersionTimeline.Item state="unsaved" title="Unsaved edits" meta="Now" /> : null}
      {versions.map(item => {
        const isCompared = comparing && item.version === 'v2';
        return (
          <VersionTimeline.Item
            key={item.version}
            state={item.state === 'published' ? 'live' : (item.state ?? 'past')}
            title={item.version}
            label={item.state === 'published' ? 'Live' : item.state === 'draft' ? 'Draft' : undefined}
            meta={isCompared ? 'Comparing' : item.when}
            actions={item.state || isCompared ? undefined : restoreActions}
            selected={isCompared}
          >
            <VersionTimeline.Detail>{item.by}</VersionTimeline.Detail>
            {item.usedBy ? <VersionTimeline.Detail>Used by {item.usedBy.join(', ')}</VersionTimeline.Detail> : null}
          </VersionTimeline.Item>
        );
      })}
    </VersionTimeline>
  );
}

function Details({ doc, mode }: { doc: Doc; mode: Mode }) {
  return (
    <DocumentEditor.Details onClose={() => undefined} isLoading={mode === 'loading'}>
      {doc.facts.map(fact => (
        <DocumentEditor.Section key={fact.label} label={fact.label}>
          {fact.items.map(item => (
            <DocumentEditor.Fact key={item.name} label={item.name} value={item.value} />
          ))}
        </DocumentEditor.Section>
      ))}
      <DocumentEditor.Section label="Versions">
        <Timeline versions={doc.versions} unsaved={doc.save === 'dirty'} comparing={mode === 'compare'} />
      </DocumentEditor.Section>
    </DocumentEditor.Details>
  );
}

function Body({ doc, mode }: { doc: Doc; mode: Mode }) {
  if (mode === 'loading') return <DocumentEditor.BodySkeleton />;
  if (mode === 'compare')
    return (
      <>
        <DocumentEditor.Header
          title="Compare v2 with your draft"
          description="Restoring v2 makes it a new draft; agents keep v3 until you publish."
        />
        <MarkdownDiff before={TONE_V2} after={doc.body} />
      </>
    );
  return (
    <>
      <DocumentEditor.Header
        title={doc.heading}
        description={doc.description}
        badge={mode === 'viewer' ? <Badge variant="neutral">View only</Badge> : null}
      />
      {mode === 'viewer' ? (
        <MarkdownRenderer>{doc.body}</MarkdownRenderer>
      ) : (
        <MarkdownEditor variant="inline" value={doc.body} onChange={() => undefined} />
      )}
    </>
  );
}

function Footer({ doc, mode, save }: { doc: Doc; mode: Mode; save?: SaveState }) {
  if (mode === 'loading' || mode === 'viewer') return null;
  return mode === 'compare' ? <CompareBar /> : <EditorSaveBar state={save ?? doc.save} />;
}

function Editor({ doc, mode = 'ready', save }: { doc: Doc; mode?: Mode; save?: SaveState }) {
  return (
    <Frame>
      <DocumentEditor breadcrumbs={<Crumbs doc={doc} />} title={doc.current}>
        <DocumentEditor.Main footer={<Footer doc={doc} mode={mode} save={save} />}>
          <Body doc={doc} mode={mode} />
        </DocumentEditor.Main>
        <Details doc={doc} mode={mode} />
      </DocumentEditor>
      {mode === 'leaving' ? (
        <Dialog open>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Leave without saving?</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Txt variant="body-sm" tone="muted">
                Your edits aren’t saved. Agents keep using v3 either way.
              </Txt>
            </DialogBody>
            <DialogFooter>
              <Button>Keep editing</Button>
              <Button variant="destructive">Discard changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Frame>
  );
}

const meta = {
  title: 'Managed agents/Document editor',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One frame for an agent’s instructions, a shared prompt and a skill: `PageLayout variant="page" body="fixed"` with breadcrumbs as the way back, a flat editor column with a save bar, and a Details card with what it uses and its version timeline. Composed from `DocumentEditor` in this domain with `MarkdownEditor`, `MarkdownRenderer`, `MarkdownDiff`, `SaveBar` and `VersionTimeline`.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Instructions: Story = { render: () => <Editor doc={DOCS.instructions} /> };
export const Prompt: Story = { render: () => <Editor doc={DOCS.prompt} /> };
export const Skill: Story = { render: () => <Editor doc={DOCS.skill} /> };
export const CompareInline: Story = { render: () => <Editor doc={DOCS.prompt} mode="compare" /> };
export const CompareLines: Story = {
  render: () => (
    <Frame>
      <PageLayout variant="page" body="fixed" breadcrumbs={<Crumbs doc={DOCS.prompt} />}>
        <h1 className="sr-only">Tone of voice</h1>
        <div className="flex h-full min-h-0 flex-col items-center gap-3 p-6">
          <div className="w-full max-w-240">
            <CodeDiff
              layout="split"
              overflow="wrap"
              codeA={`${TONE_V2}\n`}
              codeB={`${TONE}\n`}
              header={{ path: 'v2  →  v4 Draft', meta: <DiffStat additions={7} deletions={3} /> }}
            />
          </div>
        </div>
      </PageLayout>
    </Frame>
  ),
};
export const Loading: Story = { render: () => <Editor doc={DOCS.prompt} mode="loading" /> };
export const PublishFailed: Story = { render: () => <Editor doc={DOCS.prompt} save="failed" /> };
export const ViewOnly: Story = { render: () => <Editor doc={DOCS.prompt} mode="viewer" /> };
export const LeaveWithUnsavedEdits: Story = {
  render: () => <Editor doc={DOCS.prompt} mode="leaving" save="dirty" />,
};
