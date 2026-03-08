import { describe, expect, it } from 'vitest';
import { getNestedValue, evaluateMatch, evaluateExpression, evaluateEventConditions } from './event-match';

describe('getNestedValue', () => {
  it('retrieves a top-level field', () => {
    expect(getNestedValue({ name: 'Alice' }, 'name')).toBe('Alice');
  });

  it('retrieves deeply nested fields', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getNestedValue(obj, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing paths', () => {
    expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined();
    expect(getNestedValue({ a: { b: 1 } }, 'a.c')).toBeUndefined();
  });

  it('returns undefined for null/undefined objects', () => {
    expect(getNestedValue(null, 'a')).toBeUndefined();
    expect(getNestedValue(undefined, 'a')).toBeUndefined();
  });

  it('returns undefined when traversing through a primitive', () => {
    expect(getNestedValue({ a: 'hello' }, 'a.b')).toBeUndefined();
  });

  it('retrieves numeric values and booleans', () => {
    const obj = { count: 0, active: false };
    expect(getNestedValue(obj, 'count')).toBe(0);
    expect(getNestedValue(obj, 'active')).toBe(false);
  });
});

describe('evaluateMatch', () => {
  it('returns true when the field values are equal', () => {
    const event = { invoiceId: 'inv-123' };
    const suspend = { invoiceId: 'inv-123' };
    expect(evaluateMatch(event, suspend, 'invoiceId')).toBe(true);
  });

  it('returns false when the field values differ', () => {
    const event = { invoiceId: 'inv-123' };
    const suspend = { invoiceId: 'inv-456' };
    expect(evaluateMatch(event, suspend, 'invoiceId')).toBe(false);
  });

  it('matches on nested paths', () => {
    const event = { data: { userId: 'u-1' } };
    const suspend = { data: { userId: 'u-1' } };
    expect(evaluateMatch(event, suspend, 'data.userId')).toBe(true);
  });

  it('returns false when path exists in one but not the other', () => {
    const event = { data: { userId: 'u-1' } };
    const suspend = { data: {} };
    expect(evaluateMatch(event, suspend, 'data.userId')).toBe(false);
  });

  it('returns true when both paths are undefined', () => {
    expect(evaluateMatch({}, {}, 'missing')).toBe(true);
  });

  it('uses strict equality (no type coercion)', () => {
    const event = { id: '1' };
    const suspend = { id: 1 };
    expect(evaluateMatch(event, suspend, 'id')).toBe(false);
  });
});

describe('evaluateExpression', () => {
  it('evaluates simple equality', () => {
    expect(evaluateExpression('event.id == async.id', { id: 'x' }, { id: 'x' })).toBe(true);
    expect(evaluateExpression('event.id == async.id', { id: 'x' }, { id: 'y' })).toBe(false);
  });

  it('evaluates inequality', () => {
    expect(evaluateExpression("event.status != 'pending'", { status: 'approved' }, {})).toBe(true);
    expect(evaluateExpression("event.status != 'pending'", { status: 'pending' }, {})).toBe(false);
  });

  it('evaluates && (logical AND)', () => {
    const expr = "event.userId == async.userId && event.plan == 'pro'";
    expect(evaluateExpression(expr, { userId: 'u1', plan: 'pro' }, { userId: 'u1' })).toBe(true);
    expect(evaluateExpression(expr, { userId: 'u1', plan: 'free' }, { userId: 'u1' })).toBe(false);
    expect(evaluateExpression(expr, { userId: 'u2', plan: 'pro' }, { userId: 'u1' })).toBe(false);
  });

  it('evaluates || (logical OR)', () => {
    const expr = "event.role == 'admin' || event.role == 'manager'";
    expect(evaluateExpression(expr, { role: 'admin' }, {})).toBe(true);
    expect(evaluateExpression(expr, { role: 'manager' }, {})).toBe(true);
    expect(evaluateExpression(expr, { role: 'viewer' }, {})).toBe(false);
  });

  it('handles nested dot-paths', () => {
    const expr = 'event.data.invoiceId == async.data.invoiceId';
    expect(evaluateExpression(expr, { data: { invoiceId: 'i-1' } }, { data: { invoiceId: 'i-1' } })).toBe(true);
    expect(evaluateExpression(expr, { data: { invoiceId: 'i-2' } }, { data: { invoiceId: 'i-1' } })).toBe(false);
  });

  it('handles string literals with single quotes', () => {
    expect(evaluateExpression("event.name == 'Alice'", { name: 'Alice' }, {})).toBe(true);
    expect(evaluateExpression("event.name == 'Bob'", { name: 'Alice' }, {})).toBe(false);
  });

  it('handles string literals with double quotes', () => {
    expect(evaluateExpression('event.name == "Alice"', { name: 'Alice' }, {})).toBe(true);
  });

  it('handles numeric comparisons', () => {
    expect(evaluateExpression('event.count == 5', { count: 5 }, {})).toBe(true);
    expect(evaluateExpression('event.count == 5', { count: 3 }, {})).toBe(false);
  });

  it('handles boolean literals', () => {
    expect(evaluateExpression('event.active == true', { active: true }, {})).toBe(true);
    expect(evaluateExpression('event.active == false', { active: false }, {})).toBe(true);
  });

  it('supports parenthesized sub-expressions', () => {
    const expr = "(event.a == 'x' || event.a == 'y') && event.b == 'z'";
    expect(evaluateExpression(expr, { a: 'x', b: 'z' }, {})).toBe(true);
    expect(evaluateExpression(expr, { a: 'y', b: 'z' }, {})).toBe(true);
    expect(evaluateExpression(expr, { a: 'x', b: 'w' }, {})).toBe(false);
    expect(evaluateExpression(expr, { a: 'q', b: 'z' }, {})).toBe(false);
  });

  it('treats empty expression as a pass-through', () => {
    expect(evaluateExpression('', {}, {})).toBe(true);
  });

  it('throws on unknown root variables', () => {
    expect(() => evaluateExpression('foo.bar == 1', {}, {})).toThrow("Unknown variable 'foo'");
  });

  it('throws on unexpected characters', () => {
    expect(() => evaluateExpression('event.x > 5', {}, {})).toThrow('Unexpected character');
  });

  it('handles negative numbers', () => {
    expect(evaluateExpression('event.offset == -10', { offset: -10 }, {})).toBe(true);
  });

  it('uses strict equality for cross-type comparisons', () => {
    // string '5' vs number 5 should NOT match with strict equality
    expect(evaluateExpression("event.id == '5'", { id: 5 }, {})).toBe(false);
    expect(evaluateExpression('event.id == 5', { id: '5' }, {})).toBe(false);
    // same type should match
    expect(evaluateExpression('event.id == 5', { id: 5 }, {})).toBe(true);
    expect(evaluateExpression("event.id == '5'", { id: '5' }, {})).toBe(true);
  });

  it('evaluates AND requiring both sides to be true', () => {
    const expr = "event.a == 'no' && event.b == 'yes'";
    expect(evaluateExpression(expr, { a: 'no', b: 'yes' }, {})).toBe(true);
    expect(evaluateExpression(expr, { a: 'yes', b: 'yes' }, {})).toBe(false);
  });

  it('short-circuits OR when left side is true', () => {
    const expr = "event.a == 'yes' || event.b == 'yes'";
    expect(evaluateExpression(expr, { a: 'yes', b: 'no' }, {})).toBe(true);
  });

  it('handles escaped quotes in strings', () => {
    expect(evaluateExpression("event.name == 'it\\'s'", { name: "it's" }, {})).toBe(true);
  });

  it('throws on unterminated single-quoted string', () => {
    expect(() => evaluateExpression("event.name == 'hello", {}, {})).toThrow('Unterminated string literal');
  });

  it('throws on unterminated double-quoted string', () => {
    expect(() => evaluateExpression('event.name == "hello', {}, {})).toThrow('Unterminated string literal');
  });
});

describe('evaluateEventConditions', () => {
  it('passes when no conditions are specified', () => {
    expect(evaluateEventConditions({}, { anything: true })).toBe(true);
  });

  it('evaluates match condition alone', () => {
    const condition = { match: 'orderId', suspendContext: { orderId: 'o-1' } };
    expect(evaluateEventConditions(condition, { orderId: 'o-1' })).toBe(true);
    expect(evaluateEventConditions(condition, { orderId: 'o-2' })).toBe(false);
  });

  it('evaluates if condition alone', () => {
    const condition = { if: "event.status == 'approved'", suspendContext: {} };
    expect(evaluateEventConditions(condition, { status: 'approved' })).toBe(true);
    expect(evaluateEventConditions(condition, { status: 'rejected' })).toBe(false);
  });

  it('requires both match and if to pass when both are specified', () => {
    const condition = {
      match: 'userId',
      if: "event.plan == 'pro'",
      suspendContext: { userId: 'u-1' },
    };
    expect(evaluateEventConditions(condition, { userId: 'u-1', plan: 'pro' })).toBe(true);
    expect(evaluateEventConditions(condition, { userId: 'u-1', plan: 'free' })).toBe(false);
    expect(evaluateEventConditions(condition, { userId: 'u-2', plan: 'pro' })).toBe(false);
  });

  it('defaults suspendContext to empty object when absent', () => {
    const condition = { match: 'id' };
    expect(evaluateEventConditions(condition, { id: undefined })).toBe(true);
  });
});
