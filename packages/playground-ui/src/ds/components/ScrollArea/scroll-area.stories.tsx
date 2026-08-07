import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from './scroll-area';

const meta: Meta<typeof ScrollArea> = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  render: () => (
    <ScrollArea className="w-dropdown-max-height border-border1 h-50 rounded-md border p-4">
      <div className="space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-neutral5 text-sm">
            Item {i + 1} - Lorem ipsum dolor sit amet
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const WithMaxHeight: Story = {
  render: () => (
    <ScrollArea maxHeight="150px" className="w-dropdown-max-height border-border1 rounded-md border p-4">
      <div className="space-y-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <p key={i} className="text-neutral5 text-sm">
            Line {i + 1}
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const HorizontalScroll: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" className="w-dropdown-max-height border-border1 h-25 rounded-md border p-4">
      <div className="flex w-200 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="bg-surface4 flex size-16 shrink-0 items-center justify-center rounded-md">
            <span className="text-neutral5 text-sm">{i + 1}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const HorizontalScrollButtons: Story = {
  render: () => (
    <ScrollArea
      orientation="horizontal"
      scrollButtons
      className="w-dropdown-max-height border-border1 h-25 rounded-md border p-4"
    >
      <div className="flex w-200 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="bg-surface4 flex size-16 shrink-0 items-center justify-center rounded-md">
            <span className="text-neutral5 text-sm">{i + 1}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Badges: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" scrollButtons className="border-border1 w-[350px] rounded-md border p-2">
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
          <span key={tech} className="bg-surface4 text-neutral5 shrink-0 rounded-full px-3 py-1 text-xs">
            {tech}
          </span>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <ScrollArea orientation="both" className="border-border1 bg-surface2 h-50 w-100 rounded-md border">
      <pre className="text-neutral5 p-4 font-mono text-sm">
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

export const ChatMessages: Story = {
  render: () => (
    <ScrollArea className="h-dropdown-max-height border-border1 w-[350px] rounded-md border p-4">
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`rounded-lg p-3 ${i % 2 === 0 ? 'bg-surface3 ml-8' : 'bg-surface4 mr-8'}`}>
            <p className="text-neutral5 text-sm">
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
      <p key={i} className="text-neutral5 text-sm">
        Item {i + 1} — Lorem ipsum dolor sit amet
      </p>
    ))}
  </div>
);

export const MaskDisabled: Story = {
  name: 'Mask / disabled',
  render: () => (
    <ScrollArea mask={false} className="border-border1 h-50 w-65 rounded-md border p-4">
      <MaskItems />
    </ScrollArea>
  ),
};

export const MaskTopOnly: Story = {
  name: 'Mask / top only',
  render: () => (
    <ScrollArea mask={{ bottom: false }} className="border-border1 h-50 w-65 rounded-md border p-4">
      <MaskItems />
    </ScrollArea>
  ),
};

export const MaskBothAxes: Story = {
  name: 'Mask / both axes (orientation=both)',
  render: () => (
    <ScrollArea orientation="both" className="border-border1 h-50 w-65 rounded-md border p-4">
      <div className="w-150 space-y-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-neutral5 text-sm whitespace-nowrap">
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
    <ScrollArea orientation="both" mask={{ x: false }} className="border-border1 h-50 w-65 rounded-md border p-4">
      <div className="w-150 space-y-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-neutral5 text-sm whitespace-nowrap">
            Row {i + 1} — long horizontal content
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};
