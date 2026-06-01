import { isUrlSupported } from '@ai-sdk/provider-utils-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { fetchWithRetry } from '../../../utils/fetchWithRetry';
import type { AIV5Type } from '../types';

/**
 * Strip query string and fragment from a URL for inclusion in human-readable
 * error text. Signed-URL query params (e.g. AWS pre-signed `X-Amz-Signature`,
 * WhatsApp media tokens, GCS `X-Goog-Signature`) carry secrets that should not
 * land in logs — but the scheme, host, and path are still useful for diagnosis.
 *
 * The full, unredacted URL is preserved on `error.details.url` for callers that
 * need to react programmatically (e.g. matching a failing URL back to the
 * specific message part for recovery). Mirrors the project convention of
 * redacting at the human-facing log boundary while keeping structured fields
 * raw (see `SENSITIVE_KEYS` in `tools/validation.ts` and `redactHeaders` in
 * server config).
 */
function redactUrlForLog(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

export const downloadFromUrl = async ({ url, downloadRetries }: { url: URL; downloadRetries: number }) => {
  const urlText = url.toString();
  const safeUrl = redactUrlForLog(url);

  try {
    const response = await fetchWithRetry(
      urlText,
      {
        method: 'GET',
      },
      downloadRetries,
      {
        shouldRetryResponse: response => response.status >= 500,
      },
    );

    if (!response.ok) {
      throw new MastraError({
        id: 'DOWNLOAD_ASSETS_FAILED',
        text: `Failed to download asset: ${safeUrl}`,
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
        details: { url: urlText },
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
        text: `Failed to download asset: ${safeUrl}`,
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
        details: { url: urlText },
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
    .map(part => {
      return {
        url: part.data,
        isUrlSupportedByModel:
          part.mediaType != null &&
          isUrlSupported({
            url: part.data.toString(),
            mediaType: part.mediaType,
            supportedUrls: supportedUrls ?? {},
          }),
      };
    });

  const downloadedFiles = await pMap(
    filesToDownload,
    async fileItem => {
      if (fileItem.isUrlSupportedByModel) {
        return null;
      }
      return {
        url: fileItem.url.toString(),
        ...(await downloadFromUrl({ url: fileItem.url, downloadRetries })),
      };
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
        url: string;
        mediaType: string | undefined;
        data: Uint8Array<ArrayBuffer>;
      } => downloadedFile?.data != null,
    )
    .map(({ url, data, mediaType }) => [url, { data, mediaType }]);

  return Object.fromEntries(downloadFileList);
}
