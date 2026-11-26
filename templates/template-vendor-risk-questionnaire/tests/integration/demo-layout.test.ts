import { afterEach, beforeEach, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareDemo } from '../../scripts/generate-demo.ts';
import { IntakeCoordinator, officeAdapter } from '../../src/mastra/intake/adapters.ts';
import { buildWritePlan } from '../../src/mastra/completion/plan.ts';
import { validateDocument, writeDocument } from '../../src/mastra/completion/document.ts';
import { projectionSchema } from '../../src/mastra/contracts/review.ts';
import { demoQuestionnaireRows, demoQuestions } from '../fixtures/corpus.ts';
import { xlsxFixture, docxFixture } from '../fixtures/office.ts';
import { source, context, operator, temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { documentFixture } from '../support/completion.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});

it.each(['xlsx', 'docx'] as const)(
  'imports and completes the generated %s demo without prescribed types or domains',
  async format => {
    expect(await prepareDemo(root)).toBe('created');
    const path = resolve(root, 'demo', `questionnaire.${format}`);
    const bytes = await readFile(path);
    const snapshot = source(bytes, `questionnaire.${format}`);
    const coordinator = new IntakeCoordinator();
    const inspection = await coordinator.inspect(snapshot, context());
    expect(inspection.status).toBe('ready');
    const mapping = inspection.mappingCandidates[0]!;
    expect(mapping.regions[0]!.fields).toEqual({
      id: 0,
      question: 1,
      instructions: 2,
      response: 3,
      explanation: 4,
      evidence: 5,
    });
    const { input } = await coordinator.import(snapshot, mapping, operator, context());
    expect(input.questions.map(q => q.originalText)).toEqual(demoQuestions.map(([, question]) => question));
    for (const q of input.questions) {
      expect(q.answerType).toBe('free_text');
      expect(q.answerConstraints).toEqual({});
      expect(q.section).toBeUndefined();
      expect(q.untrustedExistingResponse).toBeUndefined();
    }
    const plan = await buildWritePlan(bytes, input, mapping);
    const fixture = await documentFixture(format);
    const projection = projectionSchema.parse({
      ...fixture.projection,
      quality: 'delivered_with_gaps',
      total: input.questions.length,
      supported: 1,
      answers: input.questions.map(q => ({
        ...(q.id === 'VRQ-005'
          ? fixture.projection.answers[0]
          : {
              disposition: 'unknown',
              value: 'unknown',
              text: '',
              responseOption: null,
              limitations: [],
              safeReason: 'No releasable supported answer is available.',
              citationIds: [],
            }),
        questionId: q.id,
        order: q.order,
        question: q.originalText,
      })),
    });
    const output = writeDocument(bytes, plan, projection);
    validateDocument(bytes, output, plan, projection);
    const completed = source(output, snapshot.originalName);
    const completedInspection = await coordinator.inspect(completed, context());
    const imported = await coordinator.import(
      completed,
      completedInspection.mappingCandidates[0]!,
      operator,
      context(),
    );
    expect(imported.input.questions.map(q => q.originalText)).toEqual(input.questions.map(q => q.originalText));
    const answer = imported.input.questions[4]!.responseTargets!.find(t => t.role === 'response')!;
    expect(await officeAdapter(format).resolve(completed, answer.locator, context())).toBe(
      fixture.projection.answers[0]!.text,
    );
    expect(await prepareDemo(root)).toBe('preserved');
    expect(await readFile(path)).toEqual(bytes);
  },
);

it.each(['xlsx', 'docx'] as const)(
  'recognizes reordered optional %s headers and requests mapping for ambiguous ones',
  async format => {
    const coordinator = new IntakeCoordinator();
    const encode = (rows: string[][]) =>
      source(
        format === 'xlsx' ? xlsxFixture([{ name: 'Vendor inquiry', rows }]) : docxFixture([{ table: rows }]),
        `questionnaire.${format}`,
      );
    const rows = demoQuestionnaireRows().map(row => [row[3]!, row[1]!, row[0]!]);
    const snapshot = encode(rows);
    const inspection = await coordinator.inspect(snapshot, context());
    expect(inspection.status).toBe('ready');
    expect(inspection.mappingCandidates[0]!.regions[0]!.fields).toEqual({ response: 0, question: 1, id: 2 });
    const imported = await coordinator.import(snapshot, inspection.mappingCandidates[0]!, operator, context());
    expect((await buildWritePlan(snapshot.bytes, imported.input, imported.mapping)).questions).toHaveLength(24);
    for (const headers of [
      ['Buyer response', 'Inquiry', 'Inquiry'],
      ['Buyer response', 'Custom prompt', 'Reference'],
      ['Buyer response', 'Inquiry', 'Unrecognized metadata'],
    ]) {
      const ambiguous = await coordinator.inspect(encode([headers, ...rows.slice(1)]), context());
      expect(ambiguous.status).toBe('needs_mapping');
      expect(ambiguous.mappingCandidates).toEqual([]);
    }
  },
);
