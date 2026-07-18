import { describe, expect, it } from 'vitest';

import { clampAuditLimit } from './base';

describe('clampAuditLimit', () => {
  it('defaults non-finite values and truncates fractions', () => {
    expect(clampAuditLimit(undefined)).toBe(50);
    expect(clampAuditLimit(Number.NaN)).toBe(50);
    expect(clampAuditLimit(Number.POSITIVE_INFINITY)).toBe(50);
    expect(clampAuditLimit(12.9)).toBe(12);
  });

  it('clamps normalized values to the supported range', () => {
    expect(clampAuditLimit(0)).toBe(1);
    expect(clampAuditLimit(-12)).toBe(1);
    expect(clampAuditLimit(201)).toBe(200);
  });
});
