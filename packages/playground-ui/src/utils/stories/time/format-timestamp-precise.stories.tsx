import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelperExamples } from '../../../../.storybook/fixtures/helpers/helper-examples';
import type { HelperExample } from '../../../../.storybook/fixtures/helpers/helper-examples';
import { formatTimestampPrecise } from '@/utils/date-format';

const now = Date.UTC(2026, 8, 24, 12);

const examples: HelperExample[] = [
  ["formatTimestampPrecise(now + 123, { locale: 'en-US' })", formatTimestampPrecise(now + 123, { locale: 'en-US' })],
  [
    "formatTimestampPrecise(now + 123, { locale: 'en-US', withDate: false })",
    formatTimestampPrecise(now + 123, { locale: 'en-US', withDate: false }),
  ],
];

const meta = {
  title: 'Helpers/formatTimestampPrecise',
  component: HelperExamples,
  args: { examples },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Date and time down to milliseconds in the viewer’s time zone, for trace debugging. `withDate: false` keeps only the time. Examples use `now` = Sep 24, 2026 12:00 UTC. Import from `@mastra/playground-ui/utils/date-format`.',
      },
    },
  },
} satisfies Meta<typeof HelperExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
