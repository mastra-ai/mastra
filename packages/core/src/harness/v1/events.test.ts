import { describe, expect, it } from 'vitest';

import {
  HarnessQueueFullError,
  HarnessRuntimeDependencyDriftError,
  HarnessValidationError,
  getHarnessPublicErrorCode,
} from './errors';
import { formatHarnessEventId, parseHarnessEventId, projectHarnessPublicError } from './events';

describe('Harness v1 event ids and public errors', () => {
  it('round trips canonical event ids', () => {
    const eventId = formatHarnessEventId('epoch-1', 42);

    expect(eventId).toBe('harness-v1:epoch-1:42');
    expect(parseHarnessEventId(eventId)).toEqual({ epoch: 'epoch-1', sequence: 42 });
  });

  it.each([
    () => formatHarnessEventId('', 1),
    () => formatHarnessEventId('bad:epoch', 1),
    () => formatHarnessEventId('epoch-1', -1),
    () => formatHarnessEventId('epoch-1', 1.2),
    () => formatHarnessEventId('epoch-1', Number.MAX_SAFE_INTEGER + 1),
  ])('rejects invalid formatted event ids', makeInvalidEventId => {
    expect(makeInvalidEventId).toThrow(HarnessValidationError);
  });

  it.each([
    'bad-id',
    'harness-v1::1',
    'harness-v1:epoch-1:',
    'harness-v1:epoch-1:01',
    'harness-v1:epoch-1:-1',
    'harness-v1:epoch-1:1.2',
    'harness-v1:epoch-1:9007199254740992',
  ])('rejects malformed event id %s', eventId => {
    expect(() => parseHarnessEventId(eventId)).toThrow(HarnessValidationError);
  });

  it('projects Harness errors to stable public codes instead of class names', () => {
    expect(getHarnessPublicErrorCode(new HarnessQueueFullError('session-1', 2))).toBe('harness.queue_full');
    expect(
      projectHarnessPublicError(
        new HarnessRuntimeDependencyDriftError('mode', 'build', 'is no longer configured', 'wakeup'),
      ),
    ).toMatchObject({
      code: 'harness.runtime_dependency_drifted',
      message: expect.stringContaining('Runtime dependency drifted'),
    });
  });
});
