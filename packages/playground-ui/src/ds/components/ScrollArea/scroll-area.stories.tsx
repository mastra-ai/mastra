import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from './scroll-area';

const meta: Meta<typeof ScrollArea> = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-[200px] w-[300px] rounded-md border border-border1 p-4">
      <div className="space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-sm text-neutral5">
            Item {i + 1} - Lorem ipsum dolor sit amet
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const WithMaxHeight: Story = {
  render: () => (
    <ScrollArea maxHeight="150px" className="w-[300px] rounded-md border border-border1 p-4">
      <div className="space-y-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <p key={i} className="text-sm text-neutral5">
            Line {i + 1}
          </p>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const HorizontalScroll: Story = {
  render: () => (
    <ScrollArea className="h-[100px] w-[300px] rounded-md border border-border1 p-4">
      <div className="flex gap-4 w-[800px]">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="h-16 w-16 shrink-0 rounded-md bg-surface4 flex items-center justify-center">
            <span className="text-sm text-neutral5">{i + 1}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <ScrollArea className="h-[200px] w-[400px] rounded-md border border-border1 bg-surface2">
      <pre className="p-4 text-sm font-mono text-neutral5">
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
    <ScrollArea className="h-[300px] w-[350px] rounded-md border border-border1 p-4">
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`p-3 rounded-lg ${i % 2 === 0 ? 'bg-surface3 ml-8' : 'bg-surface4 mr-8'}`}>
            <p className="text-sm text-neutral5">
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
