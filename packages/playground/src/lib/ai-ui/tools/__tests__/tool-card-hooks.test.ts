import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Regression test for GitHub issue #12726
 *
 * React error #310: "Rendered more hooks than during the previous render"
 *
 * Root cause: the tool-dispatch component (now `ToolCardInner` in tool-card.tsx,
 * previously `ToolFallbackInner`) has an early return for
 * `toolName === 'mastra-memory-om-observation'`. If that early return sits BEFORE
 * any hooks, React reuses the same fiber position during streaming (when the tool
 * call list changes) and detects a hook-count mismatch, throwing error #310.
 *
 * This test guards the fix: all hooks must run unconditionally at the top of
 * `ToolCardInner`, before the observation-marker early return.
 */
describe('ToolCardInner - Rules of Hooks (issue #12726)', () => {
  const sourceFile = resolve(__dirname, '../tool-card.tsx');
  const source = readFileSync(sourceFile, 'utf-8');
  const lines = source.split('\n');

  it('should not have hook calls after the early return for observation markers', () => {
    const componentStartIdx = lines.findIndex(line => line.includes('const ToolCardInner'));
    expect(componentStartIdx, 'Could not find ToolCardInner component').toBeGreaterThan(-1);

    // Find the early return for 'mastra-memory-om-observation'
    let earlyReturnLine = -1;
    for (let i = componentStartIdx; i < lines.length; i++) {
      if (lines[i].includes('mastra-memory-om-observation')) {
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].trim().startsWith('return')) {
            earlyReturnLine = j + 1; // 1-indexed
            break;
          }
        }
        break;
      }
    }
    expect(earlyReturnLine, 'Could not find early return for observation markers').toBeGreaterThan(-1);

    // Find the end of the ToolCardInner component (closing `};`)
    let componentEndIdx = lines.length;
    for (let i = componentStartIdx + 1; i < lines.length; i++) {
      if (lines[i].trimStart() === '};' || lines[i] === '};') {
        componentEndIdx = i;
        break;
      }
    }

    // Find all hook calls AFTER the early return, within the component
    const hookPattern = /\buse[A-Z]\w*\s*[(<]/;
    const hooksAfterReturn: { line: number; text: string }[] = [];

    for (let i = earlyReturnLine; i < componentEndIdx; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      if (hookPattern.test(trimmed)) {
        hooksAfterReturn.push({ line: i + 1, text: trimmed });
      }
    }

    expect(
      hooksAfterReturn,
      `Found ${hooksAfterReturn.length} hook call(s) after early return at line ${earlyReturnLine}.\n` +
        `This violates React's Rules of Hooks and causes error #310 (issue #12726).\n` +
        `When toolName changes between 'mastra-memory-om-observation' and other values,\n` +
        `the early return skips these hooks, causing a hook count mismatch.\n\n` +
        `Fix: Move all hooks to the top of ToolCardInner, before the early return.\n\n` +
        hooksAfterReturn.map(h => `  Line ${h.line}: ${h.text}`).join('\n'),
    ).toHaveLength(0);
  });

  it('should call hooks unconditionally at the top of ToolCardInner', () => {
    const componentStartIdx = lines.findIndex(line => line.includes('const ToolCardInner'));

    let bodyStartIdx = -1;
    for (let i = componentStartIdx; i < lines.length; i++) {
      if (lines[i].includes('=> {')) {
        bodyStartIdx = i;
        break;
      }
    }
    expect(bodyStartIdx, 'Could not find ToolCardInner body').toBeGreaterThan(-1);

    let firstStatementIdx = -1;
    for (let i = bodyStartIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      firstStatementIdx = i;
      break;
    }
    expect(firstStatementIdx).toBeGreaterThan(-1);

    const firstStatement = lines[firstStatementIdx].trim();
    expect(
      firstStatement.startsWith('if ') || firstStatement.startsWith('if(') || firstStatement.startsWith('switch'),
      `First statement in ToolCardInner is a conditional: "${firstStatement}"\n` +
        `This means hooks below it may be skipped, violating React's Rules of Hooks.\n` +
        `Hooks must be called unconditionally at the top of the component.`,
    ).toBe(false);
  });
});
