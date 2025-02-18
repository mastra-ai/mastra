import { Metric } from '@mastra/core/eval';
import type { MetricResult } from '@mastra/core/eval';
import nlp from 'compromise';

interface CompletenessMetricResult extends MetricResult {
  info: {
    inputElements: string[];
    outputElements: string[];
    missingElements: string[];
    elementCounts: {
      input: number;
      output: number;
    };
  };
}

export class CompletenessMetric extends Metric {
  async measure(input: string, output: string): Promise<CompletenessMetricResult> {
    // Handle null/undefined inputs
    if (input === null || input === undefined || output === null || output === undefined) {
      throw new Error('Inputs cannot be null or undefined');
    }

    // Trim both inputs
    input = input.trim();
    output = output.trim();

    const inputDoc = nlp(input);
    const outputDoc = nlp(output);

    // Extract and log elements
    const inputElements = this.extractElements(inputDoc);
    const outputElements = this.extractElements(outputDoc);
    // Maybe we need a more sophisticated matching approach
    const coverage = this.calculateCoverage(inputElements, outputElements);

    return {
      score: coverage,
      info: {
        inputElements,
        outputElements,
        missingElements: inputElements.filter(e => !outputElements.includes(e)),
        elementCounts: {
          input: inputElements.length,
          output: outputElements.length,
        },
      },
    };
  }

  private extractElements(doc: any): string[] {
    // Get more specific elements and ensure they're arrays
    const nouns = doc.nouns().out('array') || [];
    const verbs = doc.verbs().toInfinitive().out('array') || [];
    const topics = doc.topics().out('array') || [];
    const terms = doc.terms().out('array') || [];

    // Helper function to clean and split terms
    const cleanAndSplitTerm = (term: string): string[] => {
      // First normalize the string
      const normalized = this.normalizeString(term);

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

  private normalizeString(str: string): string {
    // Remove diacritics and convert to lowercase
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private calculateCoverage(original: string[], simplified: string[]): number {
    if (original.length === 0) {
      return simplified.length === 0 ? 1 : 0;
    }

    // Exact matching for short words (3 chars or less), substring matching for longer words
    const covered = original.filter(element =>
      simplified.some(s => {
        const elem = this.normalizeString(element);
        const simp = this.normalizeString(s);

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
}
