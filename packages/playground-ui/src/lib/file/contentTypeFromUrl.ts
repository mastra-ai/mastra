import { EXTENSION_TO_MIME } from './constants';
import { NON_FETCHABLE_REMOTE_SCHEMES } from './schemes';

/** Infer a MIME type from a URL/path's file extension. */
const contentTypeFromExtension = (url: string): string | undefined => {
  try {
    const { pathname } = new URL(url);
    const extension = pathname.split('.').pop();
    if (!extension) return undefined;
    return EXTENSION_TO_MIME[extension.toLowerCase()];
  } catch {
    // url is not a valid absolute URL (e.g. a relative path) — extract the
    // extension from the raw string so we still return a useful MIME type.
    const extension = url.split('.').pop()?.split(/[?#]/)[0];
    if (!extension) return undefined;
    return EXTENSION_TO_MIME[extension.toLowerCase()];
  }
};

export const getFileContentType = async (url: string) => {
  // Cloud-storage URIs are fetched server-side by the model provider (e.g. Vertex
  // AI for `gs://`, Bedrock for `s3://`); the browser cannot HEAD them, so infer
  // the content type from the extension directly.
  if (NON_FETCHABLE_REMOTE_SCHEMES.some(scheme => url.startsWith(scheme))) {
    return contentTypeFromExtension(url);
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
    });

    if (!response.ok) {
      throw new Error('Failed to get file content type');
    }

    const contentType = response.headers.get('content-type');

    if (!contentType) {
      throw new Error('Failed to get file content type');
    }

    return contentType;
  } catch {
    // fetch failed — try to infer content type from the file extension
    return contentTypeFromExtension(url);
  }
};
