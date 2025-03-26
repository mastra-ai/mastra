import { Metric, type MetricResult } from '@mastra/core/eval';

interface WordInclusionResult extends MetricResult {
  score: number;
  info: {
    totalWords: number;
    matchedWords: number;
  };
}

export class WordInclusionMetric extends Metric {
  private referenceWords: Set<string>;

  constructor(words: string[]) {
    super();
    this.referenceWords = new Set(words);
  }

  async measure(input: string, output: string): Promise<WordInclusionResult> {
    // Handle empty strings case
    if (!input && !output) {
      return {
        score: 1,
        info: {
          totalWords: 0,
          matchedWords: 0,
        },
      };
    }

    const matchedWords = [...this.referenceWords].filter(k => output.includes(k));
    const totalWords = this.referenceWords.size;
    const coverage = totalWords > 0 ? matchedWords.length / totalWords : 0;

    return {
      score: coverage,
      info: {
        totalWords: this.referenceWords.size,
        matchedWords: matchedWords.length,
      },
    };
  }
}

// Example 1: Full word inclusion
const words1 = ['apple', 'banana', 'orange'];
const metric1 = new WordInclusionMetric(words1);

const input1 = 'List some fruits';
const output1 = 'Here are some fruits: apple, banana, and orange.';

console.log('Example 1 - Full Word Inclusion:');
console.log('Words to check:', words1);
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric1.measure(input1, output1);
console.log('Metric Result:', {
  score: result1.score,
  info: result1.info,
});

// Example 2: Partial word inclusion
const words2 = ['python', 'javascript', 'typescript', 'rust'];
const metric2 = new WordInclusionMetric(words2);

const input2 = 'What programming languages do you know?';
const output2 = 'I know python and javascript very well.';

console.log('\nExample 2 - Partial Word Inclusion:');
console.log('Words to check:', words2);
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric2.measure(input2, output2);
console.log('Metric Result:', {
  score: result2.score,
  info: result2.info,
});

// Example 3: No word inclusion
const words3 = ['cloud', 'server', 'database'];
const metric3 = new WordInclusionMetric(words3);

const input3 = 'Tell me about your infrastructure';
const output3 = 'We use modern technology for our systems.';

console.log('\nExample 3 - No Word Inclusion:');
console.log('Words to check:', words3);
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric3.measure(input3, output3);
console.log('Metric Result:', {
  score: result3.score,
  info: result3.info,
});
