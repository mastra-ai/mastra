import type { FilePart } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { UserFilePartRenderer } from '../messages/renderers/user-file-part-renderer';

const meta = {
  title: 'Chat/Attachments',
  component: UserFilePartRenderer,
  parameters: {
    docs: {
      description: {
        component:
          'Studio file parts use the same mimeType/data shape live and after reload. Open image and text previews with the keyboard; Escape closes the dialog. Factory still has its own renderer.',
      },
    },
  },
} satisfies Meta<typeof UserFilePartRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const textPart = {
  type: 'file',
  mimeType: 'text/plain',
  filename: 'review-notes.txt',
  data: 'Keep the original message order.\nRésumé: café, 日本語, 👋\n<attachment>Keep literal tags.</attachment>',
} satisfies FilePart & { filename: string };

const longFilenamePart = {
  ...textPart,
  filename: 'conversation-review-notes-with-a-long-filename-and-unicode-é日本語.txt',
} satisfies FilePart & { filename: string };

export const Image: Story = {
  args: {
    part: {
      type: 'file',
      mimeType: 'image/svg+xml',
      data: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"><rect width="320" height="160" fill="#182c25"/><circle cx="160" cy="80" r="48" fill="#a3e8c0"/><path d="m136 80 16 16 32-32" fill="none" stroke="#182c25" stroke-width="8"/></svg>')}`,
    },
  },
};

export const TextFile: Story = {
  args: { part: textPart },
};

export const TextPreviewOpen: Story = {
  args: TextFile.args,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Preview review-notes.txt' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText(/Résumé: café, 日本語, 👋/)).toBeVisible());
    await expect(within(dialog).getByText(/<attachment>Keep literal tags.<\/attachment>/)).toBeVisible();
  },
};

export const LongFilename: Story = {
  args: { part: longFilenamePart },
};

export const RemotePdf: Story = {
  args: { part: { type: 'file', mimeType: 'application/pdf', data: 'https://example.com/review.pdf' } },
  parameters: { docs: { description: { story: 'External-link state. The example URL is not a hosted PDF fixture.' } } },
};

export const CloudStorageFile: Story = {
  args: { part: { type: 'file', mimeType: 'video/mp4', data: 'gs://chat-attachments/review.mp4' } },
  parameters: {
    docs: {
      description: { story: 'A provider-only URI stays a non-clickable file chip; the browser cannot fetch it.' },
    },
  },
};

export const InlineBinaryFile: Story = {
  args: {
    part: { type: 'file', mimeType: 'application/octet-stream', data: 'data:application/octet-stream;base64,AAEC' },
  },
};
