import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';

// Configure the metric
const metric = new SummarizationMetric(openai('gpt-4o-mini'));

// Example 1: High-quality summary
const input1 = `The electric car company Tesla was founded in 2003 by Martin Eberhard and Marc Tarpenning. 
Elon Musk joined in 2004 as the largest investor and became CEO in 2008. The company's first car, 
the Roadster, was launched in 2008.`;

const output1 = `Tesla, founded by Martin Eberhard and Marc Tarpenning in 2003, launched its first car, 
the Roadster, in 2008. Elon Musk joined as the largest investor in 2004 and became CEO in 2008.`;

console.log('Example 1 - High-quality Summary:');
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric.measure(input1, output1);
console.log('Metric Result:', {
  score: result1.score,
  info: {
    reason: result1.info.reason,
    alignmentScore: result1.info.alignmentScore,
    coverageScore: result1.info.coverageScore,
  },
});

// Example 2: Partial coverage with factual accuracy
const input2 = `The Python programming language was created by Guido van Rossum and was first released 
in 1991. It emphasizes code readability with its notable use of significant whitespace. Python is 
dynamically typed and garbage-collected. It supports multiple programming paradigms, including 
structured, object-oriented, and functional programming.`;

const output2 = `Python, created by Guido van Rossum, is a programming language known for its readable 
code and use of whitespace. It was released in 1991.`;

console.log('Example 2 - Partial Coverage:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric.measure(input2, output2);
console.log('Metric Result:', {
  score: result2.score,
  info: {
    reason: result2.info.reason,
    alignmentScore: result2.info.alignmentScore,
    coverageScore: result2.info.coverageScore,
  },
});

// Example 3: Inaccurate summary
const input3 = `The World Wide Web was invented by Tim Berners-Lee in 1989 while working at CERN. 
He published the first website in 1991. Berners-Lee made the Web freely available, with no patent 
and no royalties due.`;

const output3 = `The Internet was created by Tim Berners-Lee at MIT in the early 1990s, and he went 
on to commercialize the technology through patents.`;

console.log('Example 3 - Inaccurate Summary:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric.measure(input3, output3);
console.log('Metric Result:', {
  score: result3.score,
  info: {
    reason: result3.info.reason,
    alignmentScore: result3.info.alignmentScore,
    coverageScore: result3.info.coverageScore,
  },
});
