import type { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64, getFileContentType } from '@mastra/playground-ui';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getAcceptedAttachmentTypes, isAcceptedAttachmentType } from './accepted-types';

export type ComposerAttachmentKind = 'image' | 'pdf' | 'text' | 'file';

export interface ComposerAttachment {
  id: string;
  /** The picked file. For URL attachments this is an empty File whose `name` is the URL. */
  file: File;
  name: string;
  contentType: string;
  kind: ComposerAttachmentKind;
  /** True when this attachment was added by URL (name is a https:// link). */
  isUrl: boolean;
}

interface ComposerAttachmentsContextValue {
  attachments: ComposerAttachment[];
  /** Adds allowed files; returns the names of files rejected by the configured type allowlist. */
  addFiles: (files: File[] | FileList) => string[];
  /** Adds a URL attachment; resolves to false when its content type is not allowed. */
  addUrl: (url: string) => Promise<boolean>;
  remove: (id: string) => void;
  clear: () => void;
  toCoreUserMessages: () => Promise<CoreUserMessage[]>;
}

const ComposerAttachmentsContext = createContext<ComposerAttachmentsContextValue | null>(null);

/** Non-`text/*` content types that are still safe to read and send as plain text. */
const TEXTUAL_APPLICATION_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/x-ndjson',
  'application/x-yaml',
  'application/yaml',
]);

const kindForContentType = (contentType: string): ComposerAttachmentKind => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('text/') || TEXTUAL_APPLICATION_TYPES.has(contentType)) return 'text';
  // Other binary types (spreadsheets, docs, ...) are sent as file parts.
  return 'file';
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

const contentTypeForFile = (file: File): string => file.type || 'text/plain';

const toAttachment = (file: File): ComposerAttachment => {
  const isUrl = file.name.startsWith('https://');
  const contentType = contentTypeForFile(file);
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

  if (att.kind === 'pdf' || att.kind === 'file') {
    const data = att.isUrl ? att.name : `data:${att.contentType};base64,${await fileToBase64(att.file)}`;
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

  const addFiles = useCallback((files: File[] | FileList): string[] => {
    const accepted = getAcceptedAttachmentTypes();
    const list = Array.from(files);
    const allowed = list.filter(f => isAcceptedAttachmentType(contentTypeForFile(f), accepted));
    const rejected = list.filter(f => !allowed.includes(f)).map(f => f.name);
    if (allowed.length > 0) {
      setAttachments(prev => [...prev, ...allowed.map(toAttachment)]);
    }
    return rejected;
  }, []);

  const addUrl = useCallback(async (url: string): Promise<boolean> => {
    const contentType = (await getFileContentType(url)) ?? 'application/octet-stream';
    if (!isAcceptedAttachmentType(contentType, getAcceptedAttachmentTypes())) {
      return false;
    }
    // URL attachments are represented by an empty File named with the URL.
    const file = new File([], url, { type: contentType });
    setAttachments(prev => [...prev, toAttachment(file)]);
    return true;
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
