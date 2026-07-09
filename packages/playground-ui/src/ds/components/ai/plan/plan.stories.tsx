import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, MessageSquareText, XIcon } from 'lucide-react';

import { Button } from '../../Button';
import { TooltipProvider } from '../../Tooltip';
import {
  Plan,
  PlanActionGroup,
  PlanBody,
  PlanContent,
  PlanControls,
  PlanCopyButton,
  PlanExpandButton,
  PlanFile,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanStatus,
  PlanTitle,
} from './plan';

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
      <PlanBody>
        <PlanContent>{markdown}</PlanContent>
      </PlanBody>
    </Plan>
  );
}
\`\`\``;

const longPlanMarkdown = Array.from({ length: 12 }, (_, index) => `${index + 1}. Verify step ${index + 1}.`).join('\n');

const meta: Meta<typeof Plan> = {
  title: 'AI/Plan',
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
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          <PlanCopyButton
            content={`Review migration plan\n\nFile: /workspace/.mastracode/plans/migration.md\n\n${planMarkdown}`}
          />
        </PlanHeaderActions>
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>Review migration plan</PlanTitle>
          <PlanPath>/workspace/.mastracode/plans/migration.md</PlanPath>
        </PlanIntro>
        <PlanMain>
          <PlanContent>{planMarkdown}</PlanContent>
          <PlanControls />
        </PlanMain>
      </PlanBody>
    </Plan>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <Plan collapsedHeight={160}>
      <PlanHeader>
        <PlanLabel />
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>Review generated plan</PlanTitle>
          <PlanPath>/workspace/.mastracode/plans/generated-plan.md</PlanPath>
        </PlanIntro>
        <PlanMain>
          <PlanContent>{`## Checklist\n\n${longPlanMarkdown}`}</PlanContent>
          <PlanControls />
        </PlanMain>
      </PlanBody>
    </Plan>
  ),
};

export const FileUnavailable: Story = {
  render: () => (
    <Plan>
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          <PlanStatus variant="warning">Missing</PlanStatus>
        </PlanHeaderActions>
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>Plan file unavailable</PlanTitle>
          <PlanPath>/workspace/.mastracode/plans/missing.md</PlanPath>
        </PlanIntro>
        <PlanMain>
          <PlanFile>/workspace/.mastracode/plans/missing.md</PlanFile>
        </PlanMain>
      </PlanBody>
    </Plan>
  ),
};

export const WithStatusAndActions: Story = {
  render: () => (
    <Plan>
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          <PlanStatus variant="info">Pending</PlanStatus>
          <PlanCopyButton content={planMarkdown} />
        </PlanHeaderActions>
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>Approve submit_plan output</PlanTitle>
          <PlanPath>/workspace/.mastracode/plans/submit-plan.md</PlanPath>
        </PlanIntro>
        <PlanMain>
          <PlanContent>{planMarkdown}</PlanContent>
          <PlanControls>
            <PlanActionGroup className="justify-end">
              <Button type="button" variant="primary" size="icon-sm" tooltip="Reject plan" aria-label="Reject plan">
                <XIcon />
              </Button>
            </PlanActionGroup>
            <PlanExpandButton />
            <PlanActionGroup>
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
            </PlanActionGroup>
          </PlanControls>
        </PlanMain>
      </PlanBody>
    </Plan>
  ),
};
