import type { Meta, StoryObj } from '@storybook/react-vite';
import { Steps } from './steps';
import { Button } from '@/ds/components/Button';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconKey1 } from '@/ds/icons/central/IconKey1';

const meta: Meta<typeof Steps> = {
  title: 'Navigation/Steps/Guide',
  component: Steps,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Steps>;

const ENV = 'MASTRA_GATEWAY_API_KEY=msk_YOUR_API_KEY';

export const Default: Story = {
  render: () => (
    <Steps>
      <Steps.Step title="Create an API key">
        <div>
          <Button variant="primary" size="md">
            <IconKey1 />
            Create API key
          </Button>
        </div>
        <CodeBlock code={ENV} lang="bash" />
      </Steps.Step>
      <Steps.Step title="Install the SDK" description="Run this from the root of your project.">
        <CodeBlock code="pnpm add @mastra/core" lang="bash" />
      </Steps.Step>
      <Steps.Step title="Send your first request" />
    </Steps>
  ),
};

export const InProgress: Story = {
  render: () => (
    <Steps>
      <Steps.Step title="Create an API key" done>
        <CodeBlock code={ENV} lang="bash" />
      </Steps.Step>
      <Steps.Step title="Add credits" done />
      <Steps.Step
        title="Connect your project"
        description="Paste this into your coding agent, or copy the snippet for your stack."
        action={
          <Button size="sm" iconEnd={<IconArrowUpRight />}>
            Docs
          </Button>
        }
      >
        <CodeBlock code="pnpm add @mastra/core" lang="bash" />
      </Steps.Step>
      <Steps.Step title="Send your first request" />
    </Steps>
  ),
};

export const ConditionalSteps: Story = {
  render: () => (
    <Steps>
      <Steps.Step title="Deploy Studio" />
      {false ? <Steps.Step title="Skipped step" /> : null}
      <Steps.Step title="Deploy the server" description="Numbers follow the steps that render." />
    </Steps>
  ),
};
