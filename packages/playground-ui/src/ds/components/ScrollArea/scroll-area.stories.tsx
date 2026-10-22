import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { Badge } from '../Badge';
import { ScrollArea, ScrollAreaViewport } from './scroll-area';

const meta: Meta<typeof ScrollArea> = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

const expectNativeHorizontalGestures: Story['play'] = async ({ canvasElement }) => {
  const viewport = canvasElement.querySelector<HTMLElement>('[role="presentation"] > [role="presentation"]');
  if (!viewport) throw new Error('Expected the scroll viewport');
  await expect(getComputedStyle(viewport).overscrollBehaviorX).toBe('auto');
  for (const deltaX of [-100, 100]) {
    const wheel = new WheelEvent('wheel', { deltaX, bubbles: true, cancelable: true });
    viewport.dispatchEvent(wheel);
    await expect(wheel.defaultPrevented).toBe(false);
  }
};

export const Default: Story = {
  play: expectNativeHorizontalGestures,
  render: () => (
    <ScrollArea className="h-50 w-75 rounded-md border border-border p-4">
      <div className="space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-body text-foreground">
            Item {i + 1} - Lorem ipsum dolor sit amet
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const WithMaxHeight: Story = {
  render: () => (
    <ScrollArea maxHeight="150px" className="w-75 rounded-md border border-border p-4">
      <div className="space-y-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <p key={i} className="text-body text-foreground">
            Line {i + 1}
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const CustomViewport: Story = {
  play: expectNativeHorizontalGestures,
  render: () => (
    <ScrollArea maxHeight="150px" className="w-75 rounded-md border border-border">
      <ScrollAreaViewport className="overscroll-y-contain px-4 py-2">
        <div className="space-y-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <p key={i} className="text-body text-foreground">
              Line {i + 1}
            </p>
          ))}
        </div>
      </ScrollAreaViewport>
    </ScrollArea>
  ),
};

export const HorizontalScroll: Story = {
  play: async context => {
    await expectNativeHorizontalGestures(context);
    const { canvasElement } = context;
    const viewport = canvasElement.querySelector<HTMLElement>('[role="presentation"] > [role="presentation"]');
    if (!viewport) throw new Error('Expected the scroll viewport');
    const getScrollbar = () => canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]');
    await waitFor(() => expect(getScrollbar()).not.toBeNull());
    const scrollbar = getScrollbar();
    if (!scrollbar) throw new Error('Expected the horizontal scrollbar');
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    await expect(maxScroll).toBeGreaterThan(0);

    // The scrollbar may consume horizontal wheel input only while it can move.
    for (const [position, deltaX, consumed] of [
      [0, -100, false],
      [maxScroll, 100, false],
      [0, 100, true],
    ] as const) {
      viewport.scrollLeft = position;
      const wheel = new WheelEvent('wheel', { deltaX, bubbles: true, cancelable: true });
      scrollbar.dispatchEvent(wheel);
      await expect(wheel.defaultPrevented).toBe(consumed);
    }
    await expect(viewport.scrollLeft).toBeGreaterThan(0);
    viewport.scrollLeft = 0;
  },
  render: () => (
    <ScrollArea orientation="horizontal" className="h-25 w-75 rounded-md border border-border p-4">
      <div className="flex w-200 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted">
            <span className="text-body text-foreground">{i + 1}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const HorizontalScrollButtons: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" scrollButtons className="h-25 w-75 rounded-md border border-border p-4">
      <div className="flex w-200 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted">
            <span className="text-body text-foreground">{i + 1}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Badges: Story = {
  render: () => (
    <ScrollArea
      orientation="horizontal"
      scrollButtons
      className="w-[350px] max-w-[calc(100vw-2rem)] rounded-md border border-border p-2"
    >
      <div className="flex gap-2 py-1">
        {[
          'React',
          'TypeScript',
          'Node.js',
          'GraphQL',
          'PostgreSQL',
          'Redis',
          'Docker',
          'Kubernetes',
          'AWS',
          'Vercel',
          'Next.js',
          'Tailwind',
        ].map(tech => (
          <Badge key={tech}>{tech}</Badge>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const CodeBlock: Story = {
  play: expectNativeHorizontalGestures,
  render: () => (
    <ScrollArea orientation="both" className="h-50 w-100 rounded-md border border-border bg-background">
      <pre className="p-4 font-mono text-body text-foreground">
        {`function example() {
 const data = fetchData();

 if (data.isValid) {
 processData(data);
 } else {
 handleError(data.error);
 }

 return {
 status: 'success',
 timestamp: Date.now(),
 results: data.results,
 metadata: {
 version: '1.0',
 format: 'json',
 encoding: 'utf-8'
 }
 };
}

// Additional code to show scrolling
const config = {
 apiKey: 'xxx',
 endpoint: '/api/v1',
 timeout: 5000,
 retries: 3
};`}
      </pre>
    </ScrollArea>
  ),
};

export const WithoutOverflow: Story = {
  render: ({ orientation }) => (
    <ScrollArea orientation={orientation} className="h-50 w-75">
      <p className="text-body">A short message with no overflow.</p>
    </ScrollArea>
  ),
  play: async context => {
    await expectNativeHorizontalGestures(context);
    const viewport = context.canvasElement.querySelector<HTMLElement>('[role="presentation"] > [role="presentation"]');
    if (!viewport) throw new Error('Expected the scroll viewport');
    await expect(viewport.scrollWidth).toBe(viewport.clientWidth);
    await expect(viewport.scrollHeight).toBe(viewport.clientHeight);
  },
};

export const HorizontalWithoutOverflow: Story = {
  ...WithoutOverflow,
  args: { orientation: 'horizontal' },
};

export const BothAxesWithoutOverflow: Story = {
  ...WithoutOverflow,
  args: { orientation: 'both' },
};

export const ChatMessages: Story = {
  render: () => (
    <ScrollArea className="h-75 w-[350px] rounded-md border border-border p-4">
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`rounded-lg p-3 ${i % 2 === 0 ? 'ml-8 bg-card' : 'mr-8 bg-muted'}`}>
            <p className="text-body text-foreground">
              {i % 2 === 0
                ? 'This is a user message with some content'
                : 'This is an assistant response with helpful information'}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

const MaskItems = () => (
  <div className="space-y-3">
    {Array.from({ length: 20 }).map((_, i) => (
      <p key={i} className="text-body text-foreground">
        Item {i + 1} — Lorem ipsum dolor sit amet
      </p>
    ))}
  </div>
);

export const MaskDisabled: Story = {
  name: 'Mask / disabled',
  render: () => (
    <ScrollArea mask={false} className="h-50 w-65 rounded-md border border-border p-4">
      <MaskItems />
    </ScrollArea>
  ),
};

export const MaskTopOnly: Story = {
  name: 'Mask / top only',
  render: () => (
    <ScrollArea mask={{ bottom: false }} className="h-50 w-65 rounded-md border border-border p-4">
      <MaskItems />
    </ScrollArea>
  ),
};

export const MaskBothAxes: Story = {
  name: 'Mask / both axes (orientation=both)',
  render: () => (
    <ScrollArea orientation="both" className="h-50 w-65 rounded-md border border-border p-4">
      <div className="w-150 space-y-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-body whitespace-nowrap text-foreground">
            Row {i + 1} — long horizontal content stretching past the viewport for x-axis overflow
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const MaskYOnly: Story = {
  name: 'Mask / y axis only (no horizontal fade)',
  render: () => (
    <ScrollArea orientation="both" mask={{ x: false }} className="h-50 w-65 rounded-md border border-border p-4">
      <div className="w-150 space-y-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-body whitespace-nowrap text-foreground">
            Row {i + 1} — long horizontal content
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};
