/**
 * Outcome Match Scorer (Offline, Experiment-only)
 *
 * Compares the actual experiment output against MastraCodeGroundTruth.
 * Checks hard assertions: build passes, tests pass, files modified,
 * tools used/not used, custom assertions, efficiency bounds.
 *
 * Unlike the live outcome scorer (which infers from messages), this has
 * access to the ground truth defined in the dataset and produces a
 * detailed breakdown of which assertions passed/failed.
 */

import { createScorer } from '@mastra/core/evals';
import type { MastraCodeExperimentOutput, ToolCallRecord } from '../../experiments/lifecycle';
import type { MastraCodeGroundTruth } from '../../experiments/types';
import { isBuildCommand, isTestCommand, isSuccessResult as isSuccessResultShared, matchFilePath } from '../classify-command';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━���━━━━━━━━��━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AssertionResult {
  name: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scorer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createOutcomeMatchScorer() {
  return createScorer({
    id: 'mastracode-outcome-match',
    name: 'Outcome Match',
    description: 'Compares experiment output against ground truth assertions.',
  })
    .preprocess(async ({ run }) => {
      const output = run.output as MastraCodeExperimentOutput | null;
      const groundTruth = run.groundTruth as MastraCodeGroundTruth | undefined;

      // If no ground truth, nothing to check
      if (!groundTruth) return { checks: [] as AssertionResult[], noGroundTruth: true };
      // If execution failed entirely, all checks fail
      if (!output) return { checks: [] as AssertionResult[], executionFailed: true };

      const checks: AssertionResult[] = [];

      // === Build passes ===
      if (groundTruth.buildPasses !== undefined) {
        const buildPassed = checkBuildPassed(output);
        checks.push({
          name: 'buildPasses',
          expected: groundTruth.buildPasses,
          actual: buildPassed,
          passed: buildPassed === groundTruth.buildPasses,
        });
      }

      // === Tests pass ===
      if (groundTruth.testsPasses !== undefined) {
        const testsPassed = checkTestsPassed(output);
        checks.push({
          name: 'testsPasses',
          expected: groundTruth.testsPasses,
          actual: testsPassed,
          passed: testsPassed === groundTruth.testsPasses,
        });
      }

      // === Files modified ===
      if (groundTruth.filesModified && groundTruth.filesModified.length > 0) {
        const modifiedFiles = extractModifiedFiles(output);
        for (const expected of groundTruth.filesModified) {
          const found = modifiedFiles.some(f => matchFilePath(f, expected));
          checks.push({ name: `filesModified:${expected}`, expected: true, actual: found, passed: found });
        }
      }

      // === Files created ===
      if (groundTruth.filesCreated && groundTruth.filesCreated.length > 0) {
        const createdFiles = extractCreatedFiles(output);
        for (const expected of groundTruth.filesCreated) {
          const found = createdFiles.some(f => matchFilePath(f, expected));
          checks.push({ name: `filesCreated:${expected}`, expected: true, actual: found, passed: found });
        }
      }

      // === Files deleted ===
      if (groundTruth.filesDeleted && groundTruth.filesDeleted.length > 0) {
        const deletedFiles = extractDeletedFiles(output);
        for (const expected of groundTruth.filesDeleted) {
          const found = deletedFiles.some(f => matchFilePath(f, expected));
          checks.push({ name: `filesDeleted:${expected}`, expected: true, actual: found, passed: found });
        }
      }

      // === Tools used ===
      if (groundTruth.toolsUsed && groundTruth.toolsUsed.length > 0) {
        const usedTools = new Set(output.toolCalls.map(tc => tc.toolName));
        for (const expected of groundTruth.toolsUsed) {
          checks.push({ name: `toolsUsed:${expected}`, expected: true, actual: usedTools.has(expected), passed: usedTools.has(expected) });
        }
      }

      // === Tools NOT used ===
      if (groundTruth.toolsNotUsed && groundTruth.toolsNotUsed.length > 0) {
        const usedTools = new Set(output.toolCalls.map(tc => tc.toolName));
        for (const forbidden of groundTruth.toolsNotUsed) {
          checks.push({ name: `toolsNotUsed:${forbidden}`, expected: false, actual: usedTools.has(forbidden), passed: !usedTools.has(forbidden) });
        }
      }

      // === Max turns ===
      if (groundTruth.maxTurns !== undefined) {
        const turns = countAssistantTurns(output);
        checks.push({ name: 'maxTurns', expected: `<= ${groundTruth.maxTurns}`, actual: turns, passed: turns <= groundTruth.maxTurns });
      }

      // === Max tool calls ===
      if (groundTruth.maxToolCalls !== undefined) {
        const count = output.toolCalls.length;
        checks.push({ name: 'maxToolCalls', expected: `<= ${groundTruth.maxToolCalls}`, actual: count, passed: count <= groundTruth.maxToolCalls });
      }

      // === Max duration ===
      if (groundTruth.maxDurationMs !== undefined) {
        const duration = output.completedAt - output.startedAt;
        checks.push({ name: 'maxDurationMs', expected: `<= ${groundTruth.maxDurationMs}`, actual: duration, passed: duration <= groundTruth.maxDurationMs });
      }

      // === Custom assertions ===
      // Note: file-contains, file-exists, file-not-exists, and command-succeeds
      // require workspace access which isn't available to the scorer. We infer
      // what we can from tool call history.
      if (groundTruth.customAssertions && groundTruth.customAssertions.length > 0) {
        const writtenFiles = extractCreatedFiles(output);
        const modifiedFiles = extractModifiedFiles(output);
        const deletedFiles = extractDeletedFiles(output);
        const allTouchedFiles = new Set([...writtenFiles, ...modifiedFiles]);

        for (const assertion of groundTruth.customAssertions) {
          switch (assertion.check) {
            case 'file-exists': {
              const found = allTouchedFiles.has(assertion.path) || writtenFiles.includes(assertion.path);
              checks.push({ name: `custom:file-exists:${assertion.path}`, expected: true, actual: found, passed: found });
              break;
            }
            case 'file-not-exists': {
              // Pass if file was never touched, or was deleted
              const neverTouched = !allTouchedFiles.has(assertion.path);
              const deleted = deletedFiles.includes(assertion.path);
              const passed = neverTouched || deleted;
              checks.push({ name: `custom:file-not-exists:${assertion.path}`, expected: true, actual: passed, passed });
              break;
            }
            case 'file-contains': {
              // Check last write_file or string_replace_lsp call for this path
              const relevantCalls = output.toolCalls.filter(
                tc =>
                  (tc.toolName === 'write_file' || tc.toolName === 'string_replace_lsp') &&
                  matchFilePath(String((tc.args as Record<string, unknown>)?.path ?? ''), assertion.path),
              );
              const lastCall = relevantCalls.length > 0 ? relevantCalls[relevantCalls.length - 1] : undefined;
              const args = lastCall ? (lastCall.args as Record<string, unknown>) : undefined;
              // For write_file check content; for string_replace_lsp check new_string
              const content = args
                ? String(args.content ?? args.new_string ?? '')
                : '';
              const found = content.includes(assertion.content);
              checks.push({
                name: `custom:file-contains:${assertion.path}`,
                expected: assertion.content.slice(0, 50),
                actual: found ? 'found' : `not found (checked ${relevantCalls.length} write/edit calls)`,
                passed: found,
              });
              break;
            }
            case 'command-succeeds': {
              // Check if command was executed successfully
              const cmdCall = output.toolCalls.find(
                tc => tc.toolName === 'execute_command' && String((tc.args as Record<string, unknown>)?.command ?? '').includes(assertion.command),
              );
              const passed = cmdCall ? isSuccessResult(cmdCall) : false;
              checks.push({
                name: `custom:command-succeeds:${assertion.command.slice(0, 40)}`,
                expected: true,
                actual: cmdCall ? passed : 'command not found',
                passed,
              });
              break;
            }
          }
        }
      }

      return { checks, noGroundTruth: false, executionFailed: false };
    })
    .generateScore(({ results }) => {
      const { checks, noGroundTruth, executionFailed } = results.preprocessStepResult;
      if (noGroundTruth) return 1; // Nothing to fail on
      if (executionFailed) return 0;
      if (checks.length === 0) return 1;
      return checks.filter((c: AssertionResult) => c.passed).length / checks.length;
    })
    .generateReason(({ results, score }) => {
      const { checks, noGroundTruth, executionFailed } = results.preprocessStepResult;
      if (noGroundTruth) return 'No ground truth defined — score not applicable.';
      if (executionFailed) return 'Execution failed — no output to evaluate.';
      if (checks.length === 0) return 'No assertions to check.';

      const passed = checks.filter((c: AssertionResult) => c.passed);
      const failed = checks.filter((c: AssertionResult) => !c.passed);
      const lines: string[] = [`Score: ${score} (${passed.length}/${checks.length} assertions passed)`];

      if (failed.length > 0) {
        lines.push('Failed:');
        for (const f of failed) {
          lines.push(`  - ${f.name}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`);
        }
      }

      return lines.join('\n');
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function checkBuildPassed(output: MastraCodeExperimentOutput): boolean {
  const buildCalls = output.toolCalls.filter((tc: ToolCallRecord) => {
    if (tc.toolName !== 'execute_command') return false;
    return isBuildCommand((tc.args as { command?: string })?.command ?? '');
  });
  if (buildCalls.length === 0) return false;
  return isSuccessResult(buildCalls[buildCalls.length - 1]!);
}

function checkTestsPassed(output: MastraCodeExperimentOutput): boolean {
  const testCalls = output.toolCalls.filter((tc: ToolCallRecord) => {
    if (tc.toolName !== 'execute_command') return false;
    return isTestCommand((tc.args as { command?: string })?.command ?? '');
  });
  if (testCalls.length === 0) return false;
  return isSuccessResult(testCalls[testCalls.length - 1]!);
}

function isSuccessResult(tc: ToolCallRecord): boolean {
  return isSuccessResultShared(tc.result, tc.error);
}

function extractModifiedFiles(output: MastraCodeExperimentOutput): string[] {
  const files = new Set<string>();
  for (const tc of output.toolCalls) {
    if (tc.toolName === 'string_replace_lsp' || tc.toolName === 'ast_smart_edit') {
      const path = (tc.args as { path?: string })?.path;
      if (path) files.add(path);
    }
  }
  return Array.from(files);
}

function extractCreatedFiles(output: MastraCodeExperimentOutput): string[] {
  const files = new Set<string>();
  for (const tc of output.toolCalls) {
    if (tc.toolName === 'write_file') {
      const path = (tc.args as { path?: string })?.path;
      if (path) files.add(path);
    }
  }
  return Array.from(files);
}

function extractDeletedFiles(output: MastraCodeExperimentOutput): string[] {
  const files = new Set<string>();
  for (const tc of output.toolCalls) {
    if (tc.toolName === 'delete_file') {
      const path = (tc.args as { path?: string })?.path;
      if (path) files.add(path);
    }
  }
  return Array.from(files);
}

function countAssistantTurns(output: MastraCodeExperimentOutput): number {
  return output.messages.filter(
    (m: unknown) => typeof m === 'object' && m !== null && (m as { role?: string }).role === 'assistant',
  ).length;
}
