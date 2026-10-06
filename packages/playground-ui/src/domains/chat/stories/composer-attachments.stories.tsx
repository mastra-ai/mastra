import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ImageEntry, TxtEntry, PdfEntry, FileChipEntry } from '../attachments/attachment-preview-dialog';
import { ComposerAttachment } from '../attachments/composer-attachment';
import { ComposerAttachmentList } from '../attachments/composer-attachment-list';
import { Button } from '@/ds/components/Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput } from '@/ds/components/Composer';

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

function AttachmentComposer({
  files = ['diagram.png', 'review-notes-with-a-long-filename-é日本語.csv', 'brief.pdf', 'clip.mp4'],
  withActions = false,
}: {
  files?: string[];
  withActions?: boolean;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const attachments = files.filter(name => !removed.includes(name));

  return (
    <Composer aria-label="Message composer" onSubmit={event => event.preventDefault()}>
      <ComposerBox>
        {attachments.length > 0 && (
          <ComposerAttachmentList>
            {attachments.map(name => (
              <ComposerAttachment
                key={name}
                name={name}
                variant={name.endsWith('.csv') || name.endsWith('.txt') ? 'inline' : 'thumbnail'}
                onRemove={() => setRemoved(current => [...current, name])}
              >
                <AttachmentPreview name={name} />
              </ComposerAttachment>
            ))}
          </ComposerAttachmentList>
        )}
        <ComposerInput
          placeholder="Message"
          aria-label="Message"
          defaultValue={withActions ? 'Summarize the attached notes.' : undefined}
        />
        {withActions && (
          <ComposerActions>
            <Button type="button" size="icon-md" aria-label="Attach file">
              <Paperclip />
            </Button>
            <Button type="submit" size="icon-md" aria-label="Send message">
              <ArrowUp />
            </Button>
          </ComposerActions>
        )}
      </ComposerBox>
    </Composer>
  );
}

function AttachmentPreview({ name }: { name: string }) {
  if (name.endsWith('.png')) return <ImageEntry src={imageSrc} name={name} />;
  if (name.endsWith('.csv') || name.endsWith('.txt'))
    return <TxtEntry name={name} data={'name,score\nZoë,12\n日本語,20'} />;
  if (name.endsWith('.pdf')) return <PdfEntry data="" url="https://example.com/brief.pdf" />;
  if (name.endsWith('.mp4')) return <FileChipEntry name={name} contentType="video/mp4" />;
  if (name.endsWith('.mp3')) return <FileChipEntry name={name} contentType="audio/mpeg" />;
  return <FileChipEntry name={name} contentType="application/octet-stream" />;
}

export const Images: Story = {
  render: () => <AttachmentComposer files={['diagram.png']} />,
};

export const WithAttachmentsAndActions: Story = {
  render: () => <AttachmentComposer files={['project-notes.txt']} withActions />,
};

export const MixedFiles: Story = {
  render: () => <AttachmentComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const attachments = canvas.getByRole('region', { name: 'Draft attachments' });
    const previews = Array.from(attachments.children);
    const thumbnailHeight = previews[0]?.getBoundingClientRect().height;
    const thumbnailStyle = previews[0] && getComputedStyle(previews[0]);

    const scrollArea = attachments.closest('[data-slot="composer-attachment-scroll-area"]');
    if (!scrollArea || !previews[0]) throw new Error('Missing attachment scroll area');
    const areaRect = scrollArea.getBoundingClientRect();
    const firstCardRect = previews[0].getBoundingClientRect();
    // Visible scrollbars must overlay the gutter rather than add height beneath the cards.
    await expect(firstCardRect.top - areaRect.top).toBe(8);
    await expect(areaRect.bottom - firstCardRect.bottom).toBe(4);

    await expect(thumbnailHeight).toBeGreaterThan(0);
    for (const preview of previews) {
      await expect(preview?.getBoundingClientRect().height).toBe(thumbnailHeight);
      const style = getComputedStyle(preview);
      await expect(preview).toHaveTextContent(preview.getAttribute('title') ?? '');
      await expect(style.borderRadius).toBe(thumbnailStyle?.borderRadius);
      await expect(parseFloat(style.borderRadius)).toBeLessThan((thumbnailHeight ?? 0) / 2);
      await expect(style.backgroundColor).toBe(thumbnailStyle?.backgroundColor);
      await expect(style.boxShadow).toBe(thumbnailStyle?.boxShadow);
      const control = preview.firstElementChild?.querySelector('button, a');
      if (control) {
        await expect(control.getBoundingClientRect().height).toBe(thumbnailHeight);
        await expect(getComputedStyle(control).borderRadius).toBe(style.borderRadius);
        await expect(getComputedStyle(control).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      }
    }

    const removeButtons = canvas.getAllByRole('button', { name: /^Remove / });
    const removeTop = removeButtons[0]?.getBoundingClientRect().top;
    for (const button of removeButtons) {
      await expect(button.getBoundingClientRect().top).toBe(removeTop);
      const card = button.parentElement;
      if (!card) throw new Error('Missing attachment card');
      await expect(button.getBoundingClientRect().top).toBe(card.getBoundingClientRect().top);
      await expect(button.getBoundingClientRect().right).toBe(card.getBoundingClientRect().right);
      await expect(getComputedStyle(button).borderTopRightRadius).toBe(getComputedStyle(card).borderTopRightRadius);
    }
    const image = canvas.getByRole('img', { name: 'diagram.png' });
    const imageTile = image.parentElement;
    const imageCard = image.closest('[title="diagram.png"]');
    if (!imageTile || !imageCard) throw new Error('Missing image attachment');
    const tileRect = imageTile.getBoundingClientRect();
    const cardRect = imageCard.getBoundingClientRect();
    const inset = tileRect.left - cardRect.left;
    await expect(tileRect.top - cardRect.top).toBe(inset);
    await expect(cardRect.bottom - tileRect.bottom).toBe(inset);
    await expect(tileRect.width).toBe(tileRect.height);
    await expect(parseFloat(getComputedStyle(imageTile).borderTopLeftRadius) + inset).toBe(
      parseFloat(getComputedStyle(imageCard).borderTopLeftRadius),
    );
    const longFilename = canvas.getByText('review-notes-with-a-long-filename-é日本語.csv');
    await expect(longFilename.scrollWidth).toBeGreaterThan(longFilename.clientWidth);
    await expect(getComputedStyle(longFilename).textOverflow).toBe('ellipsis');
  },
};

export const AllFileTypes: Story = {
  render: () => (
    <AttachmentComposer
      files={[
        'diagram.png',
        'notes.txt',
        'review-notes-with-a-long-filename-é日本語.csv',
        'brief.pdf',
        'clip.mp4',
        'recording.mp3',
        'archive.zip',
      ]}
    />
  ),
  play: MixedFiles.play,
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
    const textPreview = canvas.getByRole('button', { name: /Preview review-notes/ });
    textPreview.focus();
    await userEvent.keyboard('{Enter}');
    const textDialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(textDialog).toHaveTextContent('Zoë,12');
    await expect(textDialog).toHaveTextContent('日本語,20');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(textPreview).toHaveFocus());
    await userEvent.click(canvas.getByRole('button', { name: /Remove review-notes/ }));
    await expect(canvas.queryByRole('button', { name: /Preview review-notes/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove brief.pdf' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove clip.mp4' })).toBeInTheDocument();
  },
};

export const KeyboardRemove: Story = {
  render: () => <AttachmentComposer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const preview = canvas.getByRole('button', { name: 'Preview diagram.png' });
    const remove = canvas.getByRole('button', { name: 'Remove diagram.png' });
    preview.focus();
    await waitFor(() => expect(getComputedStyle(remove).opacity).toBe('1'));
    remove.focus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByRole('button', { name: 'Preview diagram.png' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove brief.pdf' })).toBeInTheDocument();
  },
};
