import { isUrlSupported } from '@ai-sdk/provider-utils-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { fetchWithRetry } from '../../../utils';
import type { AIV5Type } from '../types';

export const downloadFromUrl = async ({ url, downloadRetries }: { url: URL; downloadRetries: number }) => {
  const urlText = url.toString();

  try {
    const response = await fetchWithRetry(
      urlText,
      {
        method: 'GET',
      },
      downloadRetries,
    );

    if (!response.ok) {
      throw new MastraError({
        id: 'DOWNLOAD_ASSETS_FAILED',
        text: 'Failed to download asset',
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
      });
    }
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      mediaType: response.headers.get('content-type') ?? undefined,
    };
  } catch (error) {
    throw new MastraError(
      {
        id: 'DOWNLOAD_ASSETS_FAILED',
        text: 'Failed to download asset',
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
};

export async function downloadAssetsFromMessages({
  messages,
  downloadConcurrency = 10,
  downloadRetries = 3,
  supportedUrls,
}: {
  messages: AIV5Type.ModelMessage[];
  downloadConcurrency?: number;
  downloadRetries?: number;
  supportedUrls?: Record<string, RegExp[]>;
}) {
  const pMap = (await import('p-map')).default;

  const filesToDownload = messages
    .filter(message => message.role === 'user')
    .map(message => message.content)
    .filter(content => Array.isArray(content))
    .flat()
    .filter(part => part.type === 'image' || part.type === 'file')
    .map(part => {
      const mediaType = part.mediaType ?? (part.type === 'image' ? 'image/*' : undefined);

      let data = part.type === 'image' ? part.image : part.data;
      if (typeof data === 'string') {
        try {
          data = new URL(data);
        } catch {}
      }

      return { mediaType, data };
    })

    .filter((part): part is { mediaType: string | undefined; data: URL } => part.data instanceof URL)
    .map(part => ({
      url: part.data,
      isUrlSupportedByModel:
        part.mediaType != null &&
        isUrlSupported({
          url: part.data.toString(),
          mediaType: part.mediaType,
          supportedUrls: supportedUrls ?? {},
        }),
    }));

  const downloadedFiles = await pMap(
    filesToDownload,
    async fileItem => {
      return downloadFromUrl({ url: fileItem.url, downloadRetries });
    },
    {
      concurrency: downloadConcurrency,
    },
  );

  const downloadFileList = downloadedFiles
    .filter(
      (
        downloadedFile,
      ): downloadedFile is {
        mediaType: string | undefined;
        data: Uint8Array;
      } => downloadedFile?.data != null,
    )
    .map(({ data, mediaType }, index) => [filesToDownload?.[index]?.url.toString(), { data, mediaType }]);

  return Object.fromEntries(downloadFileList);
}
