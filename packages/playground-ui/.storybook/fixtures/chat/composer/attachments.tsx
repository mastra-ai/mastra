import type { Ref } from 'react';
import type { DraftFile } from './use-conversation-draft';
import { ComposerAttachment } from '@/domains/chat/attachments/composer-attachment';
import { ComposerAttachmentList } from '@/domains/chat/attachments/composer-attachment-list';
import { UserFilePartRenderer } from '@/domains/chat/messages/renderers/user-file-part-renderer';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

export function DraftAttachments({
  files,
  onRemove,
  onFilesSelected,
  inputRef,
  accept,
}: {
  files: DraftFile[];
  onRemove: (id: string) => void;
  onFilesSelected: (files: FileList | null) => void;
  inputRef: Ref<HTMLInputElement>;
  accept?: string;
}) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        hidden
        aria-label="Attach files"
        onChange={event => {
          onFilesSelected(event.target.files);
          event.target.value = '';
        }}
      />
      {files.length > 0 && (
        <ComposerAttachmentList>
          {files.map(file => (
            <ComposerAttachment
              key={file.id}
              name={file.filename}
              variant={file.part?.mimeType.startsWith('image/') ? 'thumbnail' : 'inline'}
              onRemove={() => onRemove(file.id)}
            >
              {file.part ? (
                <UserFilePartRenderer part={file.part} />
              ) : (
                <Txt variant="ui-sm">
                  {file.filename}
                  {file.error ? '' : ' — Reading…'}
                </Txt>
              )}
              {file.error && (
                <Notice variant="destructive" title={file.filename}>
                  <Notice.Message>{file.error}</Notice.Message>
                </Notice>
              )}
            </ComposerAttachment>
          ))}
        </ComposerAttachmentList>
      )}
    </>
  );
}
