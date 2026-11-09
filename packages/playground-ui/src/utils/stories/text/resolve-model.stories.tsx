import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { resolveModel } from '@/utils/model';

const calls = [
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-sonnet-4-5-20250929',
  'openai.responses/gpt-5-mini',
  'openai/gpt-4o-2024-08-06',
  'openai/o3-mini',
  'google/gemini-2.5-flash-preview-09-2025',
  'xai/grok-4-fast',
  'openrouter/meta-llama/llama-3.1-70b-instruct',
  'gpt-oss-120b',
];

const examples: HelperExample[] = [
  ...calls.map((value): HelperExample => [`resolveModel('${value}').modelName`, resolveModel(value).modelName]),
  ...['anthropic/claude-sonnet-4.5', 'openai.responses/gpt-5-mini', 'fireworks-ai/kimi-k2', 'acme-labs/model-1'].map(
    (value): HelperExample => [`resolveModel('${value}').providerName`, resolveModel(value).providerName],
  ),
  ["resolveModel('gpt-oss-120b').provider", resolveModel('gpt-oss-120b').provider],
];

const meta = {
  title: 'Helpers/resolveModel',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Splits a model string into `provider` and `model` and adds readable `providerName` and `modelName`. A model with no provider has no `provider` or `providerName`. Import from `@mastra/playground-ui/utils/model`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
