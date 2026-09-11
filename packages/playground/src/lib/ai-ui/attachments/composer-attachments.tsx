import type { CoreUserMessage } from '@mastra/core/llm';
import { classifyAttachment } from '@mastra/playground-ui/domains/chat/attachments/attachment-kind';
import type { ComposerAttachmentKind } from '@mastra/playground-ui/domains/chat/attachments/attachment-kind';
import { fileToBase64, getFileContentType, isRemoteUrl } from '@mastra/playground-ui/utils/file';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

export type { ComposerAttachmentKind } from '@mastra/playground-ui/domains/chat/attachments/attachment-kind';

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
  addFiles: (files: File[] | FileList) => Promise<string[]>;
  addUrl: (url: string) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
  cancelPending: () => void;
  toCoreUserMessages: () => Promise<CoreUserMessage[]>;
}

const ComposerAttachmentsContext = createContext<ComposerAttachmentsContextValue | null>(null);

let attachmentCounter = 0;
const nextId = () => `att-${Date.now()}-${++attachmentCounter}`;

const toAttachment = (file: File): ComposerAttachment => {
  const isUrl = isRemoteUrl(file.name);
  const { contentType, kind } = classifyAttachment(file.name, file.type);
  return {
    id: nextId(),
    file,
    name: file.name,
    contentType,
    kind,
    isUrl,
  };
};

// A bounded text probe is only a fallback for unrecognized formats, not a security check.
const looksLikeText = (file: File): Promise<boolean> =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        resolve(false);
        return;
      }
      try {
        const bytes = new Uint8Array(reader.result);
        let encoding = 'utf-8';
        if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
        if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
        // A bounded probe can end mid-character; only flush the decoder at EOF.
        const text = new TextDecoder(encoding, { fatal: true }).decode(bytes, { stream: file.size > bytes.length });
        resolve(
          Array.from(text).every(character => {
            const code = character.charCodeAt(0);
            return code >= 32 || code === 9 || code === 10 || code === 12 || code === 13;
          }),
        );
      } catch {
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 8192));
  });

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

  if (att.kind === 'text' && !att.isUrl) {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsText(att.file);
    });
    const name = att.name
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    return { role: 'user', content: `<attachment name="${name}">${text}</attachment>` };
  }

  // Keep media bytes intact. Correct only the MIME prefix when browsers mislabel a file.
  const data = att.isUrl ? att.name : (await fileToBase64(att.file)).replace(/^data:[^;,]*/, `data:${att.contentType}`);
  return {
    role: 'user',
    content: [{ type: 'file', data, mimeType: att.contentType, filename: att.name }],
  };
};

export const ComposerAttachmentsProvider = ({
  children,
  controlled,
}: {
  children: ReactNode;
  controlled?: { value: ComposerAttachment[]; onChange: Dispatch<SetStateAction<ComposerAttachment[]>> };
}) => {
  const [localAttachments, setLocalAttachments] = useState<ComposerAttachment[]>([]);
  const attachments = controlled?.value ?? localAttachments;
  const setAttachments = controlled?.onChange ?? setLocalAttachments;
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );

  const addFiles = useCallback(
    async (files: File[] | FileList) => {
      const currentGeneration = generation.current;
      const list = await Promise.all(
        Array.from(files).map(async file => {
          const attachment = toAttachment(file);
          if (
            attachment.kind === 'file' &&
            !attachment.contentType.startsWith('application/vnd.ms-excel') &&
            !attachment.contentType.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml') &&
            (await looksLikeText(file))
          ) {
            return { ...attachment, kind: 'text' as const, contentType: 'text/plain' };
          }
          return attachment;
        }),
      );
      const accepted = list.filter(attachment => attachment.kind !== 'file');
      if (accepted.length > 0 && generation.current === currentGeneration)
        setAttachments(prev => [...prev, ...accepted]);
      return list.filter(attachment => attachment.kind === 'file').map(attachment => attachment.name);
    },
    [setAttachments],
  );

  const addUrl = useCallback(
    async (url: string) => {
      const currentGeneration = generation.current;
      const contentType = (await getFileContentType(url)) ?? 'application/octet-stream';
      // URL attachments are represented by an empty File named with the URL.
      const file = new File([], url, { type: contentType });
      if (generation.current === currentGeneration) setAttachments(prev => [...prev, toAttachment(file)]);
    },
    [setAttachments],
  );

  const remove = useCallback(
    (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
    },
    [setAttachments],
  );

  const clear = useCallback(() => {
    generation.current++;
    setAttachments([]);
  }, [setAttachments]);

  const toCoreUserMessages = useCallback(async () => {
    return Promise.all(attachments.map(attachmentToCoreUserMessage));
  }, [attachments]);

  const value = useMemo<ComposerAttachmentsContextValue>(
    () => ({
      attachments,
      addFiles,
      addUrl,
      remove,
      clear,
      cancelPending: () => {
        generation.current++;
      },
      toCoreUserMessages,
    }),
    [attachments, addFiles, addUrl, remove, clear, toCoreUserMessages],
  );

  return <ComposerAttachmentsContext.Provider value={value}>{children}</ComposerAttachmentsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- context hook intentionally co-located with its provider
export const useComposerAttachments = (): ComposerAttachmentsContextValue => {
  const ctx = useContext(ComposerAttachmentsContext);
  if (!ctx) {
    throw new Error('useComposerAttachments must be used within a ComposerAttachmentsProvider');
  }
  return ctx;
};
