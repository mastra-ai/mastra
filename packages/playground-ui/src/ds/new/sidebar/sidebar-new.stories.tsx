import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  SidebarNewStoryContent,
  SidebarNewStoryShortcuts,
} from '../../../../.storybook/fixtures/sidebar/sidebar-new-story-content';
import type { SidebarNewStoryContentProps } from '../../../../.storybook/fixtures/sidebar/sidebar-new-story-content';
import { SidebarNew } from '.';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { KeyboardShortcutsProvider } from '@/lib/keyboard/keyboard-shortcuts-context';

const meta: Meta<typeof SidebarNew> = {
  title: 'New/SidebarNew',
  component: SidebarNew,
  decorators: [
    (Story, context) => (
      <KeyboardShortcutsProvider>
        <SidebarNew.Provider
          defaultWidth={240}
          minWidth={200}
          maxWidth={480}
          collapseBelow={180}
          storageKey={`sidebar-new-story:${context.id}`}
        >
          <SidebarNewStoryShortcuts />
          <TooltipProvider>
            <Story />
          </TooltipProvider>
        </SidebarNew.Provider>
      </KeyboardShortcutsProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The reference for sidebar behavior: headers, collapse and expand, navigation stacks, account menus, and footer metadata. Use Header for contextual product controls or CommandHeader for compact brand and search utilities. For full-page composition and responsive chrome, see [Layout / AppLayout](?path=/docs/layout-applayout--docs). Both story groups reuse the same sidebar content fixture rather than maintaining separate navigation examples.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SidebarNew>;

function SidebarNewStory(props: SidebarNewStoryContentProps) {
  return (
    <div className="new-theme bg-background flex h-dvh w-dvw">
      <SidebarNew className="border-border border-r">
        <SidebarNewStoryContent {...props} />
      </SidebarNew>

      <main className="min-w-0 flex-1 p-6">
        <SidebarNew.MobileTrigger className="mb-4" />
        <h1 className="text-header-md text-foreground font-medium">Main content</h1>
        <p className="text-ui-md text-muted-foreground mt-2">
          Product navigation stays compact while route-derived views take over the sidebar body.
        </p>
      </main>
    </div>
  );
}

export const Default: Story = {
  render: () => <SidebarNewStory />,
  parameters: {
    docs: {
      description: {
        story:
          'The standard header keeps contextual controls and collapse together. It does not include global search.',
      },
    },
  },
};

export const CommandHeader: Story = {
  render: () => <SidebarNewStory header="command" />,
  parameters: {
    docs: {
      description: {
        story:
          'The optional command header pairs compact product identity with a global search trigger. Collapse moves to the footer.',
      },
    },
  },
};

export const SelfHostedCommandHeader: Story = {
  render: () => <SidebarNewStory header="command" version="Mastra v0.24.6" />,
  parameters: {
    docs: {
      description: {
        story:
          'Self-hosted products may add their running version through FooterMeta without changing the sidebar root API.',
      },
    },
  },
};
