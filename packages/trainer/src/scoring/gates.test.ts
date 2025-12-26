import { describe, it, expect } from 'vitest';
import { applyGates, createGate } from './gates';
import type { ScorerResult, Gate } from '../types';

describe('applyGates', () => {
  it('should pass when all gates pass', () => {
    const results: ScorerResult[] = [
      { scorerId: 'quality', score: 0.9 },
      { scorerId: 'safety', score: 1.0 },
    ];

    const gates: Gate[] = [
      { scorerId: 'quality', operator: 'gte', threshold: 0.8 },
      { scorerId: 'safety', operator: 'eq', threshold: 1.0 },
    ];

    const { passed, gateResults } = applyGates(results, gates);

    expect(passed).toBe(true);
    expect(gateResults).toHaveLength(2);
    expect(gateResults.every(gr => gr.passed)).toBe(true);
  });

  it('should fail when any gate fails', () => {
    const results: ScorerResult[] = [
      { scorerId: 'quality', score: 0.7 },
      { scorerId: 'safety', score: 1.0 },
    ];

    const gates: Gate[] = [
      { scorerId: 'quality', operator: 'gte', threshold: 0.8 },
      { scorerId: 'safety', operator: 'eq', threshold: 1.0 },
    ];

    const { passed, gateResults } = applyGates(results, gates);

    expect(passed).toBe(false);
    expect(gateResults[0]?.passed).toBe(false);
    expect(gateResults[1]?.passed).toBe(true);
  });

  it('should handle missing scorers as 0', () => {
    const results: ScorerResult[] = [];

    const gates: Gate[] = [{ scorerId: 'quality', operator: 'gte', threshold: 0.5 }];

    const { passed, gateResults } = applyGates(results, gates);

    expect(passed).toBe(false);
    expect(gateResults[0]?.actualValue).toBe(0);
  });

  it('should support all operators', () => {
    const results: ScorerResult[] = [{ scorerId: 'score', score: 0.5 }];

    // gte
    expect(applyGates(results, [createGate('score', 'gte', 0.5)]).passed).toBe(true);
    expect(applyGates(results, [createGate('score', 'gte', 0.6)]).passed).toBe(false);

    // gt
    expect(applyGates(results, [createGate('score', 'gt', 0.4)]).passed).toBe(true);
    expect(applyGates(results, [createGate('score', 'gt', 0.5)]).passed).toBe(false);

    // lte
    expect(applyGates(results, [createGate('score', 'lte', 0.5)]).passed).toBe(true);
    expect(applyGates(results, [createGate('score', 'lte', 0.4)]).passed).toBe(false);

    // lt
    expect(applyGates(results, [createGate('score', 'lt', 0.6)]).passed).toBe(true);
    expect(applyGates(results, [createGate('score', 'lt', 0.5)]).passed).toBe(false);

    // eq
    expect(applyGates(results, [createGate('score', 'eq', 0.5)]).passed).toBe(true);
    expect(applyGates(results, [createGate('score', 'eq', 0.6)]).passed).toBe(false);
  });
});

describe('createGate', () => {
  it('should create a gate configuration', () => {
    const gate = createGate('quality', 'gte', 0.8);

    expect(gate).toEqual({
      scorerId: 'quality',
      operator: 'gte',
      threshold: 0.8,
    });
  });
});
