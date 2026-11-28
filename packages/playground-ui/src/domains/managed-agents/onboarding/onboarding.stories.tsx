import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { StepDeck } from './step-deck';
import type { StepDeckStep } from './step-deck';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { MarkdownEditor } from '@/ds/components/MarkdownEditor';
import { PageLayout } from '@/ds/components/PageLayout';
import { Steps } from '@/ds/components/Steps';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';
import { SettingsContainer } from '@/ds/new/settings/settings-container';
import { SettingsRow } from '@/ds/new/settings/settings-row';

const INSTRUCTIONS = `## Role

You work in the connected repository. Read AGENTS.md before you change code.

## When to stop and ask

- A change touches auth, billing or a migration.`;

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
    content: <MarkdownEditor variant="inline" value={INSTRUCTIONS} onChange={() => undefined} />,
  },
  {
    id: 'tools',
    title: 'Tools',
    summary: 'Optional',
    content: (
      <SettingsContainer>
        <SettingsRow label="GitHub" description="Read the repository and open pull requests">
          <Switch aria-label="GitHub" defaultChecked />
        </SettingsRow>
        <SettingsRow label="Linear" description="Read and update issues">
          <Switch aria-label="Linear" />
        </SettingsRow>
        <SettingsRow label="Web search">
          <Switch aria-label="Web search" defaultChecked />
        </SettingsRow>
      </SettingsContainer>
    ),
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
