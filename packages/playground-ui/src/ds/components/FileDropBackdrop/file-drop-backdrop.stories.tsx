import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Badge } from '../Badge/Badge';
import { Button } from '../Button';
import { Composer, ComposerActions, ComposerAttachments, ComposerBox, ComposerInput } from '../Composer';
import { Input } from '../Input';
import { FileDropBackdrop } from './file-drop-backdrop';

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
        {files.length > 0 && (
          <ComposerAttachments aria-label="Attachments" className="flex flex-wrap gap-1.5">
            {files.map((file, index) => (
              <Badge key={`${file.name}-${index}`} size="sm">
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  onClick={() => setFiles(current => current.filter((_, i) => i !== index))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </ComposerAttachments>
        )}
        <ComposerBox>
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
