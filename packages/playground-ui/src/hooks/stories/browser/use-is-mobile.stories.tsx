import type { Meta, StoryObj } from '@storybook/react-vite';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';

function IsMobileDemo({ breakpoint }: { breakpoint: number }) {
  const isMobile = useIsMobile(breakpoint);
  return (
    <HookDemo>
      <Txt>Resize the canvas or change the breakpoint in Controls.</Txt>
      <Txt role="status">
        {isMobile ? 'Mobile layout' : 'Desktop layout'} · breakpoint: {breakpoint}px
      </Txt>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useIsMobile',
  component: IsMobileDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Matches viewport widths below the breakpoint (1024px by default). Storybook canvas width is the viewport observed by the hook. Import from `@mastra/playground-ui/hooks/use-is-mobile`.',
      },
    },
  },
  args: { breakpoint: 1024 },
  argTypes: { breakpoint: { control: { type: 'range', min: 320, max: 1600, step: 1 } } },
} satisfies Meta<typeof IsMobileDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
