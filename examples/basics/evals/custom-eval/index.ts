import { Metric, type MetricResult } from '@mastra/core/eval';

// Example 1: Simple Keyword Metric
interface KeywordMatchResult extends MetricResult {
  info: {
    totalKeywords: number;
    matchedKeywords: number;
    matches: string[];
  };
}

class KeywordMatchMetric extends Metric {
  private keywords: Set<string>;

  constructor(keywords: string[]) {
    super();
    this.keywords = new Set(keywords.map(k => k.toLowerCase()));
  }

  async measure(input: string, output: string): Promise<KeywordMatchResult> {
    const outputLower = output.toLowerCase();
    const matches = [...this.keywords].filter(k => outputLower.includes(k));

    return {
      score: this.keywords.size > 0 ? matches.length / this.keywords.size : 1,
      info: {
        totalKeywords: this.keywords.size,
        matchedKeywords: matches.length,
        matches,
      },
    };
  }
}

// Example 1: Perfect match (all keywords present)
const keywords1 = ['healthy', 'nutritious', 'balanced'];
const metric1 = new KeywordMatchMetric(keywords1);

const input1 = 'I want a healthy meal suggestion';
const output1 = "Here's a nutritious and balanced meal plan with lots of vegetables.";

console.log('Example 1 - Perfect Match:');
console.log('Keywords:', keywords1);
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric1.measure(input1, output1);
console.log('Metric Result:', {
  score: result1.score,
  matches: result1.info.matches,
  total: result1.info.totalKeywords,
});

// Example 2: Mixed match (some keywords missing)
const keywords2 = ['protein', 'carbs', 'fats', 'vitamins'];
const metric2 = new KeywordMatchMetric(keywords2);

const input2 = 'What nutrients should I include in my diet?';
const output2 = 'Make sure to get enough protein and carbs in your meals.';

console.log('Example 2 - Mixed Match:');
console.log('Keywords:', keywords2);
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric2.measure(input2, output2);
console.log('Metric Result:', {
  score: result2.score,
  matches: result2.info.matches,
  total: result2.info.totalKeywords,
});

// Example 3: No match (no keywords present)
const keywords3 = ['exercise', 'workout', 'fitness'];
const metric3 = new KeywordMatchMetric(keywords3);

const input3 = 'What should I eat for breakfast?';
const output3 = 'A bowl of cereal with milk is a quick option.';

console.log('Example 3 - No Match:');
console.log('Keywords:', keywords3);
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric3.measure(input3, output3);
console.log('Metric Result:', {
  score: result3.score,
  matches: result3.info.matches,
  total: result3.info.totalKeywords,
});
