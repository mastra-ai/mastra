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
    const urlObject = new URL(url);
    const pathname = urlObject.pathname;

    const extension = pathname.split('.').pop();
    if (!extension) return undefined;
    const lowerCaseExtension = extension.toLowerCase();

    return EXTENSION_TO_MIME[lowerCaseExtension];
  }
};
