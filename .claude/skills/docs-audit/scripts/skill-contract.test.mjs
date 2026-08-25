import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skillPath = new URL('../SKILL.md', import.meta.url);
const rubricPath = new URL('../references/RUBRIC.md', import.meta.url);
const reportPath = new URL('../references/AUDIT-REPORT.md', import.meta.url);

const [skill, rubric, report] = await Promise.all([
  readFile(skillPath, 'utf8'),
  readFile(rubricPath, 'utf8'),
  readFile(reportPath, 'utf8'),
]);

const activeContract = `${skill}\n${rubric}\n${report}`;

function assertIncludesAll(text, values) {
  for (const value of values) assert.match(text, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

test('selects the complete PR or user scope autonomously', () => {
  assertIncludesAll(skill, [
    'include every changed authored page',
    'Do not ask the user to choose pages or jobs',
    'Do not silently sample or cap',
    'report limitation instead of starting a question loop',
  ]);
});

test('covers all five supported page variants', () => {
  assertIncludesAll(activeContract, [
    'docs overview',
    'docs page',
    'integration',
    'deployment integration',
    'reference',
  ]);
});

test('maps always-on and conditional canonical mastra-docs references', () => {
  assertIncludesAll(skill, [
    'Activate the `mastra-docs` skill',
    'STYLEGUIDE.md',
    'INFORMATION_ARCHITECTURE.md',
    'AUTHORING_WORKFLOW.md',
    'DOC.md',
    'GUIDE_INTEGRATION.md',
    'REFERENCE.md',
    'COMPONENTS.md',
    'DIAGRAM.md',
    'Apply the verification rules in `AUTHORING_WORKFLOW.md` to every audit',
    'move, delete, and redirect sections only when those operations are part',
  ]);
});

test('bounds operations without skipping required evidence', () => {
  assertIncludesAll(skill, [
    'Do not rerun equivalent diff commands per file',
    'Load each canonical reference once',
    'Do not create a task list for an audit-only review',
    'For references, still perform the complete declared-surface comparison',
    'Browse external documentation only when a changed claim depends on vendor behavior',
    'After the checker finishes, synthesize the report immediately',
  ]);
});

test('requires contextual verification for every code-block role', () => {
  assertIncludesAll(skill, [
    'standalone',
    'incremental',
    'illustrative',
    'configuration-only',
    'shell',
    'output',
    'Do not require every block to compile independently',
    'Report a contextual block outcome for every changed page',
  ]);
  assertIncludesAll(rubric, [
    'A partial snippet is not automatically invalid',
    'explain why its context is sufficient',
  ]);
});

test('accepts an intentionally partial configuration snippet when the page supplies context', () => {
  const fixture = {
    role: 'configuration-only',
    snippet: "url: 'file:/absolute/path/to/project/mastra.db'",
    adjacentProse: 'Update the storage URL in the generated Mastra configuration.',
  };
  const isContextuallySufficient =
    fixture.role === 'configuration-only' && fixture.adjacentProse.includes('generated Mastra configuration');
  assert.equal(isContextuallySufficient, true);
  assert.match(
    activeContract,
    /Adjacent prose.*may.*provide omitted context|Adjacent prose.*may.*supply intentional omissions/is,
  );
});

test('keeps reference completeness strict and guide completeness proportional', () => {
  assertIncludesAll(skill, [
    'compare the declared public surface with exported APIs',
    'every claimed parameter, property, overload, default, optional field, constraint, error, return value, and example',
    'Guides and overviews still require source verification',
    'not forced into reference-page completeness',
  ]);
});

test('defines an autonomous report schema with unique evidence-backed findings', () => {
  assertIncludesAll(report, [
    'Audit scope',
    'Page classification and canonical-guidance compliance',
    'Source verification',
    'Contextual code-block outcomes',
    'Reference completeness',
    'Deterministic checks',
    'Overall verdict',
    'Changed doc:',
    'Source:',
    'Canonical guide:',
    'Stop after the report',
  ]);
});

test('prohibits the mandatory interactive repair and eval lifecycle', () => {
  const forbidden = [
    /These jobs were derived from the doc and selected by the user/i,
    /After the report, write .*fix-plan/i,
    /After approved fixes, mandatory eval/i,
    /## Agent-build eval results/i,
    /Temporary artifact directory:/i,
    /fix-plan\.md/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(activeContract, pattern);
});

test('stops audit-only work without edits or post-fix execution', () => {
  assertIncludesAll(skill, [
    'Do not edit documentation',
    'Do not ask follow-up questions, edit files, submit a plan, or run post-fix checks',
    'Stop after the report',
  ]);
});
