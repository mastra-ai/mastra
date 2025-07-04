import { AppendMessage, CompleteAttachment, ThreadMessageLike } from '@assistant-ui/react';
import { CoreUserMessage } from '@mastra/core';
import { fileToBase64 } from '@/lib/file';
import { Attachment } from '@ai-sdk/ui-utils';

// Assitant UI -> Mastra Core UserMessage
export const attachmentToCoreMessage = async (
  attachments: AppendMessage['attachments'],
): Promise<Array<CoreUserMessage>> => {
  const promises = attachments
    .filter(attachment => attachment.type === 'image' || attachment.type === 'document')
    .map(async attachment => {
      if (attachment.type === 'document') {
        // @ts-expect-error - TODO: fix this type issue somehow
        const txt = attachment.content?.[0]?.text || '';

        if (attachment.contentType === 'application/pdf') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'file' as const,
                data: `data:application/pdf;base64,${txt}`,
                mimeType: attachment.contentType,
                filename: attachment.name,
              },
            ],
          };
        }

        return {
          role: 'user' as const,
          content: [
            {
              type: 'file' as const,
              data: txt,
              mimeType: attachment.contentType,
              filename: attachment.name,
            },
          ],
        };
      }

      return {
        role: 'user' as const,

        content: [
          {
            type: 'image' as const,
            image: await fileToBase64(attachment.file!),
            mimeType: attachment.file!.type,
          },
        ],
      };
    });

  return Promise.all(promises);
};

// Assistant UI -> Experimental_attachments
export const attachmentToExperimental = async (userMessage: AppendMessage['attachments']): Promise<Attachment[]> => {
  const promises = userMessage.map(async attachment => {
    if (attachment.type === 'document') {
      // @ts-expect-error - TODO: fix this type issue somehow
      const txt = attachment.content?.[0]?.text || '';

      if (attachment.contentType === 'application/pdf') {
        return {
          name: attachment.name,
          url: `data:application/pdf;base64,${txt}`,
          contentType: attachment.contentType,
        };
      }

      return {
        name: attachment.name,
        url: `data:text/plain;base64,${btoa(txt)}`,
        contentType: attachment.contentType,
      };
    }

    return {
      url: await fileToBase64(attachment.file!),
      name: attachment.name,
      contentType: attachment.contentType,
    };
  });

  return Promise.all(promises);
};

export const experimentalToAssistant = (experimental: Attachment[]): Array<CompleteAttachment['content'][number]> => {
  return experimental
    .filter(attachment => attachment.contentType)
    .map(attachment => {
      if (attachment.contentType?.startsWith('image/')) {
        return {
          type: 'image',
          image: attachment.url,
          mimeType: attachment.contentType!,
          name: attachment.name,
        };
      }

      if (attachment.contentType?.startsWith('application/pdf')) {
        return {
          type: 'file',
          data: attachment.url,
          mimeType: attachment.contentType!,
          name: attachment.name,
        };
      }

      return {
        type: 'file',
        data: atob(attachment.url.replace(/^data:text\/plain;base64,/, '')),
        mimeType: attachment.contentType!,
        name: attachment.name,
      };
    });
};
