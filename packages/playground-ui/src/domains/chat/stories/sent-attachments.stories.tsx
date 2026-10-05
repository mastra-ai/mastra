import type { FilePart } from '@mastra/react/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MessageAttachment } from '../attachments/message-attachment';
import { MessageAttachments } from '../attachments/message-attachments';
import { Message } from '@/ds/components/Message';

const meta = {
  title: 'AI/Sent Attachments',
  component: MessageAttachment,
  args: { type: 'file' },
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

const pdf =
  'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMTExID4+CnN0cmVhbQpCVCAvRjEgMjQgVGYgNDggNzIwIFRkIChQcm9qZWN0IHByb3Bvc2FsKSBUaiAwIC00MiBUZCAvRjEgMTIgVGYgKFJldmlldyBzY29wZSwgdGltZWxpbmUsIGFuZCBuZXh0IHN0ZXBzLikgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMxMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ3MwolJUVPRgo=';

export const Pdf: Story = {
  args: {
    type: 'document',
    contentType: 'application/pdf',
    name: 'proposal.pdf',
    data: pdf,
  },
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
    await waitFor(() => expect(within(dialog).getByText(/Résumé: café, 日本語, 👋/)).toBeVisible());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const LongFilename: Story = {
  args: { ...Text.args, name: 'conversation-review-notes-with-a-long-filename-and-unicode-é日本語.txt' },
};

export const UnavailableFile: Story = {
  args: { type: 'file', name: 'archive.zip', contentType: 'application/zip' },
};

const imagePart: FilePart & { filename: string } = {
  type: 'file',
  mimeType: 'image/svg+xml',
  filename: 'landscape.svg',
  data: `data:image/svg+xml,${encodeURIComponent(image)}`,
};
const pdfPart: FilePart & { filename: string } = {
  type: 'file',
  mimeType: 'application/pdf',
  filename: 'project-proposal.pdf',
  data: pdf,
};
const excelPart: FilePart & { filename: string } = {
  type: 'file',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  filename: 'quarterly-revenue.xlsx',
  data: 'https://example.com/quarterly-revenue.xlsx',
};

export const InConversation: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl">
      <Message from="user" attachments={<MessageAttachments parts={[imagePart]} />}>
        Here is the image for the proposal.
      </Message>
      <Message from="assistant">The landscape works well. Send over the proposal and the updated numbers.</Message>
      <Message from="user" attachments={<MessageAttachments parts={[pdfPart, excelPart]} />}>
        Please review the proposal and updated numbers.
      </Message>
    </div>
  ),
};

export const AttachmentOnly: Story = {
  render: () => (
    <Message
      from="user"
      attachments={
        <MessageAttachment
          type="document"
          contentType="text/plain"
          name="review-notes.txt"
          data="Review the proposal."
        />
      }
    />
  ),
};

export const BrokenImage: Story = {
  args: { type: 'image', name: 'unavailable.png', contentType: 'image/png', src: 'data:image/png;base64,invalid' },
};

export const PdfPreview: Story = {
  args: Pdf.args,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Preview proposal.pdf' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByTitle('proposal.pdf')).toBeVisible());
    await expect(within(dialog).getByRole('link', { name: 'Download PDF' })).toBeVisible();
  },
};
