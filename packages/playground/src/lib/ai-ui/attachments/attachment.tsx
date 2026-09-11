import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { fileToBase64, isBrowserFetchableUrl } from '@mastra/playground-ui/utils/file';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLoadBrowserFile } from '../hooks/use-load-browser-file';
import { ImageEntry, TxtEntry, PdfEntry, FileChipEntry } from './attachment-preview-dialog';
import { useComposerAttachments } from './composer-attachments';
import type { ComposerAttachment } from './composer-attachments';

const ComposerTxtAttachment = ({ file }: { file: File }) => {
  const { isLoading, text } = useLoadBrowserFile(file);

  return isLoading ? <Spinner /> : <TxtEntry data={text} name={file.name} />;
};

const ComposerPdfAttachment = ({ attachment }: { attachment: ComposerAttachment }) => {
  const [state, setState] = useState({ isLoading: false, text: '' });
  useEffect(() => {
    let isCanceled = false;

    const run = async () => {
      if (!attachment.file) return;
      setState(s => ({ ...s, isLoading: true }));
      const text = await fileToBase64(attachment.file);
      if (isCanceled) {
        return;
      }
      setState(s => ({ ...s, isLoading: false, text }));
    };
    void run();

    return () => {
      isCanceled = true;
    };
  }, [attachment]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {state.isLoading ? (
        <Spinner />
      ) : (
        <PdfEntry data={state.text} url={attachment.isUrl ? attachment.name : undefined} />
      )}
    </div>
  );
};

const ImageAttachmentThumbnail = ({ attachment }: { attachment: ComposerAttachment }) => {
  const [src, setSrc] = useState<string>(attachment.isUrl ? attachment.name : '');

  useEffect(() => {
    if (attachment.isUrl) {
      setSrc(attachment.name);
      return;
    }
    const url = URL.createObjectURL(attachment.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  return <ImageEntry src={src} />;
};

const AttachmentThumbnail = ({ attachment }: { attachment: ComposerAttachment }) => {
  const { remove } = useComposerAttachments();

  if (attachment.kind === 'text') {
    return (
      <ButtonsGroup spacing="close" className="shrink-0">
        {attachment.isUrl ? (
          <FileChipEntry
            contentType={attachment.contentType}
            name={attachment.name}
            url={isBrowserFetchableUrl(attachment.name) ? attachment.name : undefined}
          />
        ) : (
          <ComposerTxtAttachment file={attachment.file} />
        )}
        <Button
          variant="outline"
          size="icon-sm"
          type="button"
          tooltip="Remove file"
          onClick={() => remove(attachment.id)}
        >
          <X />
        </Button>
      </ButtonsGroup>
    );
  }

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-surface3 border-border1 size-16 overflow-hidden rounded-lg border">
              {attachment.kind === 'image' ? (
                <ImageAttachmentThumbnail attachment={attachment} />
              ) : attachment.kind === 'pdf' ? (
                <ComposerPdfAttachment attachment={attachment} />
              ) : (
                <FileChipEntry
                  name={attachment.name}
                  url={attachment.isUrl && isBrowserFetchableUrl(attachment.name) ? attachment.name : undefined}
                  contentType={attachment.contentType}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{attachment.name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        variant="default"
        size="icon-sm"
        type="button"
        tooltip="Remove file"
        onClick={() => remove(attachment.id)}
        className="text-neutral3 hover:text-neutral6 bg-surface1 hover:bg-surface2 absolute -top-2 -right-2"
      >
        <Icon>
          <X />
        </Icon>
      </Button>
    </div>
  );
};

export const ComposerAttachments = () => {
  const { attachments } = useComposerAttachments();

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-row items-center gap-4 overflow-x-auto px-3 pt-3 pb-1" data-testid="composer-attachments">
      {attachments.map(att => (
        <AttachmentThumbnail key={att.id} attachment={att} />
      ))}
    </div>
  );
};
