import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ImageEntry, TxtEntry, PdfEntry, FileChipEntry } from '../attachments/attachment-preview-dialog';
import { ComposerAttachment } from '../attachments/composer-attachment';
import { ComposerAttachmentList } from '../attachments/composer-attachment-list';
import { Composer, ComposerBox, ComposerInput } from '@/ds/components/Composer';

const meta = {
  title: 'AI/Composer Attachments',
  component: ComposerAttachmentList,
  parameters: {
    docs: {
      description: {
        component:
          'Studio and Factory share the draft attachment layout, previews, and named remove controls. Applications supply prepared preview content and removal callbacks; accepted file types, file reading, sending, and draft persistence stay in their adapters. Factory supplies images; Studio also supplies text, PDF, and media entries.',
      },
    },
  },
} satisfies Meta<typeof ComposerAttachmentList>;

export default meta;
type Story = StoryObj<typeof meta>;

const imageSrc = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#182c25"/><rect x="40" y="40" width="240" height="100" rx="12" fill="#a3e8c0"/><path d="m120 90 25 25 55-55" fill="none" stroke="#182c25" stroke-width="10"/></svg>')}`;

function AttachmentComposer({ imagesOnly = false }: { imagesOnly?: boolean }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const names = imagesOnly
    ? ['diagram.png']
    : ['diagram.png', 'review-notes-with-a-long-filename-é日本語.csv', 'brief.pdf', 'clip.mp4'];
  const attachments = names.filter(name => !removed.includes(name));

  return (
    <Composer onSubmit={event => event.preventDefault()}>
      <ComposerBox>
        {attachments.length > 0 && (
          <ComposerAttachmentList>
            {attachments.map(name => (
              <ComposerAttachment
                key={name}
                name={name}
                variant={name.endsWith('.csv') ? 'inline' : 'thumbnail'}
                onRemove={() => setRemoved(current => [...current, name])}
              >
                <AttachmentPreview name={name} />
              </ComposerAttachment>
            ))}
          </ComposerAttachmentList>
        )}
        <ComposerInput placeholder="Message" aria-label="Message" />
      </ComposerBox>
    </Composer>
  );
}

function AttachmentPreview({ name }: { name: string }) {
  if (name.endsWith('.png')) return <ImageEntry src={imageSrc} name={name} />;
  if (name.endsWith('.csv')) return <TxtEntry name={name} data={'name,score\nZoë,12\n日本語,20'} />;
  if (name.endsWith('.pdf')) return <PdfEntry data="" url="https://example.com/brief.pdf" />;
  return <FileChipEntry name="gs://attachments/clip.mp4" contentType="video/mp4" />;
}

export const Images: Story = {
  render: () => <AttachmentComposer imagesOnly />,
};

export const MixedFiles: Story = {
  render: () => <AttachmentComposer />,
};

export const PreviewAndRemove: Story = {
  render: () => <AttachmentComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const preview = canvas.getByRole('button', { name: 'Preview diagram.png' });
    preview.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(within(dialog).getByRole('img')).toHaveAttribute('src', imageSrc);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(preview).toHaveFocus());
    await userEvent.click(canvas.getByRole('button', { name: 'Remove diagram.png' }));
    await expect(canvas.queryByRole('button', { name: 'Preview diagram.png' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Preview review-notes/ })).toBeVisible();
  },
};
