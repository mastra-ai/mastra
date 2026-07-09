import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, MessageSquareText, XIcon } from 'lucide-react';

import { Button } from '../Button';
import { TooltipProvider } from '../Tooltip';
import { Plan } from './plan-compound';

const planMarkdown = `## Implementation

1. Move the reusable plan preview into the shared UI package.
2. Keep approval-specific behavior in the consuming application.
3. Add a Storybook fixture so the shared surface can be reviewed on its own.

## Validation

- Run the package test suite.
- Build the package.
- Build Storybook.

\`\`\`ts
export function renderPlan(markdown: string) {
  return (
    <Plan>
      <Plan.Body>
        <Plan.Content>{markdown}</Plan.Content>
      </Plan.Body>
    </Plan>
  );
}
\`\`\``;

const longPlanMarkdown = Array.from({ length: 12 }, (_, index) => `${index + 1}. Verify step ${index + 1}.`).join('\n');

const meta: Meta<typeof Plan> = {
  title: 'Composite/Plan',
  component: Plan,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="w-full max-w-180 p-4">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Plan>;

export const Default: Story = {
  render: () => (
    <Plan>
      <Plan.Header>
        <Plan.Label />
        <Plan.HeaderActions>
          <Plan.CopyButton
            content={`Review migration plan\n\nFile: /workspace/.mastracode/plans/migration.md\n\n${planMarkdown}`}
          />
        </Plan.HeaderActions>
      </Plan.Header>
      <Plan.Body>
        <Plan.Intro>
          <Plan.Title>Review migration plan</Plan.Title>
          <Plan.Path>/workspace/.mastracode/plans/migration.md</Plan.Path>
        </Plan.Intro>
        <Plan.Main>
          <Plan.Content>{planMarkdown}</Plan.Content>
          <Plan.Controls />
        </Plan.Main>
      </Plan.Body>
    </Plan>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <Plan collapsedHeight={160}>
      <Plan.Header>
        <Plan.Label />
      </Plan.Header>
      <Plan.Body>
        <Plan.Intro>
          <Plan.Title>Review generated plan</Plan.Title>
          <Plan.Path>/workspace/.mastracode/plans/generated-plan.md</Plan.Path>
        </Plan.Intro>
        <Plan.Main>
          <Plan.Content>{`## Checklist\n\n${longPlanMarkdown}`}</Plan.Content>
          <Plan.Controls />
        </Plan.Main>
      </Plan.Body>
    </Plan>
  ),
};

export const FileUnavailable: Story = {
  render: () => (
    <Plan>
      <Plan.Header>
        <Plan.Label />
        <Plan.HeaderActions>
          <Plan.Status variant="warning">Missing</Plan.Status>
        </Plan.HeaderActions>
      </Plan.Header>
      <Plan.Body>
        <Plan.Intro>
          <Plan.Title>Plan file unavailable</Plan.Title>
          <Plan.Path>/workspace/.mastracode/plans/missing.md</Plan.Path>
        </Plan.Intro>
        <Plan.Main>
          <Plan.File>/workspace/.mastracode/plans/missing.md</Plan.File>
        </Plan.Main>
      </Plan.Body>
    </Plan>
  ),
};

export const WithStatusAndActions: Story = {
  render: () => (
    <Plan>
      <Plan.Header>
        <Plan.Label />
        <Plan.HeaderActions>
          <Plan.Status variant="info">Pending</Plan.Status>
          <Plan.CopyButton content={planMarkdown} />
        </Plan.HeaderActions>
      </Plan.Header>
      <Plan.Body>
        <Plan.Intro>
          <Plan.Title>Approve `submit_plan` output</Plan.Title>
          <Plan.Path>/workspace/.mastracode/plans/submit-plan.md</Plan.Path>
        </Plan.Intro>
        <Plan.Main>
          <Plan.Content>{planMarkdown}</Plan.Content>
          <Plan.Controls>
            <Plan.ActionGroup className="justify-end">
              <Button type="button" variant="primary" size="icon-sm" tooltip="Reject plan" aria-label="Reject plan">
                <XIcon />
              </Button>
            </Plan.ActionGroup>
            <Plan.ExpandButton />
            <Plan.ActionGroup>
              <Button
                type="button"
                variant="primary"
                size="icon-sm"
                tooltip="Request changes"
                aria-label="Request changes"
              >
                <MessageSquareText />
              </Button>
              <Button type="button" variant="primary" size="icon-sm" tooltip="Approve plan" aria-label="Approve plan">
                <CheckIcon />
              </Button>
            </Plan.ActionGroup>
          </Plan.Controls>
        </Plan.Main>
      </Plan.Body>
    </Plan>
  ),
};
