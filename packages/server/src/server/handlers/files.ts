import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';

interface FileContext extends Context {
  body?: {
    url: string;
  };
}

/**
 * Get a complete AI trace by trace ID
 * Returns all spans in the trace with their parent-child relationships
 */
export async function getFileContentTypeHandler({ body }: FileContext) {
  try {
    if (!body?.url) {
      throw new HTTPException(400, { message: 'URL is required' });
    }

    const response = await fetch(body.url, {
      method: 'HEAD',
    });

    const contentType = response.headers.get('content-type');

    return contentType;
  } catch (error) {
    handleError(error, 'Error getting Content Type');
  }
}
