import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import nlp from 'compromise';

function normalizeString(str: string): string {
  // Remove diacritics and convert to lowercase
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractElements(doc: any): string[] {
  // Get more specific elements and ensure they're arrays
  const nouns = doc.nouns().out('array') || [];
  const verbs = doc.verbs().toInfinitive().out('array') || [];
  const topics = doc.topics().out('array') || [];
  const terms = doc.terms().out('array') || [];

  // Helper function to clean and split terms
  const cleanAndSplitTerm = (term: string): string[] => {
    // First normalize the string
    const normalized = normalizeString(term);

    // Split on word boundaries and filter out empty strings
    return normalized
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
      .replace(/[^a-z0-9]+/g, ' ') // Replace non-alphanumeric with spaces
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
  };

  // Process all elements
  const processedTerms = [
    ...nouns.flatMap(cleanAndSplitTerm),
    ...verbs.flatMap(cleanAndSplitTerm),
    ...topics.flatMap(cleanAndSplitTerm),
    ...terms.flatMap(cleanAndSplitTerm),
  ];

  // Remove duplicates
  return [...new Set(processedTerms)];
}

function calculateCoverage({ original, simplified }: { original: string[]; simplified: string[] }): number {
  if (original.length === 0) {
    return simplified.length === 0 ? 1 : 0;
  }

  // Exact matching for short words (3 chars or less), substring matching for longer words
  const covered = original.filter(element =>
    simplified.some(s => {
      const elem = normalizeString(element);
      const simp = normalizeString(s);

      // For short words (3 chars or less), require exact match
      if (elem.length <= 3) {
        return elem === simp;
      }

      // For longer words, require substantial overlap (more than 60% of the longer word)
      const longer = elem.length > simp.length ? elem : simp;
      const shorter = elem.length > simp.length ? simp : elem;

      if (longer.includes(shorter)) {
        return shorter.length / longer.length > 0.6;
      }

      return false;
    }),
  );
  return covered.length / original.length;
}

export function createCompletenessScorer() {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
  })
    .preprocess(async ({ run }) => {
      const isInputInvalid =
        !run.input ||
        run.input.inputMessages.some((i: { content: string }) => i.content === null || i.content === undefined);

      const isOutputInvalid =
        !run.output || run.output.some((i: { content: string }) => i.content === null || i.content === undefined);

      if (isInputInvalid || isOutputInvalid) {
        throw new Error('Inputs cannot be null or undefined');
      }

      const input = run.input?.inputMessages.map((i: { content: string }) => i.content).join(', ') || '';
      const output = run.output?.map(({ content }: { content: string }) => content).join(', ') || '';

      const inputToProcess = input;
      const outputToProcess = output;

      const inputDoc = nlp(inputToProcess.trim());
      const outputDoc = nlp(outputToProcess.trim());

      // Extract and log elements
      const inputElements = extractElements(inputDoc);
      const outputElements = extractElements(outputDoc);

      return {
        inputElements,
        outputElements,
        missingElements: inputElements.filter(e => !outputElements.includes(e)),
        elementCounts: {
          input: inputElements.length,
          output: outputElements.length,
        },
      };
    })
    .generateScore(({ results }) => {
      const inputElements = results.preprocessStepResult?.inputElements;
      const outputElements = results.preprocessStepResult?.outputElements;

      return calculateCoverage({
        original: inputElements,
        simplified: outputElements,
      });
    });
}
