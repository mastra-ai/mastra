import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '../Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput } from '../Composer';
import { Input } from '../Input';
import { FileDropBackdrop } from './file-drop-backdrop';
import { FileChipEntry } from '@/domains/chat/attachments/attachment-preview-dialog';
import { ComposerAttachment } from '@/domains/chat/attachments/composer-attachment';
import { ComposerAttachmentList } from '@/domains/chat/attachments/composer-attachment-list';

const meta: Meta<typeof FileDropBackdrop> = {
  title: 'Elements/FileDropBackdrop',
  component: FileDropBackdrop,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wrap any field with FileDropBackdrop. Dragging a file anywhere over the window shows a full-page backdrop; dropping calls onFilesDrop with the files that match `accept`. The component owns no file state — the application decides what to do with the files. Drag a file from your desktop onto the preview to try it.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileDropBackdrop>;

const InputDemo = () => {
  const [fileNames, setFileNames] = useState('');

  return (
    <FileDropBackdrop onFilesDrop={files => setFileNames(files.map(file => file.name).join(', '))}>
      <div className="w-80">
        <Input readOnly aria-label="Dropped files" placeholder="Drag a file anywhere…" value={fileNames} />
      </div>
    </FileDropBackdrop>
  );
};

export const WithInput: Story = {
  render: () => <InputDemo />,
};

const ComposerDemo = ({ accept, label, description }: { accept?: string; label?: string; description?: string }) => {
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (next: File[]) => setFiles(current => [...current, ...next]);

  return (
    <FileDropBackdrop onFilesDrop={addFiles} accept={accept} label={label} description={description}>
      <Composer aria-label="Message composer" onSubmit={event => event.preventDefault()}>
        <ComposerBox>
          {files.length > 0 && (
            <ComposerAttachmentList>
              {files.map((file, index) => (
                <ComposerAttachment
                  key={`${file.name}-${index}`}
                  name={file.name}
                  onRemove={() => setFiles(current => current.filter((_, i) => i !== index))}
                >
                  <FileChipEntry name={file.name} contentType={file.type} />
                </ComposerAttachment>
              ))}
            </ComposerAttachmentList>
          )}
          <ComposerInput aria-label="Message" placeholder="Drop files anywhere to attach them…" />
          <ComposerActions>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept={accept}
              onChange={event => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
            <Button type="button" size="icon-md" aria-label="Attach file" onClick={() => fileInputRef.current?.click()}>
              <Paperclip />
            </Button>
            <Button type="submit" size="icon-md" aria-label="Send message">
              <ArrowUp />
            </Button>
          </ComposerActions>
        </ComposerBox>
      </Composer>
    </FileDropBackdrop>
  );
};

export const WithComposer: Story = {
  render: () => <ComposerDemo />,
};

export const AcceptImagesOnly: Story = {
  render: () => (
    <ComposerDemo
      accept="image/*"
      label="Drop images to attach"
      description="Only images are accepted. Other files are ignored."
    />
  ),
};
