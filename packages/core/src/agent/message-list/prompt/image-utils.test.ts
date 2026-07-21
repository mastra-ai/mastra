/**
 * Tests for packages/core/src/agent/message-list/prompt/image-utils.ts
 *
 * All exported helpers are pure functions — no I/O, no async behaviour,
 * no mocking required. The only external dependency is
 * `convertDataContentToBase64String` which is tested indirectly via the
 * binary-data paths of `imageContentToString`.
 */
import { describe, expect, it } from 'vitest';

import {
  categorizeFileData,
  classifyFileData,
  createDataUri,
  getImageCacheKey,
  imageContentToDataUri,
  imageContentToString,
  isValidUrl,
  parseDataUri,
  resolveFilePartMediaTypeAndData,
} from './image-utils';

// ---------------------------------------------------------------------------
// parseDataUri
// ---------------------------------------------------------------------------

describe('parseDataUri', () => {
  it('parses a standard base64 data URI', () => {
    const result = parseDataUri('data:image/png;base64,abc123==');
    expect(result.isDataUri).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.base64Content).toBe('abc123==');
  });

  it('parses a data URI without explicit base64 flag', () => {
    const result = parseDataUri('data:text/plain,hello+world');
    expect(result.isDataUri).toBe(true);
    expect(result.mimeType).toBe('text/plain');
    expect(result.base64Content).toBe('hello+world');
  });

  it('parses a data URI with no media type', () => {
    const result = parseDataUri('data:;base64,abc');
    expect(result.isDataUri).toBe(true);
    expect(result.mimeType).toBeUndefined();
    expect(result.base64Content).toBe('abc');
  });

  it('returns isDataUri = false for a plain string', () => {
    const result = parseDataUri('not-a-data-uri');
    expect(result.isDataUri).toBe(false);
    expect(result.base64Content).toBe('not-a-data-uri');
  });

  it('returns isDataUri = false for an https URL', () => {
    const result = parseDataUri('https://example.com/image.png');
    expect(result.isDataUri).toBe(false);
  });

  it('handles a malformed data URI (no comma)', () => {
    const result = parseDataUri('data:image/png;base64');
    expect(result.isDataUri).toBe(true);
    expect(result.base64Content).toBe('data:image/png;base64');
  });

  it('preserves the full base64 content after the comma', () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAUA';
    const result = parseDataUri(`data:image/png;base64,${b64}`);
    expect(result.base64Content).toBe(b64);
  });
});

// ---------------------------------------------------------------------------
// createDataUri
// ---------------------------------------------------------------------------

describe('createDataUri', () => {
  it('creates a data URI from base64 content and mimeType', () => {
    expect(createDataUri('abc123', 'image/jpeg')).toBe('data:image/jpeg;base64,abc123');
  });

  it('defaults to application/octet-stream when no mimeType given', () => {
    expect(createDataUri('abc123')).toBe('data:application/octet-stream;base64,abc123');
  });

  it('returns the input unchanged when it is already a data URI', () => {
    const uri = 'data:image/png;base64,existing';
    expect(createDataUri(uri, 'image/jpeg')).toBe(uri);
  });

  it('round-trips with parseDataUri', () => {
    const original = 'iVBORw0KGgo=';
    const uri = createDataUri(original, 'image/png');
    const parsed = parseDataUri(uri);
    expect(parsed.mimeType).toBe('image/png');
    expect(parsed.base64Content).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// imageContentToString
// ---------------------------------------------------------------------------

describe('imageContentToString', () => {
  it('returns a plain string as-is', () => {
    expect(imageContentToString('https://example.com/img.png')).toBe('https://example.com/img.png');
  });

  it('returns a data URI string as-is', () => {
    const uri = 'data:image/png;base64,abc';
    expect(imageContentToString(uri)).toBe(uri);
  });

  it('converts a URL object to its string representation', () => {
    const url = new URL('https://example.com/photo.jpg');
    expect(imageContentToString(url)).toBe('https://example.com/photo.jpg');
  });

  it('converts a Uint8Array to base64', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const result = imageContentToString(bytes);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('wraps Uint8Array in data URI when fallbackMimeType is given', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = imageContentToString(bytes, 'image/png');
    expect(result.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('converts an ArrayBuffer to base64', () => {
    const buf = new Uint8Array([65, 66, 67]).buffer; // "ABC"
    const result = imageContentToString(buf);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// imageContentToDataUri
// ---------------------------------------------------------------------------

describe('imageContentToDataUri', () => {
  it('returns a data URI string unchanged', () => {
    const uri = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(imageContentToDataUri(uri)).toBe(uri);
  });

  it('returns an https URL unchanged (cannot convert)', () => {
    const url = 'https://example.com/avatar.png';
    expect(imageContentToDataUri(url)).toBe(url);
  });

  it('returns an http URL unchanged', () => {
    const url = 'http://example.com/img.gif';
    expect(imageContentToDataUri(url)).toBe(url);
  });

  it('wraps a plain base64 string as a data URI with default mimeType', () => {
    const b64 = 'iVBORw0KGgo=';
    const result = imageContentToDataUri(b64);
    expect(result).toBe(`data:image/png;base64,${b64}`);
  });

  it('uses the provided mimeType when wrapping base64', () => {
    const b64 = '/9j/4AAQSkZJRgAB';
    const result = imageContentToDataUri(b64, 'image/jpeg');
    expect(result).toBe(`data:image/jpeg;base64,${b64}`);
  });

  it('converts a URL object to its href and returns unchanged', () => {
    const url = new URL('https://cdn.example.com/logo.svg');
    const result = imageContentToDataUri(url);
    expect(result).toBe('https://cdn.example.com/logo.svg');
  });
});

// ---------------------------------------------------------------------------
// getImageCacheKey
// ---------------------------------------------------------------------------

describe('getImageCacheKey', () => {
  it('returns the URL href for a URL object', () => {
    const url = new URL('https://example.com/img.png');
    expect(getImageCacheKey(url)).toBe('https://example.com/img.png');
  });

  it('returns the length for a string', () => {
    expect(getImageCacheKey('hello')).toBe(5);
    expect(getImageCacheKey('')).toBe(0);
  });

  it('returns byteLength for a Uint8Array', () => {
    const arr = new Uint8Array(16);
    expect(getImageCacheKey(arr)).toBe(16);
  });

  it('returns byteLength for an ArrayBuffer', () => {
    const buf = new ArrayBuffer(32);
    expect(getImageCacheKey(buf)).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// isValidUrl
// ---------------------------------------------------------------------------

describe('isValidUrl', () => {
  it('returns true for https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('returns true for http URLs', () => {
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('returns true for protocol-relative URLs', () => {
    expect(isValidUrl('//example.com/image.png')).toBe(true);
  });

  it('returns false for a plain string', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('returns false for a base64 string', () => {
    expect(isValidUrl('iVBORw0KGgo=')).toBe(false);
  });

  it('returns true for a data URI', () => {
    expect(isValidUrl('data:image/png;base64,abc')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// categorizeFileData
// ---------------------------------------------------------------------------

describe('categorizeFileData', () => {
  it('categorises a data URI as "dataUri" and extracts mimeType', () => {
    const result = categorizeFileData('data:image/png;base64,abc');
    expect(result.type).toBe('dataUri');
    expect(result.mimeType).toBe('image/png');
    expect(result.data).toBe('data:image/png;base64,abc');
  });

  it('categorises an https URL as "url"', () => {
    const result = categorizeFileData('https://example.com/image.png');
    expect(result.type).toBe('url');
    expect(result.data).toBe('https://example.com/image.png');
  });

  it('categorises a plain base64 string as "raw"', () => {
    const result = categorizeFileData('iVBORw0KGgo=');
    expect(result.type).toBe('raw');
  });

  it('uses fallbackMimeType for a URL when no mimeType in data', () => {
    const result = categorizeFileData('https://example.com/img', 'image/jpeg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('data URI mimeType takes precedence over fallback', () => {
    const result = categorizeFileData('data:image/png;base64,abc', 'image/jpeg');
    expect(result.mimeType).toBe('image/png');
  });

  it('falls back to fallbackMimeType for raw data', () => {
    const result = categorizeFileData('rawstuff', 'image/gif');
    expect(result.mimeType).toBe('image/gif');
  });
});

// ---------------------------------------------------------------------------
// classifyFileData
// ---------------------------------------------------------------------------

describe('classifyFileData', () => {
  it('classifies a data URI as "dataUri" with mimeType', () => {
    const result = classifyFileData('data:image/jpeg;base64,/9j/');
    expect(result.type).toBe('dataUri');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('classifies an https URL as "url"', () => {
    expect(classifyFileData('https://example.com/img.png').type).toBe('url');
  });

  it('classifies a long base64-looking string as "base64"', () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby';
    expect(classifyFileData(b64).type).toBe('base64');
  });

  it('classifies a short non-URL, non-b64 string as "other"', () => {
    expect(classifyFileData('hello').type).toBe('other');
  });

  it('returns no mimeType for a URL', () => {
    expect(classifyFileData('https://example.com').mimeType).toBeUndefined();
  });

  it('returns no mimeType for base64', () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby';
    expect(classifyFileData(b64).mimeType).toBeUndefined();
  });
});

describe('resolveFilePartMediaTypeAndData', () => {
  it('reads the v4 shape (mimeType/data)', () => {
    expect(resolveFilePartMediaTypeAndData({ mimeType: 'application/pdf', data: 'JVBERi0=' })).toEqual({
      mediaType: 'application/pdf',
      data: 'JVBERi0=',
    });
  });

  it('reads the v5 shape (mediaType/url)', () => {
    expect(resolveFilePartMediaTypeAndData({ mediaType: 'image/png', url: 'https://example.com/a.png' })).toEqual({
      mediaType: 'image/png',
      data: 'https://example.com/a.png',
    });
  });

  it('prefers the v4 fields when both shapes are present', () => {
    expect(
      resolveFilePartMediaTypeAndData({
        mimeType: 'application/pdf',
        data: 'v4-data',
        mediaType: 'image/png',
        url: 'v5-url',
      }),
    ).toEqual({ mediaType: 'application/pdf', data: 'v4-data' });
  });

  it('preserves undefined when neither shape carries the field', () => {
    expect(resolveFilePartMediaTypeAndData({ type: 'file' })).toEqual({ mediaType: undefined, data: undefined });
  });
});
