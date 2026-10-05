import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MessageAttachment } from '../attachments/message-attachment';

const meta = {
  title: 'AI/Sent Attachments',
  component: MessageAttachment,
  parameters: {
    docs: {
      description: {
        component:
          'The shared sent-attachment component used by Studio and Factory through UserFilePartRenderer. It is separate from ComposerAttachment so sent files can evolve without changing draft uploads. Images, PDFs and text support previews; spreadsheets and other binary files use file entries.',
      },
    },
  },
} satisfies Meta<typeof MessageAttachment>;

export default meta;
type Story = StoryObj<typeof meta>;

const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#182c25"/><circle cx="240" cy="60" r="28" fill="#f3d89c"/><path d="M0 200 120 50 240 200M120 200 230 100 320 200" fill="#a3e8c0"/></svg>';

export const Image: Story = {
  args: { type: 'image', name: 'landscape.svg', src: `data:image/svg+xml,${encodeURIComponent(image)}` },
};

export const Pdf: Story = {
  args: {
    type: 'document',
    contentType: 'application/pdf',
    name: 'proposal.pdf',
    src: 'https://example.com/proposal.pdf',
  },
  parameters: { docs: { description: { story: 'External PDF link; example.com is not a hosted preview fixture.' } } },
};

export const Excel: Story = {
  args: {
    type: 'file',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: 'quarterly-revenue.xlsx',
    src: 'https://example.com/quarterly-revenue.xlsx',
  },
};

export const Text: Story = {
  args: {
    type: 'document',
    contentType: 'text/plain',
    name: 'review-notes.txt',
    data: 'Review the proposal.\nRésumé: café, 日本語, 👋',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Preview review-notes.txt' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(within(dialog).getByText(/Résumé: café, 日本語, 👋/)).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveFocus();
  },
};

export const LongFilename: Story = {
  args: { ...Text.args, name: 'conversation-review-notes-with-a-long-filename-and-unicode-é日本語.txt' },
};

export const UnavailableFile: Story = {
  args: { type: 'file', name: 'archive.zip', contentType: 'application/zip' },
};
