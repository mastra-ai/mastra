import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollableContainer } from './scrollable-container';

const meta: Meta<typeof ScrollableContainer> = {
  title: 'Layout/ScrollableContainer',
  component: ScrollableContainer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    scrollSpeed: {
      control: { type: 'number' },
    },
    scrollIntervalTime: {
      control: { type: 'number' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScrollableContainer>;

export const Default: Story = {
  render: () => (
    <div className="w-[400px] h-[100px] border border-border1 rounded-md">
      <ScrollableContainer className="h-full">
        <div className="flex gap-4 p-4 w-[1000px]">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-16 w-24 shrink-0 rounded-md bg-surface4 flex items-center justify-center">
              <span className="text-sm text-neutral5">Item {i + 1}</span>
            </div>
          ))}
        </div>
      </ScrollableContainer>
    </div>
  ),
};

export const CardGallery: Story = {
  render: () => (
    <div className="w-[500px] border border-border1 rounded-md">
      <ScrollableContainer>
        <div className="flex gap-4 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-32 w-48 shrink-0 rounded-lg bg-surface3 border border-border1 p-4 flex flex-col justify-between"
            >
              <span className="text-sm font-medium text-neutral6">Card {i + 1}</span>
              <span className="text-xs text-neutral3">Description text</span>
            </div>
          ))}
        </div>
      </ScrollableContainer>
    </div>
  ),
};

export const FastScroll: Story = {
  render: () => (
    <div className="w-[400px] h-[80px] border border-border1 rounded-md">
      <ScrollableContainer scrollSpeed={200} scrollIntervalTime={10}>
        <div className="flex gap-2 p-2 w-[1200px]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-12 w-12 shrink-0 rounded-md bg-surface4 flex items-center justify-center">
              <span className="text-xs text-neutral5">{i + 1}</span>
            </div>
          ))}
        </div>
      </ScrollableContainer>
    </div>
  ),
};

export const SlowScroll: Story = {
  render: () => (
    <div className="w-[400px] h-[80px] border border-border1 rounded-md">
      <ScrollableContainer scrollSpeed={30} scrollIntervalTime={50}>
        <div className="flex gap-2 p-2 w-[1000px]">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="h-12 w-12 shrink-0 rounded-md bg-surface4 flex items-center justify-center">
              <span className="text-xs text-neutral5">{i + 1}</span>
            </div>
          ))}
        </div>
      </ScrollableContainer>
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="w-[350px] border border-border1 rounded-md p-2">
      <ScrollableContainer>
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
            <span key={tech} className="shrink-0 px-3 py-1 text-xs rounded-full bg-surface4 text-neutral5">
              {tech}
            </span>
          ))}
        </div>
      </ScrollableContainer>
    </div>
  ),
};
