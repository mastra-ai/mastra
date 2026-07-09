import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, MessageSquareText, XIcon } from 'lucide-react';

import { Button } from '../Button';
import { TooltipProvider } from '../Tooltip';
import { Plan } from './plan';

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
  return <Plan title="Review plan">{markdown}</Plan>;
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
  args: {
    title: 'Review migration plan',
    path: '/workspace/.mastracode/plans/migration.md',
    copyContent: `Review migration plan\n\nFile: /workspace/.mastracode/plans/migration.md\n\n${planMarkdown}`,
    children: planMarkdown,
  },
};

export const Collapsed: Story = {
  args: {
    title: 'Review generated plan',
    path: '/workspace/.mastracode/plans/generated-plan.md',
    collapsedHeight: 160,
    children: `## Checklist\n\n${longPlanMarkdown}`,
  },
};

export const FileUnavailable: Story = {
  args: {
    title: 'Plan file unavailable',
    path: '/workspace/.mastracode/plans/missing.md',
    status: { label: 'Missing', variant: 'warning' },
  },
};

export const WithStatusAndActions: Story = {
  render: () => (
    <Plan
      title="Approve \`submit_plan\` output"
      path="/workspace/.mastracode/plans/submit-plan.md"
      status={{ label: 'Pending', variant: 'info' }}
      copyContent={planMarkdown}
      leftActions={
        <Button type="button" variant="primary" size="icon-sm" tooltip="Reject plan" aria-label="Reject plan">
          <XIcon />
        </Button>
      }
      rightActions={
        <>
          <Button type="button" variant="primary" size="icon-sm" tooltip="Request changes" aria-label="Request changes">
            <MessageSquareText />
          </Button>
          <Button type="button" variant="primary" size="icon-sm" tooltip="Approve plan" aria-label="Approve plan">
            <CheckIcon />
          </Button>
        </>
      }
    >
      {planMarkdown}
    </Plan>
  ),
};
