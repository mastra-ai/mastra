import { createScorer } from '@mastra/core/scores';

const wordInclusionScorer = createScorer({
  name: 'Word Inclusion',
  description: 'Check if the output contains any of the words in the input',
  analyze: async ({ input, output }) => {
    const tokenize = (text: string) => text.toLowerCase().match(/\b\w+\b/g) || [];

    const inputText = input[0].query.toLowerCase();

    const referenceWords = [...new Set(tokenize(inputText))];
    const outputText = output.text.toLowerCase();

    const matchedWords = referenceWords.filter(word => outputText.includes(word));

    const totalWords = referenceWords.length;
    const score = totalWords > 0 ? matchedWords.length / totalWords : 0;

    return {
      score,
      result: {
        totalWords,
        matchedWords: matchedWords.length,
      },
    };
  },
});

// Example 1: Perfect word inclusion
const query1 = 'apple, banana, orange';
const response1 = 'My favorite fruits are: apple, banana, and orange.';

console.log('Example 1 - Perfect Word Inclusion:');
console.log('Input:', query1);
console.log('Output:', response1);

const result1 = await wordInclusionScorer.run({
  input: [{ query: query1 }],
  output: { text: response1 },
});

console.log('Scorer Result:', {
  score: result1.score,
  analyzeStepResult: result1.analyzeStepResult,
});

// Example 2: Partial word inclusion
const query2 = 'programming, python, javascript, java';
const response2 = 'I love programming with python for data science projects.';

console.log('\nExample 2 - Partial Word Inclusion:');
console.log('Input:', query2);
console.log('Output:', response2);

const result2 = await wordInclusionScorer.run({
  input: [{ query: query2 }],
  output: { text: response2 },
});

console.log('Scorer Result:', {
  score: result2.score,
  analyzeStepResult: result2.analyzeStepResult,
});

// Example 3: No word inclusion
const query3 = 'soccer, basketball, tennis';
const response3 = 'I enjoy reading books and watching movies in my free time.';

console.log('\nExample 3 - No Word Inclusion:');
console.log('Input:', query3);
console.log('Output:', response3);

const result3 = await wordInclusionScorer.run({
  input: [{ query: query3 }],
  output: { text: response3 },
});

console.log('Scorer Result:', {
  score: result3.score,
  result: result3.analyzeStepResult,
});
