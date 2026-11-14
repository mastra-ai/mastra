import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';
import { useGatewayAudioModels } from '@/hooks/use-gateway-audio-models';

const queryClient = new QueryClient();

function GatewayAudioModelsDemo() {
  const { data, fetchStatus } = useGatewayAudioModels('https://gateway.example', false);

  return (
    <HookDemo>
      <Txt>Gateway audio requires an injected V2 key and access for the signed-in user.</Txt>
      <Txt role="status">{data ? 'Audio models available' : `Audio models hidden (${fetchStatus})`}</Txt>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useGatewayAudioModels',
  component: GatewayAudioModelsDemo,
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shows the disabled state without making a live Gateway request. Import from `@mastra/playground-ui/hooks/use-gateway-audio-models`.',
      },
    },
  },
} satisfies Meta<typeof GatewayAudioModelsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disabled: Story = {};
