import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  verifyAttachmentSpacing,
  verifyContextMenu,
  verifyEditing,
  verifyKeyboardRemoval,
  verifyMixedAttachments,
  verifyPreviewAndRemoval,
} from '../../../../.storybook/tests/composer-attachments';
import { ImageEntry, TxtEntry, PdfEntry, FileChipEntry } from '../attachments/attachment-preview-dialog';
import { ComposerAttachment } from '../attachments/composer-attachment';
import { ComposerAttachmentList } from '../attachments/composer-attachment-list';
import type { AttachmentPreviewProps } from '../attachments/use-attachment-preview';
import { Button } from '@/ds/components/Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput } from '@/ds/components/Composer';

const meta = {
  title: 'AI/Composer Attachments',
  component: ComposerAttachmentList,
  parameters: {
    docs: {
      description: {
        component:
          'All composer attachments reveal removal on hover or keyboard focus. Supplying onEdit adds editing below removal; applications own the editor. On touch devices, the actions button or long press opens the shared context menu. These examples use the production composer and attachment components.',
      },
    },
  },
} satisfies Meta<typeof ComposerAttachmentList>;

export default meta;
type Story = StoryObj<typeof meta>;

const imageSrc = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#182c25"/><rect x="40" y="40" width="240" height="100" rx="12" fill="#a3e8c0"/><path d="m120 90 25 25 55-55" fill="none" stroke="#182c25" stroke-width="10"/></svg>')}`;

const onEdit = fn();

function AttachmentComposer({
  files = ['diagram.png', 'review-notes-with-a-long-filename-é日本語.csv', 'brief.pdf', 'clip.mp4'],
  withActions = false,
  onEdit,
}: {
  files?: string[];
  withActions?: boolean;
  onEdit?: () => void;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [previewName, setPreviewName] = useState<string>();
  const attachments = files.filter(name => !removed.includes(name));

  function previewFile(name: string) {
    if (name.endsWith('.pdf')) {
      window.open('https://example.com/brief.pdf', '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewName(name);
  }

  return (
    <Composer aria-label="Message composer" onSubmit={event => event.preventDefault()}>
      <ComposerBox>
        {attachments.length > 0 && (
          <ComposerAttachmentList>
            {attachments.map(name => (
              <ComposerAttachment
                key={name}
                name={name}
                onEdit={onEdit}
                onPreview={/\.(png|csv|txt|pdf)$/.test(name) ? () => previewFile(name) : undefined}
                variant={name.endsWith('.csv') || name.endsWith('.txt') ? 'inline' : 'thumbnail'}
                onRemove={() => setRemoved(current => [...current, name])}
              >
                <AttachmentPreview
                  name={name}
                  open={previewName === name}
                  onOpenChange={open => setPreviewName(open ? name : undefined)}
                />
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

function AttachmentPreview({ name, ...previewProps }: { name: string } & AttachmentPreviewProps) {
  if (name.endsWith('.png')) return <ImageEntry src={imageSrc} name={name} {...previewProps} />;
  if (name.endsWith('.csv') || name.endsWith('.txt'))
    return <TxtEntry name={name} data={'name,score\nZoë,12\n日本語,20'} {...previewProps} />;
  if (name.endsWith('.pdf')) return <PdfEntry data="" url="https://example.com/brief.pdf" {...previewProps} />;
  if (name.endsWith('.mp4')) return <FileChipEntry name={name} contentType="video/mp4" />;
  if (name.endsWith('.mp3')) return <FileChipEntry name={name} contentType="audio/mpeg" />;
  return <FileChipEntry name={name} contentType="application/octet-stream" />;
}

export const Images: Story = {
  render: () => <AttachmentComposer files={['diagram.png']} />,
  play: verifyAttachmentSpacing,
};

export const File: Story = {
  render: () => <AttachmentComposer files={['archive.zip']} />,
  play: verifyAttachmentSpacing,
};

export const WithAttachmentsAndActions: Story = {
  render: () => <AttachmentComposer files={['project-notes.txt']} withActions />,
};

export const MixedFiles: Story = {
  render: () => <AttachmentComposer />,
  play: verifyMixedAttachments,
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
  play: verifyMixedAttachments,
};

export const LongFilename: Story = {
  render: () => <AttachmentComposer files={['review-notes-with-a-long-filename-é日本語.csv']} />,
  play: verifyAttachmentSpacing,
};

export const WithEditing: Story = {
  render: () => <AttachmentComposer files={['diagram.png']} onEdit={onEdit} withActions />,
  beforeEach: () => {
    onEdit.mockClear();
  },
  play: context => verifyEditing(context, onEdit),
};

export const PreviewAndRemove: Story = {
  render: () => <AttachmentComposer />,
  play: context => verifyPreviewAndRemoval(context, imageSrc),
};

export const KeyboardRemove: Story = {
  render: () => <AttachmentComposer />,
  play: verifyKeyboardRemoval,
};

export const AttachmentContextMenu: Story = {
  render: () => <AttachmentComposer files={['project-notes.txt', 'archive.zip']} onEdit={onEdit} withActions />,
  play: verifyContextMenu,
};
