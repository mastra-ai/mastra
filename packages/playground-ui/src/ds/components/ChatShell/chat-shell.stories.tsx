import type { Meta, StoryObj } from '@storybook/react-vite';

import { Notice } from '../Notice';
import { ChatShell } from './index';

const meta: Meta<typeof ChatShell> = {
  title: 'Layout/ChatShell',
  component: ChatShell,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ChatShell>;

const gitRemoteFailure =
  "Failed to prepare the workspace: Failed to set git remote: error: could not lock config file .git/config: File exists fatal: could not set 'remote.origin.url' to 'https://x-access-token:ghs_EXAMPLEtokenaGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9eyJhdWQiOiJhdXRobiIsImRpZ2VzdCI6IlF2QzJWbmNsIjNkbFZtbFBNUXJleDhxdnl2d1RMZ0Z2N2FQbXVlTnJ1TGVn@github.com/mastra-ai/mastra.git'";

const SessionBar = () => (
  <header className="text-icon5 border-border1 text-ui-sm flex items-center gap-2 border-b px-3 py-2 md:px-5">
    Work / Issue #20383: Testing our webhooks
  </header>
);

const Composer = () => (
  <div className="text-icon3 border-border2/40 bg-surface3 rounded-[22px] border px-4 py-3">Ask Mastra Code…</div>
);

const Turn = ({ children }: { children: React.ReactNode }) => (
  <div className="text-icon5 text-ui-md py-3 leading-relaxed">{children}</div>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-surface2 flex h-dvh flex-col">
    <ChatShell className="flex-1 [--chat-column:44rem]" scroller={{ autoScroll: true }}>
      <ChatShell.Bar>
        <SessionBar />
      </ChatShell.Bar>
      <ChatShell.Stage>
        <ChatShell.Viewport>
          <ChatShell.Content className="gap-0 pt-6">
            <ChatShell.Column className="flex-1">{children}</ChatShell.Column>
          </ChatShell.Content>
          <ChatShell.Dock>
            <ChatShell.ScrollButton />
            <ChatShell.Column>
              <Composer />
            </ChatShell.Column>
          </ChatShell.Dock>
        </ChatShell.Viewport>
      </ChatShell.Stage>
    </ChatShell>
  </div>
);

export const ShortThread: Story = {
  render: () => (
    <Shell>
      <Turn>A thread short enough that nothing scrolls — the composer still sits at the bottom edge.</Turn>
    </Shell>
  ),
};

export const LongThread: Story = {
  render: () => (
    <Shell>
      {Array.from({ length: 30 }, (_, index) => (
        <Turn key={index}>
          Turn {index + 1}. Scroll to the bottom: the last turn passes under the composer instead of stopping short of
          it, and the jump-to-latest button clears the dock.
        </Turn>
      ))}
    </Shell>
  ),
};

export const UnbreakableTokenInColumn: Story = {
  render: () => (
    <Shell>
      <Notice variant="destructive">{gitRemoteFailure}</Notice>
      <Turn>The notice shares the composer&apos;s column and axis, whatever the message contains.</Turn>
    </Shell>
  ),
};
