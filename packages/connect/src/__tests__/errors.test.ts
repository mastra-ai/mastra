import { describe, expect, it } from 'vitest';

import { MastraConnectError, extractProblemDetail } from '../errors.js';

describe('MastraConnectError', () => {
  it('exposes the HTTP status under the axios-compatible response alias', () => {
    const error = new MastraConnectError('proxy_error', 'Provider request failed (404).', { status: 404 });
    expect(error.status).toBe(404);
    expect(error.response).toEqual({ status: 404 });
  });

  it('omits the response alias when the error carries no HTTP status', () => {
    const error = new MastraConnectError('invalid_options', 'bad options');
    expect(error.status).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  it('satisfies the generated Nango-template 404 handler pattern', () => {
    // Generated provider tools (e.g. github create_or_update_file) detect
    // missing resources with this exact axios-shaped check. It must keep
    // working against the errors this package throws.
    const error: unknown = new MastraConnectError('proxy_error', 'Provider request failed (404).', { status: 404 });
    const isNotFound =
      error !== null &&
      typeof error === 'object' &&
      'response' in error &&
      error.response !== null &&
      typeof error.response === 'object' &&
      'status' in error.response &&
      error.response.status === 404;
    expect(isNotFound).toBe(true);
  });
});

describe('extractProblemDetail', () => {
  function jsonResponse(body: unknown, contentType = 'application/json'): Response {
    return new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': contentType } });
  }

  it('prefers long_message over message in an errors[] payload', async () => {
    const result = await extractProblemDetail(
      jsonResponse({ errors: [{ message: 'short', long_message: 'The long explanation.', code: 'form_error' }] }),
    );
    expect(result.detail).toBe('The long explanation.');
    expect(result.isProblemJson).toBe(false);
  });

  it('falls back to message when long_message is absent', async () => {
    const result = await extractProblemDetail(jsonResponse({ errors: [{ message: 'Something failed.' }] }));
    expect(result.detail).toBe('Something failed.');
  });

  it('skips non-object and message-less entries in errors[]', async () => {
    const result = await extractProblemDetail(
      jsonResponse({ errors: [null, 'oops', 42, { code: 'no_message' }, { message: 'Found it.' }] }),
    );
    expect(result.detail).toBe('Found it.');
  });

  it('returns no detail for an empty errors[] array', async () => {
    const result = await extractProblemDetail(jsonResponse({ errors: [] }));
    expect(result.detail).toBeUndefined();
  });

  it('prefers top-level detail over an errors[] array', async () => {
    const result = await extractProblemDetail(
      jsonResponse({ detail: 'Top-level detail.', errors: [{ message: 'array message' }] }),
    );
    expect(result.detail).toBe('Top-level detail.');
  });

  it('flags RFC-7807 responses via the content type only', async () => {
    const result = await extractProblemDetail(
      jsonResponse({ title: 'Bad Request' }, 'application/problem+json; charset=utf-8'),
    );
    expect(result.detail).toBe('Bad Request');
    expect(result.isProblemJson).toBe(true);
  });

  it('returns no detail for a non-JSON body', async () => {
    const response = new Response('<html>nope</html>', { status: 502, headers: { 'content-type': 'text/html' } });
    const result = await extractProblemDetail(response);
    expect(result.detail).toBeUndefined();
    expect(result.isProblemJson).toBe(false);
  });
});
