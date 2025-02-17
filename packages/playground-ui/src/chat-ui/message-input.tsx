import { ArrowUp, Paperclip, Square } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { omit } from 'remeda';

import { AnimatePresence, motion } from 'motion/react';

import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

import { FilePreview } from './file-preview';
import { useAutosizeTextArea } from './hooks/use-autosize-textarea';

interface MessageInputBaseProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  submitOnEnter?: boolean;
  stop?: () => void;
  isGenerating: boolean;
}

interface MessageInputWithoutAttachmentProps extends MessageInputBaseProps {
  allowAttachments?: false;
}

interface MessageInputWithAttachmentsProps extends MessageInputBaseProps {
  allowAttachments: true;
  files: File[] | null;
  setFiles: React.Dispatch<React.SetStateAction<File[] | null>>;
}

type MessageInputProps = MessageInputWithoutAttachmentProps | MessageInputWithAttachmentsProps;

export function MessageInput({
  placeholder = 'Ask AI...',
  className,
  onKeyDown: onKeyDownProp,
  submitOnEnter = true,
  stop,
  isGenerating,
  ...props
}: MessageInputProps) {
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (files: File[] | null) => {
    if (props.allowAttachments) {
      props.setFiles(currentFiles => {
        if (currentFiles === null) {
          return files;
        }

        if (files === null) {
          return currentFiles;
        }

        return [...currentFiles, ...files];
      });
    }
  };

  const onDragOver = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return;
    event.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (event: React.DragEvent) => {
    setIsDragging(false);
    if (props.allowAttachments !== true) return;
    event.preventDefault();
    const dataTransfer = event.dataTransfer;
    if (dataTransfer.files.length) {
      addFiles(Array.from(dataTransfer.files));
    }
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files = Array.from(items)
      .map(item => item.getAsFile())
      .filter(file => file !== null);

    if (props.allowAttachments && files.length > 0) {
      addFiles(files);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (submitOnEnter && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }

    onKeyDownProp?.(event);
  };

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const showFileList = props.allowAttachments && props.files && props.files.length > 0;

  useAutosizeTextArea({
    ref: textAreaRef as React.RefObject<HTMLTextAreaElement>,
    maxHeight: 240,
    borderWidth: 1,
    dependencies: [props.value, showFileList],
  });

  return (
    <div className="relative mx-auto flex w-full" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <textarea
        aria-label="Write your prompt here"
        placeholder={placeholder}
        ref={textAreaRef}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        className={cn(
          'ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary h-[98px] w-full grow resize-none rounded-2xl border-[0.5px] border-[#424242] bg-[#141414] p-3 pr-24 text-sm shadow-[0px_2px_8.1px_0px_rgba(0,0,0,0.20);] transition-[border] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          showFileList && 'pb-16',
          className,
        )}
        {...(props.allowAttachments
          ? omit(props, ['allowAttachments', 'files', 'setFiles'])
          : omit(props, ['allowAttachments']))}
      />

      {props.allowAttachments && (
        <div className="absolute inset-x-3 bottom-0 overflow-x-scroll py-3">
          <div className="flex space-x-3">
            <AnimatePresence mode="popLayout">
              {props.files?.map(file => {
                return (
                  <FilePreview
                    key={file.name + String(file.lastModified)}
                    file={file}
                    onRemove={() => {
                      props.setFiles(files => {
                        if (!files) return null;

                        const filtered = Array.from(files).filter(f => f !== file);
                        if (filtered.length === 0) return null;
                        return filtered;
                      });
                    }}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex gap-2">
        {props.allowAttachments && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label="Attach a file"
            onClick={async () => {
              const files = await showFileUploadDialog();
              addFiles(files);
            }}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        {isGenerating && stop ? (
          <Button type="button" size="icon" className="h-8 w-8" aria-label="Stop generating" onClick={stop}>
            <Square className="h-3 w-3 animate-pulse" fill="currentColor" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant={'secondary'}
            size="icon"
            className="mt-0 h-8 w-8 rounded-full transition-opacity"
            aria-label="Send message"
            disabled={props.value === '' || isGenerating}
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
        )}
      </div>

      {props.allowAttachments && <FileUploadOverlay isDragging={isDragging} />}
    </div>
  );
}
MessageInput.displayName = 'MessageInput';

interface FileUploadOverlayProps {
  isDragging: boolean;
}

function FileUploadOverlay({ isDragging }: FileUploadOverlayProps) {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          className="border-border bg-background text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center space-x-2 rounded-xl border border-dashed text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <Paperclip className="h-4 w-4" />
          <span>Drop your files here to attach them.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function showFileUploadDialog() {
  const input = document.createElement('input');

  input.type = 'file';
  input.multiple = true;
  input.accept = '*/*';
  input.click();

  return new Promise<File[] | null>(resolve => {
    input.onchange = e => {
      const files = (e.currentTarget as HTMLInputElement).files;

      if (files) {
        resolve(Array.from(files));
        return;
      }

      resolve(null);
    };
  });
}
