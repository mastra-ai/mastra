import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { UserFilePartRenderer } from '../messages/renderers/user-file-part-renderer';
import { ChatShell } from '@/ds/components/ChatShell';
import { Message } from '@/ds/components/Message';
import { MessageScrollerItem } from '@/ds/components/MessageScroller';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const imageSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#d8ede3"/><circle cx="160" cy="80" r="48" fill="#326b50"/><path d="m136 80 16 16 32-32" fill="none" stroke="#d8ede3" stroke-width="8"/></svg>';

function AttachmentFocusChat({ factory = false }: { factory?: boolean }) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <ChatShell className="flex-1">
        <ChatShell.Bar>
          <header className="border-b px-4 py-3 text-body">{factory ? 'Factory' : 'Studio'} chat</header>
        </ChatShell.Bar>
        <ChatShell.Stage>
          <ChatShell.Viewport>
            <ChatShell.Content>
              <ChatShell.Column className="gap-4 py-4">
                <Message from="user">Hello there!</Message>
                <Message from="assistant">Hello! How can I assist you today?</Message>
                <MessageScrollerItem className={factory ? '[content-visibility:visible]' : undefined}>
                  <Message
                    from="user"
                    attachments={
                      <UserFilePartRenderer
                        part={{
                          type: 'file',
                          mimeType: 'image/svg+xml',
                          data: `data:image/svg+xml,${encodeURIComponent(imageSvg)}`,
                        }}
                      />
                    }
                  >
                    Can you see this image?
                  </Message>
                </MessageScrollerItem>
                <Message from="assistant">Yes, I can see the image you uploaded.</Message>
              </ChatShell.Column>
            </ChatShell.Content>
            <ChatShell.Dock>
              <ChatShell.Column>
                <textarea
                  aria-label="Message"
                  placeholder="Enter your message…"
                  className={`${raisedSurfaceStyle} w-full resize-none rounded-xl p-4 text-body`}
                />
              </ChatShell.Column>
            </ChatShell.Dock>
          </ChatShell.Viewport>
        </ChatShell.Stage>
      </ChatShell>
    </div>
  );
}

const meta = {
  title: 'AI/Attachment focus',
  component: AttachmentFocusChat,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An image card’s outer keyboard focus outline must fit inside the message row’s paint containment. These stories use the shared chat layout and each app’s message-row containment setting.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const preview = within(canvasElement).getByRole('button', { name: 'Preview Image' });
    await userEvent.tab(); // Scroll viewport.
    await userEvent.tab(); // Image attachment.
    await expect(preview).toHaveFocus();
    const style = getComputedStyle(preview);
    await expect(preview.matches(':focus-visible')).toBe(true);
    await expect(style.outlineStyle).toBe('solid');
    await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
    const row = preview.closest('[data-slot="message-scroller-item"]');
    if (!row) throw new Error('Image attachment must render inside a message row');
    const cardBounds = preview.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    const focusExtent = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    await expect(cardBounds.left - focusExtent).toBeGreaterThanOrEqual(rowBounds.left);
    await expect(cardBounds.right + focusExtent).toBeLessThanOrEqual(rowBounds.right);
    await expect(cardBounds.top - focusExtent).toBeGreaterThanOrEqual(rowBounds.top);
    await expect(cardBounds.bottom + focusExtent).toBeLessThanOrEqual(rowBounds.bottom);
  },
} satisfies Meta<typeof AttachmentFocusChat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Studio: Story = {};
export const Factory: Story = { args: { factory: true } };
