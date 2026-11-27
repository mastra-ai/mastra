import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import attio from '../../../../.storybook/fixtures/integration-logos/attio.svg';
import exa from '../../../../.storybook/fixtures/integration-logos/exa.svg';
import figma from '../../../../.storybook/fixtures/integration-logos/figma.svg';
import github from '../../../../.storybook/fixtures/integration-logos/github.svg';
import gmail from '../../../../.storybook/fixtures/integration-logos/gmail.svg';
import googleDrive from '../../../../.storybook/fixtures/integration-logos/google-drive.svg';
import hubspot from '../../../../.storybook/fixtures/integration-logos/hubspot.svg';
import jira from '../../../../.storybook/fixtures/integration-logos/jira.svg';
import linear from '../../../../.storybook/fixtures/integration-logos/linear.svg';
import notion from '../../../../.storybook/fixtures/integration-logos/notion.svg';
import sentry from '../../../../.storybook/fixtures/integration-logos/sentry.svg';
import slack from '../../../../.storybook/fixtures/integration-logos/slack.svg';
import { AddToolsDialog, ToolRow } from '../tools';
import type { CatalogTool } from '../tools';
import { StepDeck } from './step-deck';
import type { StepDeckStep } from './step-deck';
import { ProviderLogo } from '@/domains/connect/provider-logo';
import type { UserConnectProvider } from '@/domains/connect/types';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { MarkdownEditor } from '@/ds/components/MarkdownEditor';
import { PageLayout } from '@/ds/components/PageLayout';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Steps } from '@/ds/components/Steps';
import { Txt } from '@/ds/components/Txt';
import { IconGlobe } from '@/ds/icons/central/IconGlobe';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';
import { SettingsContainer } from '@/ds/new/settings/settings-container';
import { SettingsRow } from '@/ds/new/settings/settings-row';

const TEMPLATES = {
  basic: `## Role

You help the team with questions about their work. Ask before you change anything.

## When to stop and ask

- You are not sure which record or file someone means.`,
  coding: `## Role

You work in the connected repository. Read AGENTS.md before you change code.

## How to work

- Run the tests and the linter before you open a pull request.
- Keep each pull request to one change.

## When to stop and ask

- A change touches auth, billing or a migration.`,
};

type Template = keyof typeof TEMPLATES;

function InstructionsStep() {
  const [template, setTemplate] = useState<Template>('coding');
  const [text, setText] = useState(TEMPLATES.coding);
  const pick = (next: Template) => {
    setTemplate(next);
    setText(TEMPLATES[next]);
  };
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl aria-label="Start from" size="sm" value={template} onValueChange={pick}>
        <SegmentedControlItem value="basic">Basic</SegmentedControlItem>
        <SegmentedControlItem value="coding">Coding agent</SegmentedControlItem>
      </SegmentedControl>
      <div className="rounded-lg bg-nested px-3 py-2">
        <MarkdownEditor variant="inline" value={text} onChange={setText} aria-label="Instructions" />
      </div>
    </div>
  );
}

const PROVIDERS: UserConnectProvider[] = [
  { id: 'github', displayName: 'GitHub', logoUrl: github, authType: 'OAUTH2', authFields: null },
  { id: 'linear', displayName: 'Linear', logoUrl: linear, authType: 'OAUTH2', authFields: null },
  { id: 'slack', displayName: 'Slack', logoUrl: slack, authType: 'OAUTH2', authFields: null },
  { id: 'notion', displayName: 'Notion', logoUrl: notion, authType: 'OAUTH2', authFields: null },
  { id: 'attio', displayName: 'Attio', logoUrl: attio, authType: 'OAUTH2', authFields: null },
  { id: 'exa', displayName: 'Exa', logoUrl: exa, authType: 'API_KEY', authFields: null },
  { id: 'google-drive', displayName: 'Google Drive', logoUrl: googleDrive, authType: 'OAUTH2', authFields: null },
  { id: 'gmail', displayName: 'Gmail', logoUrl: gmail, authType: 'OAUTH2', authFields: null },
  { id: 'jira', displayName: 'Jira', logoUrl: jira, authType: 'OAUTH2', authFields: null },
  { id: 'sentry', displayName: 'Sentry', logoUrl: sentry, authType: 'API_KEY', authFields: null },
  { id: 'hubspot', displayName: 'HubSpot', logoUrl: hubspot, authType: 'OAUTH2', authFields: null },
  { id: 'figma', displayName: 'Figma', logoUrl: figma, authType: 'OAUTH2', authFields: null },
];

const DESCRIPTIONS = new Map([
  ['github', 'Read the repository and open pull requests'],
  ['linear', 'Read and update issues'],
  ['slack', 'Read channels and post messages'],
  ['notion', 'Search and edit pages'],
  ['attio', 'Look up and update CRM records'],
  ['exa', 'Neural web search'],
  ['google-drive', 'Find and read files'],
  ['gmail', 'Read and draft email'],
  ['jira', 'Read and update tickets'],
  ['sentry', 'Read issues and stack traces'],
  ['hubspot', 'Look up contacts and deals'],
  ['figma', 'Read files and comments'],
]);

const TINTED = new Set(['github', 'notion', 'attio']);

function toCatalogTool(provider: UserConnectProvider, connectedIds: string[]): CatalogTool {
  return {
    id: provider.id,
    name: provider.displayName ?? provider.id,
    description: DESCRIPTIONS.get(provider.id) ?? '',
    logo: <ProviderLogo logoUrl={provider.logoUrl} tinted={TINTED.has(provider.id)} />,
    connected: connectedIds.includes(provider.id),
  };
}

const WEB_SEARCH: CatalogTool = {
  id: 'web-search',
  name: 'Web search',
  description: 'Search the web and read pages',
  logo: (
    <span className="grid size-8 place-items-center text-muted-foreground">
      <IconGlobe className="size-icon-md" />
    </span>
  ),
  connected: true,
};

function ToolsStep() {
  const [connectedIds, setConnectedIds] = useState<string[]>(['github', 'slack']);
  const [added, setAdded] = useState<string[]>(['github', 'linear', 'web-search']);
  const [enabled, setEnabled] = useState<string[]>(['github', 'web-search']);
  const [adding, setAdding] = useState(false);
  const catalog = [WEB_SEARCH, ...PROVIDERS.map(provider => toCatalogTool(provider, connectedIds))];
  const tools = catalog.filter(tool => added.includes(tool.id));
  const available = catalog.filter(tool => !added.includes(tool.id));
  return (
    <div className="flex flex-col gap-3">
      <SettingsContainer>
        {tools.map(tool => (
          <ToolRow
            key={tool.id}
            logo={tool.logo}
            name={tool.name}
            description={tool.description}
            enabled={enabled.includes(tool.id)}
            onEnabledChange={on => setEnabled(on ? [...enabled, tool.id] : enabled.filter(id => id !== tool.id))}
            onConnect={tool.connected ? undefined : () => setConnectedIds([...connectedIds, tool.id])}
          />
        ))}
      </SettingsContainer>
      <Button
        variant="ghost"
        size="sm"
        icon={<IconPlusMedium />}
        className="self-start"
        onClick={() => setAdding(true)}
      >
        Add tools
      </Button>
      <AddToolsDialog
        open={adding}
        onOpenChange={setAdding}
        catalog={available}
        onAdd={ids => {
          setAdded([...added, ...ids]);
          setEnabled([...enabled, ...ids]);
        }}
      />
    </div>
  );
}

const STEPS: Array<StepDeckStep & { summary: string }> = [
  {
    id: 'basics',
    title: 'Basics',
    summary: 'Kit, GPT-5 mini',
    content: (
      <SettingsContainer>
        <SettingsRow label="Name">
          <Input defaultValue="Kit" />
        </SettingsRow>
        <SettingsRow label="Model">
          <Input defaultValue="GPT-5 mini" />
        </SettingsRow>
      </SettingsContainer>
    ),
  },
  {
    id: 'instructions',
    title: 'Instructions',
    summary: 'Coding agent template',
    content: <InstructionsStep />,
  },
  {
    id: 'tools',
    title: 'Tools',
    summary: 'Optional',
    content: <ToolsStep />,
  },
  {
    id: 'review',
    title: 'Review',
    summary: 'Check and create',
    content: (
      <Txt variant="body-sm" tone="muted">
        Kit uses GPT-5 mini, the Coding agent instructions, GitHub and web search. You can change any of this later from
        Edit.
      </Txt>
    ),
  },
];

function Onboarding() {
  const [current, setCurrent] = useState(0);
  const last = current === STEPS.length - 1;
  return (
    <div className="flex h-200 bg-sidebar p-2">
      <MainCard>
        <PageLayout
          variant="form"
          breadcrumbs={
            <Breadcrumb label="Breadcrumb">
              <Crumb as="a" href="#agents">
                Agents
              </Crumb>
              <Crumb as="span" isCurrent>
                New agent
              </Crumb>
            </Breadcrumb>
          }
          title="New agent"
          asidePlacement="start"
          aside={
            <Steps headingLevel={2}>
              {STEPS.map((step, index) => (
                <Steps.Step key={step.id} title={step.title} description={step.summary} done={index < current} />
              ))}
            </Steps>
          }
        >
          <StepDeck
            steps={STEPS}
            current={current}
            label="New agent steps"
            actions={
              <>
                <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent(Math.max(current - 1, 0))}>
                  Back
                </Button>
                <Button variant="primary" onClick={() => setCurrent(Math.min(current + 1, STEPS.length - 1))}>
                  {last ? 'Create agent' : 'Continue'}
                </Button>
              </>
            }
          />
        </PageLayout>
      </MainCard>
    </div>
  );
}

const meta = {
  title: 'Managed agents/Onboarding',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'New agent onboarding: a form page with breadcrumbs and the step list on the start side. The current step is a card with the next steps tucked under it; Continue lifts the current card away and brings the next one forward, and the step list follows. Reduced motion swaps the cards without movement.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <Onboarding /> };

export const MovesToTheNextStep: Story = {
  render: () => <Onboarding />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Next: Instructions')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(canvas.getByRole('heading', { name: 'Instructions', level: 2 })).toHaveFocus();
    await expect(canvas.getByText('Next: Tools')).toBeInTheDocument();
  },
};
