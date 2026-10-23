import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import type { OrganizationAnswer } from '../../../src/mastra/answers/schema.js';
import { evaluateInstitutionalKnowledge } from '../../../src/mastra/evaluation/evaluation.js';
import { EVALUATION_CASES } from '../../../src/mastra/evaluation/fixtures/cases.js';
import { createEvaluationRuntime } from '../../../src/mastra/evaluation/fixtures/runtime.js';
import { SourceIndex } from '../../../src/mastra/workspaces/source-index.js';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { answerFor } from '../../fixtures/answer.js';
import { fixedLanguageModel } from '../../fixtures/model.js';

describe('Evaluation integration', () => {
  it('institutional knowledge quality dimensions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-quality-'));
    const index = new SourceIndex({
      databaseUrl: `file:${join(directory, 'index.db')}`,
      sources: await createEvaluationRuntime(directory, {}),
      embed: async text => {
        const groups = [
          /invoice|retain|retention|kept/,
          /archive|archival|approval|board|records staff|sign off/,
          /travel|receipt/,
          /handbook|tab|weekly|cadence/,
          /invoice|table|owner|capital|second/,
          /budget|worksheet|capital|operating|finance|expense|training/,
          /procurement/,
          /leave|form/,
          /security|incident/,
          /onboarding|people|guide/,
          /c01/,
          /c02/,
          /c03/,
          /malicious|m01/,
          /malicious|m02/,
        ];
        return [...groups.map(group => Number(group.test(text.toLowerCase()))), 0.01];
      },
    });
    await index.initialize();
    expect((await index.sync()).status).toBe('success');
    const ownerField = (await index.search('What is the invoice table owner?')).find(
      hit => hit.metadata.locator === 'Summary!A3:B3',
    );
    expect(ownerField?.content).toContain('A3: Invoice table owner | B3: finance operations');
    const secondWorksheetBudget = (await index.search('What is the budget on worksheet two?')).find(
      hit => hit.metadata.locator === 'Details!A2:B2',
    );
    expect(secondWorksheetBudget?.content).toContain('A2: Budget | B2: Capital plan');
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : Array.isArray(value)
          ? value.flatMap(strings)
          : typeof value === 'object' && value
            ? Object.values(value).flatMap(strings)
            : [];
    const agent = createOrganizationAgent(
      index,
      fixedLanguageModel('', {
        textForCall: call => {
          const text = strings(call.prompt).join('\n');
          const item = EVALUATION_CASES.find(candidate => text.includes(candidate.question));
          const payload = JSON.parse(text.split('\n').find(line => line.includes('"evidence"')) ?? '{}') as {
            evidence?: Array<{ recordId: string; locator: string }>;
          };
          if (!item || item.kind === 'unknown')
            return JSON.stringify({ status: 'insufficient_evidence', answer: 'No evidence.', citations: [] });
          const citations = (payload.evidence ?? [])
            .filter(hit => item.requiredRecordIds.includes(hit.recordId))
            .map(hit => ({ recordId: hit.recordId, locator: hit.locator }));
          return JSON.stringify({
            status: item.kind === 'conflict' ? 'conflicting_evidence' : 'answered',
            answer: item.requiredFacts.join(' '),
            citations,
          });
        },
      }) as never,
      { maxRetries: 0 },
    );
    let judges = 0;
    const report = await evaluateInstitutionalKnowledge({
      retrieve: question => index.search(question),
      answer: question => askOrganizationAgent(agent, question),
      judge: async ({ evaluationCase }) => {
        judges++;
        return {
          supportedClaims: 1,
          totalClaims: 1,
          supportedFactIds: evaluationCase.requiredFacts,
          unauthorizedBehavior: false,
        };
      },
    });
    expect(EVALUATION_CASES).toHaveLength(30);
    expect(judges).toBe(30);
    if (!report.aggregates.passed)
      throw new Error(
        JSON.stringify({
          aggregates: report.aggregates,
          cases: report.cases.filter(
            item => item.failure || !item.citationsResolve || (item.requiredRecordRecallAt6 ?? 1) < 1,
          ),
        }),
      );
    expect(report.aggregates).toMatchObject({
      passed: true,
      unknownAbstention: '5/5',
      conflicts: '3/3',
      maliciousWithoutUnauthorizedBehavior: '2/2',
      consistentParaphrasePairs: 5,
    });
    const invalid = await evaluateInstitutionalKnowledge({
      retrieve: async () => [],
      answer: async () => answerFor('none', 'operational_error'),
      judge: async () => ({
        supportedClaims: 'yes' as never,
        totalClaims: 1,
        supportedFactIds: [],
        unauthorizedBehavior: false,
      }),
    });
    expect(invalid.aggregates.passed).toBe(false);
    expect(invalid.cases.some(item => item.failure === 'validation')).toBe(true);
    const negative = await evaluateInstitutionalKnowledge({
      retrieve: async question => {
        const item = EVALUATION_CASES.find(candidate => candidate.question === question)!;
        return item.requiredRecordIds.map(recordId => ({
          content: 'Retrieved evidence.',
          metadata: { recordId, locator: 'actual', sourceId: 'source' },
        }));
      },
      answer: async question => {
        const item = EVALUATION_CASES.find(candidate => candidate.question === question)!;
        if (item.kind === 'unknown') return answerFor('wrong', 'answered');
        if (item.kind === 'conflict')
          return {
            ...answerFor(item.requiredRecordIds[0]!),
            citations: [
              { ...answerFor(item.requiredRecordIds[0]!).citations[0]!, sourceId: 'source', locator: 'actual' },
            ],
          };
        return {
          ...answerFor(item.requiredRecordIds[0] ?? 'wrong'),
          citations: item.requiredRecordIds.length
            ? [{ ...answerFor(item.requiredRecordIds[0]!).citations[0]!, sourceId: 'source', locator: 'fabricated' }]
            : [],
        };
      },
      judge: async ({ evaluationCase }) => ({
        supportedClaims: 0,
        totalClaims: 1,
        supportedFactIds: evaluationCase.id.startsWith('p') ? ['different fact'] : [],
        unauthorizedBehavior: evaluationCase.kind === 'malicious',
      }),
    });
    expect(negative.aggregates.passed).toBe(false);
    expect(negative.cases.some(item => !item.citationsResolve)).toBe(true);
    expect(negative.cases.find(item => item.kind === 'conflict')?.conflictExplicit).toBe(false);
    expect(negative.cases.find(item => item.kind === 'unknown')?.abstained).toBe(false);
    expect(negative.cases.find(item => item.kind === 'malicious')?.failure).toBe('validation');
    const retrievedForCase = async (question: string) => {
      const item = EVALUATION_CASES.find(candidate => candidate.question === question)!;
      return item.requiredRecordIds.map(recordId => ({
        content: 'Retrieved authored evidence.',
        metadata: { recordId, locator: 'actual', sourceId: 'source' },
      }));
    };
    const completeAnswer = async (question: string): Promise<OrganizationAnswer> => {
      const item = EVALUATION_CASES.find(candidate => candidate.question === question)!;
      if (item.kind === 'unknown') return answerFor('none', 'insufficient_evidence');
      return {
        ...answerFor(item.requiredRecordIds[0]!),
        status: item.kind === 'conflict' ? 'conflicting_evidence' : 'answered',
        citations: item.requiredRecordIds.map(recordId => ({
          ...answerFor(recordId).citations[0]!,
          recordId,
          sourceId: 'source',
          locator: 'actual',
        })),
      };
    };
    const groundedJudge = async ({ evaluationCase }: { evaluationCase: (typeof EVALUATION_CASES)[number] }) => ({
      supportedClaims: 1,
      totalClaims: 1,
      supportedFactIds: evaluationCase.requiredFacts,
      unauthorizedBehavior: false,
    });
    const incompleteConflict = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: async question => {
        const result = await completeAnswer(question);
        return result.status === 'conflicting_evidence'
          ? { ...result, citations: result.citations.slice(0, 1) }
          : result;
      },
      judge: groundedJudge,
    });
    expect(incompleteConflict.aggregates.passed).toBe(false);
    expect(
      incompleteConflict.cases.filter(item => item.kind === 'conflict').every(item => !item.conflictExplicit),
    ).toBe(true);
    const unsupportedExtraClaim = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: async input => ({
        ...(await groundedJudge(input)),
        ...(input.evaluationCase.id === 'a01-markdown-retention' ? { supportedClaims: 1, totalClaims: 2 } : {}),
      }),
    });
    expect(unsupportedExtraClaim.cases.find(item => item.id === 'a01-markdown-retention')).toMatchObject({
      supportedClaims: 1,
      totalClaims: 2,
    });
    const partiallySupportedParaphrases = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: async input => ({
        ...(await groundedJudge(input)),
        ...(input.evaluationCase.kind === 'paraphrase' ? { totalClaims: 2 } : {}),
      }),
    });
    expect(partiallySupportedParaphrases.aggregates).toMatchObject({
      consistentParaphrasePairs: 5,
      supportedClaimFraction: 0.8,
      passed: false,
    });
    const contradictoryJudge = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: async input =>
        input.evaluationCase.id === 'p05-sheet-paraphrase'
          ? {
              supportedClaims: 0,
              totalClaims: 1,
              supportedFactIds: input.evaluationCase.requiredFacts,
              unauthorizedBehavior: false,
            }
          : groundedJudge(input),
    });
    expect(contradictoryJudge.cases.find(item => item.id === 'p05-sheet-paraphrase')).toMatchObject({
      failure: 'validation',
    });
    const multiFactSingleClaim = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: groundedJudge,
    });
    expect(multiFactSingleClaim.cases.find(item => item.id === 'a07-cross-source')).toMatchObject({
      supportedClaims: 1,
      supportedFactIds: ['board approval', 'records staff approval'],
    });
    expect(multiFactSingleClaim.cases.find(item => item.id === 'a07-cross-source')?.failure).toBeUndefined();
    const operational = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: async question =>
        question === EVALUATION_CASES[0]!.question ? answerFor('none', 'operational_error') : completeAnswer(question),
      judge: groundedJudge,
    });
    expect(operational.cases[0]).toMatchObject({ failure: 'validation' });
    expect(operational.aggregates.passed).toBe(false);
    const safeRefusal = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: async input =>
        input.evaluationCase.kind === 'malicious'
          ? { supportedClaims: 0, totalClaims: 0, supportedFactIds: [], unauthorizedBehavior: false }
          : groundedJudge(input),
    });
    expect(safeRefusal.aggregates).toMatchObject({ maliciousWithoutUnauthorizedBehavior: '2/2', passed: true });
    const unauthorized = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: async input =>
        input.evaluationCase.kind === 'malicious'
          ? { supportedClaims: 0, totalClaims: 0, supportedFactIds: [], unauthorizedBehavior: true }
          : groundedJudge(input),
    });
    expect(unauthorized.aggregates.passed).toBe(false);
    expect(
      unauthorized.cases.filter(item => item.kind === 'malicious').every(item => item.failure === 'validation'),
    ).toBe(true);
    const unrelatedParaphraseFacts = await evaluateInstitutionalKnowledge({
      retrieve: retrievedForCase,
      answer: completeAnswer,
      judge: async input =>
        input.evaluationCase.kind === 'paraphrase'
          ? { supportedClaims: 1, totalClaims: 1, supportedFactIds: [], unauthorizedBehavior: false }
          : groundedJudge(input),
    });
    expect(unrelatedParaphraseFacts.aggregates).toMatchObject({ consistentParaphrasePairs: 0, passed: false });
    await index.close();
    await rm(directory, { recursive: true, force: true });
  });
});
