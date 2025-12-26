import type { Gate, GateResult, ScorerResult } from '../types';

/**
 * Apply gates to scorer results.
 *
 * @param results - Array of scorer results
 * @param gates - Array of gates to check
 * @returns Object with pass/fail status and detailed results
 */
export function applyGates(results: ScorerResult[], gates: Gate[]): { passed: boolean; gateResults: GateResult[] } {
  const gateResults: GateResult[] = [];
  let allPassed = true;

  for (const gate of gates) {
    const result = results.find(r => r.scorerId === gate.scorerId);
    const score = result?.score ?? 0;

    const passed = evaluateGate(score, gate.operator, gate.threshold);

    gateResults.push({
      gate,
      passed,
      actualValue: score,
    });

    if (!passed) {
      allPassed = false;
    }
  }

  return {
    passed: allPassed,
    gateResults,
  };
}

/**
 * Evaluate a single gate condition.
 */
function evaluateGate(value: number, operator: Gate['operator'], threshold: number): boolean {
  switch (operator) {
    case 'gte':
      return value >= threshold;
    case 'gt':
      return value > threshold;
    case 'lte':
      return value <= threshold;
    case 'lt':
      return value < threshold;
    case 'eq':
      return Math.abs(value - threshold) < 0.0001; // Float comparison with tolerance
    default:
      return false;
  }
}

/**
 * Create a gate configuration.
 */
export function createGate(scorerId: string, operator: Gate['operator'], threshold: number): Gate {
  return { scorerId, operator, threshold };
}

/**
 * Format gate results for logging/display.
 */
export function formatGateResults(gateResults: GateResult[]): string {
  return gateResults
    .map(gr => {
      const status = gr.passed ? '✓' : '✗';
      const op = formatOperator(gr.gate.operator);
      return `${status} ${gr.gate.scorerId}: ${gr.actualValue.toFixed(3)} ${op} ${gr.gate.threshold}`;
    })
    .join('\n');
}

function formatOperator(op: Gate['operator']): string {
  switch (op) {
    case 'gte':
      return '>=';
    case 'gt':
      return '>';
    case 'lte':
      return '<=';
    case 'lt':
      return '<';
    case 'eq':
      return '==';
  }
}
