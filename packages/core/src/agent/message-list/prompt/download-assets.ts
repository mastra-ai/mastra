import { isUrlSupported } from '@ai-sdk/provider-utils-v6';
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
  if (url.protocol === 'data:') {
    // `origin` is "null" for data URLs and the pathname is the whole (possibly huge) payload.
    const commaIndex = url.pathname.indexOf(',');
    const header = commaIndex === -1 ? url.pathname : url.pathname.slice(0, commaIndex);
    const payloadLength = commaIndex === -1 ? 0 : url.pathname.length - commaIndex - 1;
    return `data:${header},<${payloadLength} chars>`;
  }
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
      // Decoding a data URL is deterministic, so retrying a failure only adds delay.
      url.protocol === 'data:' ? 1 : downloadRetries,
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

function toAssetUrl(part: AIV5Type.ImagePart | AIV5Type.FilePart) {
  const data = part.type === 'image' ? part.image : part.data;
  if (typeof data !== 'string') return data;
  try {
    return new URL(data);
  } catch {
    return data;
  }
}

/** The key a part's download result is stored under, or `undefined` when the part is not a URL. */
export function getAssetUrl(part: AIV5Type.ImagePart | AIV5Type.FilePart): string | undefined {
  const data = toAssetUrl(part);
  return data instanceof URL ? data.toString() : undefined;
}

/**
 * Successful downloads keyed by URL, shared across the prompt builds of one run so
 * each attachment is downloaded at most once per run. Failures are not kept, so a
 * retry requested by an error processor fetches again.
 */
export type AssetDownloadCache = Map<string, ReturnType<typeof downloadFromUrl>>;

export function isDownloadAssetsError(error: unknown): error is MastraError {
  return error instanceof MastraError && error.id === 'DOWNLOAD_ASSETS_FAILED';
}

export async function downloadAssetsFromMessages({
  messages,
  downloadConcurrency = 10,
  downloadRetries = 3,
  supportedUrls,
  cache,
  isUnavailable,
  onUnavailable,
}: {
  messages: AIV5Type.ModelMessage[];
  downloadConcurrency?: number;
  downloadRetries?: number;
  supportedUrls?: Record<string, RegExp[]>;
  cache?: AssetDownloadCache;
  /** Returns true for URLs already known to be unavailable. They are not fetched. */
  isUnavailable?: (url: string) => boolean;
  /** When set, a failed download is reported here instead of failing the whole prompt. */
  onUnavailable?: (url: string, error: MastraError) => void;
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

      return { mediaType, data: toAssetUrl(part) };
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
      const url = fileItem.url.toString();
      if (fileItem.isUrlSupportedByModel || isUnavailable?.(url)) {
        return null;
      }
      let download = cache?.get(url);
      if (!download) {
        download = downloadFromUrl({ url: fileItem.url, downloadRetries });
        if (cache) {
          const cached = download;
          cache.set(url, cached);
          cached.catch(() => {
            if (cache.get(url) === cached) cache.delete(url);
          });
        }
      }
      try {
        return { url, ...(await download) };
      } catch (error) {
        if (!onUnavailable || !isDownloadAssetsError(error)) throw error;
        onUnavailable(url, error);
        return null;
      }
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
