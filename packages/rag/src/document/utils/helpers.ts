import { createHash } from 'crypto';
import type { BaseNode } from '../schema';
import type { MessageContent, MessageContentTextDetail, ObjectEntries } from './types';
/**
 * Extracts just the text whether from
 *  a multi-modal message
 *  a single text message
 *  or a query
 *
 * @param message The message to extract text from.
 * @returns The extracted text
 */
export function extractText(message: MessageContent): string {
  if (typeof message !== 'string' && !Array.isArray(message)) {
    console.warn('extractText called with non-MessageContent message, this is likely a bug.');
    return `${message}`;
  } else if (typeof message !== 'string' && Array.isArray(message)) {
    // message is of type MessageContentDetail[] - retrieve just the text parts and concatenate them
    // so we can pass them to the context generator
    return message
      .filter((c): c is MessageContentTextDetail => c.type === 'text')
      .map(c => c.text)
      .join('\n\n');
  } else {
    return message;
  }
}

/**
 * Type safe version of `Object.entries`
 */

export function objectEntries<T extends Record<string, any>>(
  obj: T,
): ObjectEntries<{
  [K in keyof T]-?: NonNullable<T[K]>;
}> {
  return Object.entries(obj);
}

export function lazyInitHash(
  value: ClassAccessorDecoratorTarget<BaseNode, string>,
  _context: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<BaseNode, string> {
  return {
    get() {
      const oldValue = value.get.call(this);
      if (oldValue === '') {
        const hash = this.generateHash();
        value.set.call(this, hash);
      }
      return value.get.call(this);
    },
    set(newValue: string) {
      value.set.call(this, newValue);
    },
    init(value: string): string {
      return value;
    },
  };
}

export function createSHA256() {
  const hash = createHash('sha256');
  return {
    update(data: string | Uint8Array): void {
      hash.update(data);
    },
    digest() {
      return hash.digest('base64');
    },
  };
}
