import { EXTENSION_TO_MIME } from './constants';

export const getFileContentType = async (url: string) => {
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
    try {
      const urlObject = new URL(url);
      const pathname = urlObject.pathname;
      const extension = pathname.split('.').pop();
      if (!extension) return undefined;
      return EXTENSION_TO_MIME[extension.toLowerCase()];
    } catch {
      // url is not a valid absolute URL (e.g. a relative path) — extract
      // extension from the raw string so we still return a useful MIME type.
      const extension = url.split('.').pop()?.split(/[?#]/)[0];
      if (!extension) return undefined;
      return EXTENSION_TO_MIME[extension.toLowerCase()];
    }
  }
};
