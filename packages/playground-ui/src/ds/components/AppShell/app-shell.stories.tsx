import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppShell } from './app-shell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

const Sidebar = () => (
  <nav className="text-icon4 text-ui-sm flex h-full w-56 flex-col gap-2 px-4 pt-3">
    <span>Overview</span>
    <span>Board</span>
    <span>Settings</span>
  </nav>
);

const Header = () => (
  <header className="text-icon5 border-border1 text-ui-sm flex h-11 items-center border-b px-5">Session header</header>
);

const Paragraphs = ({ count }: { count: number }) => (
  <div className="text-icon4 text-ui-md flex max-w-2xl flex-col gap-4">
    {Array.from({ length: count }, (_, index) => (
      <p key={index}>Paragraph {index + 1} — tall enough to overflow, so the scroll owner shows itself.</p>
    ))}
  </div>
);

export const DocumentScroll: Story = {
  name: 'The page scrolls',
  render: () => (
    <AppShell scroll="document" sidebar={<Sidebar />} header={<Header />}>
      <Paragraphs count={40} />
    </AppShell>
  ),
};

export const ViewportScroll: Story = {
  name: 'The content scrolls',
  render: () => (
    <AppShell scroll="viewport" sidebar={<Sidebar />} header={<Header />}>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <Paragraphs count={40} />
      </div>
    </AppShell>
  ),
};
