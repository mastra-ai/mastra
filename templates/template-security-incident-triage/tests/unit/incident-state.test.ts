import { describe, expect, it } from 'vitest';

import { assertTransition, canTransition, incidentTransitions } from '../../src/domain/incident-state.js';
import type { DomainError } from '../../src/domain/errors.js';
import { IncidentStatusSchema } from '../../src/schemas/incident.js';

describe('incident state machine', () => {
  it('accepts exactly the approved transition matrix', () => {
    for (const from of IncidentStatusSchema.options) {
      for (const to of IncidentStatusSchema.options) {
        const expected = (incidentTransitions[from] as readonly string[]).includes(to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
        if (expected) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow();
      }
    }
  });

  it('keeps closed terminal and allows controlled failed recovery', () => {
    expect(incidentTransitions.closed).toEqual([]);
    expect(incidentTransitions.failed).toEqual(['investigating', 'containing', 'closed']);
  });

  it('maps invalid statuses while preserving forbidden-transition errors', () => {
    expect(() => assertTransition('corrupted' as never, 'investigating')).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        name: 'DomainError',
        code: 'VALIDATION_FAILED',
        retryable: false,
      }),
    );
    expect(() => assertTransition('received', 'closed')).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        name: 'DomainError',
        code: 'INVALID_TRANSITION',
        retryable: false,
      }),
    );
  });
});
