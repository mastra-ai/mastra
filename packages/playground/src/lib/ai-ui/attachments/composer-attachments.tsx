import type { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64, getFileContentType, isRemoteUrl } from '@mastra/playground-ui/utils/file';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ComposerAttachmentKind = 'image' | 'pdf' | 'video' | 'text';

export interface ComposerAttachment {
  id: string;
  /** The picked file. For URL attachments this is an empty File whose `name` is the URL. */
  file: File;
  name: string;
  contentType: string;
  kind: ComposerAttachmentKind;
  /** True when this attachment was added by URL (name is a remote link, e.g. https://, gs://, s3://). */
  isUrl: boolean;
}

interface ComposerAttachmentsContextValue {
  attachments: ComposerAttachment[];
  addFiles: (files: File[] | FileList) => void;
  addUrl: (url: string) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
  toCoreUserMessages: () => Promise<CoreUserMessage[]>;
}

const ComposerAttachmentsContext = createContext<ComposerAttachmentsContextValue | null>(null);

const kindForContentType = (contentType: string): ComposerAttachmentKind => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  // The 'video' kind is the file-chip media path: it forwards URLs untouched and
  // inlines local files as a data URI. Audio shares this path so audio URLs are
  // sent as file parts instead of falling through to the empty-text branch.
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) return 'video';
  return 'text';
};

let attachmentCounter = 0;
const nextId = () => `att-${Date.now()}-${++attachmentCounter}`;

const fileToText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const toAttachment = (file: File): ComposerAttachment => {
  const isUrl = isRemoteUrl(file.name);
  const contentType = file.type || 'text/plain';
  return {
    id: nextId(),
    file,
    name: file.name,
    contentType,
    kind: kindForContentType(contentType),
    isUrl,
  };
};

const attachmentToCoreUserMessage = async (att: ComposerAttachment): Promise<CoreUserMessage> => {
  if (att.kind === 'image') {
    return {
      role: 'user' as const,
      content: [
        {
          type: 'image' as const,
          image: att.isUrl ? att.name : await fileToBase64(att.file),
          mimeType: att.contentType,
        },
      ],
    };
  }

  if (att.kind === 'pdf') {
    // `fileToBase64` already returns a full data URL (`data:application/pdf;base64,...`),
    // so it must be used as-is. Prepending the prefix here produced a malformed,
    // double-prefixed data URL that broke the PDF preview.
    const data = att.isUrl ? att.name : await fileToBase64(att.file);
    return {
      role: 'user' as const,
      content: [
        {
          type: 'file' as const,
          data,
          mimeType: att.contentType,
          filename: att.name,
        },
      ],
    };
  }

  if (att.kind === 'video') {
    // URL attachments forward the raw URI so the model provider fetches it
    // server-side (e.g. Google Cloud for gs://). Local files are inlined as a
    // data URI — `fileToBase64` already returns a full `data:*;base64,...` string.
    const data = att.isUrl ? att.name : await fileToBase64(att.file);
    return {
      role: 'user' as const,
      content: [
        {
          type: 'file' as const,
          data,
          mimeType: att.contentType,
          filename: att.name,
        },
      ],
    };
  }

  const text = await fileToText(att.file);
  return {
    role: 'user' as const,
    content: text,
  };
};

export const ComposerAttachmentsProvider = ({ children }: { children: ReactNode }) => {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  const addFiles = useCallback((files: File[] | FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setAttachments(prev => [...prev, ...list.map(toAttachment)]);
  }, []);

  const addUrl = useCallback(async (url: string) => {
    const contentType = (await getFileContentType(url)) ?? 'application/octet-stream';
    // URL attachments are represented by an empty File named with the URL.
    const file = new File([], url, { type: contentType });
    setAttachments(prev => [...prev, toAttachment(file)]);
  }, []);

  const remove = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const clear = useCallback(() => setAttachments([]), []);

  const toCoreUserMessages = useCallback(async () => {
    return Promise.all(attachments.map(attachmentToCoreUserMessage));
  }, [attachments]);

  const value = useMemo<ComposerAttachmentsContextValue>(
    () => ({ attachments, addFiles, addUrl, remove, clear, toCoreUserMessages }),
    [attachments, addFiles, addUrl, remove, clear, toCoreUserMessages],
  );

  return <ComposerAttachmentsContext.Provider value={value}>{children}</ComposerAttachmentsContext.Provider>;
};

export const useComposerAttachments = (): ComposerAttachmentsContextValue => {
  const ctx = useContext(ComposerAttachmentsContext);
  if (!ctx) {
    throw new Error('useComposerAttachments must be used within a ComposerAttachmentsProvider');
  }
  return ctx;
};
