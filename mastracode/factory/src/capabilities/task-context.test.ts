import { describe, expect, it } from 'vitest';

import {
  boundedTaskContextDetail,
  isTaskContextProviderRequestError,
  TaskContextProviderRequestError,
} from './task-context.js';

const detail = {
  identifier: 'ENG-42',
  title: 'Task title',
  description: null,
  state: 'open',
  labels: [],
  assignees: [],
  url: null,
};

describe('task-context capability', () => {
  it.each([
    ['malformed', 'not a url'],
    ['non-http', 'ftp://example.com/task'],
    ['unsafe', 'javascript:alert(1)'],
  ])('omits %s provider URLs', (_label, url) => {
    expect(boundedTaskContextDetail({ ...detail, url }).url).toBeNull();
  });

  it('preserves safe HTTP provider URLs', () => {
    expect(boundedTaskContextDetail({ ...detail, url: 'https://example.com/task' }).url).toBe(
      'https://example.com/task',
    );
  });

  it('recognizes provider errors across duplicate module copies without accepting bare codes', () => {
    expect(isTaskContextProviderRequestError(new TaskContextProviderRequestError('provider failed'))).toBe(true);
    expect(
      isTaskContextProviderRequestError({
        code: 'TASK_CONTEXT_PROVIDER_REQUEST_FAILED',
        name: 'TaskContextProviderRequestError',
        message: 'provider failed',
      }),
    ).toBe(true);
    expect(isTaskContextProviderRequestError({ code: 'TASK_CONTEXT_PROVIDER_REQUEST_FAILED' })).toBe(false);
  });
});
