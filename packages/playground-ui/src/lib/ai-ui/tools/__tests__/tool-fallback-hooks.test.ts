import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression test for GitHub issue #12726
 *
 * React error #310: "Rendered more hooks than during the previous render"
 *
 * Root cause: ToolFallbackInner in tool-fallback.tsx has an early return at line 34
 * for `toolName === 'mastra-memory-om-observation'` that returns BEFORE any hooks
 * are called. When React reuses the same fiber position (e.g., during streaming
 * when tool call lists change), a ToolFallbackInner instance that previously
 * rendered with a non-OM toolName (calling hooks: useActivatedSkills, useEffect,
 * useWorkflowStream) gets re-rendered with the OM toolName (0 hooks), or vice
 * versa, causing React to detect a hook count mismatch and throw error #310.
 */
describe('ToolFallbackInner - Rules of Hooks (issue #12726)', () => {
  const sourceFile = resolve(__dirname, '../tool-fallback.tsx');
  const source = readFileSync(sourceFile, 'utf-8');
  const lines = source.split('\n');

  it('should not have hook calls after the early return for observation markers', () => {
    // Find the ToolFallbackInner component
    const componentStartIdx = lines.findIndex(line =>
      line.includes('const ToolFallbackInner'),
    );
    expect(componentStartIdx, 'Could not find ToolFallbackInner component').toBeGreaterThan(-1);

    // Find the early return for 'mastra-memory-om-observation'
    let earlyReturnLine = -1;
    for (let i = componentStartIdx; i < lines.length; i++) {
      if (lines[i].includes('mastra-memory-om-observation')) {
        // Find the return statement in this block
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

    // Find the end of the ToolFallbackInner component (closing `};`)
    // We look for a `};` at the same indentation level as the const declaration
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
      // Skip comments and string literals
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      if (hookPattern.test(trimmed)) {
        hooksAfterReturn.push({ line: i + 1, text: trimmed });
      }
    }

    // This should FAIL: hooks are called after an early return, violating Rules of Hooks
    expect(
      hooksAfterReturn,
      `Found ${hooksAfterReturn.length} hook call(s) after early return at line ${earlyReturnLine}.\n` +
        `This violates React's Rules of Hooks and causes error #310 (issue #12726).\n` +
        `When toolName changes between 'mastra-memory-om-observation' and other values,\n` +
        `the early return skips these hooks, causing a hook count mismatch.\n\n` +
        `Fix: Move all hooks to the top of ToolFallbackInner, before the early return.\n\n` +
        hooksAfterReturn.map(h => `  Line ${h.line}: ${h.text}`).join('\n'),
    ).toHaveLength(0);
  });

  it('should call hooks unconditionally at the top of ToolFallbackInner', () => {
    // Find ToolFallbackInner
    const componentStartIdx = lines.findIndex(line =>
      line.includes('const ToolFallbackInner'),
    );

    // Find the arrow function body start `=> {`
    let bodyStartIdx = -1;
    for (let i = componentStartIdx; i < lines.length; i++) {
      if (lines[i].includes('=> {')) {
        bodyStartIdx = i;
        break;
      }
    }
    expect(bodyStartIdx, 'Could not find ToolFallbackInner body').toBeGreaterThan(-1);

    // The first non-comment, non-blank line after the function body opening should
    // NOT be a conditional statement (if/switch). It should be hook calls.
    let firstStatementIdx = -1;
    for (let i = bodyStartIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      firstStatementIdx = i;
      break;
    }
    expect(firstStatementIdx).toBeGreaterThan(-1);

    const firstStatement = lines[firstStatementIdx].trim();
    // The first statement should NOT be a conditional (if/switch)
    // It should be a hook call or variable declaration that uses a hook
    expect(
      firstStatement.startsWith('if ') || firstStatement.startsWith('if(') || firstStatement.startsWith('switch'),
      `First statement in ToolFallbackInner is a conditional: "${firstStatement}"\n` +
        `This means hooks below it may be skipped, violating React's Rules of Hooks.\n` +
        `Hooks must be called unconditionally at the top of the component.`,
    ).toBe(false);
  });
});
