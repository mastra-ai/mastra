import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

// Example 1: High position adherence
const context1 = [
  'First, preheat the oven to 350°F.',
  'Next, mix the dry ingredients in a bowl.',
  'Then, add the wet ingredients and stir well.',
  'Finally, bake for 25 minutes until golden brown.',
];

const metric1 = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = 'How do I bake this recipe?';
const response1 =
  'To make this recipe, start by preheating your oven to 350°F. After that, combine all dry ingredients in a mixing bowl. Next, add your wet ingredients and mix thoroughly. The last step is to bake everything for 25 minutes until you get a nice golden brown color.';

console.log('\nExample 1 - High Position Adherence:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed position adherence
const context2 = [
  'Rome was founded in 753 BCE.',
  'The Roman Republic began in 509 BCE.',
  'Julius Caesar became dictator in 49 BCE.',
  'Augustus established the Empire in 27 BCE.',
];

const metric2 = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = 'Describe the history of Rome.';
const response2 =
  "The Roman Empire was established by Augustus in 27 BCE, following Julius Caesar's dictatorship in 49 BCE. This was all possible because of Rome's founding in 753 BCE and the subsequent Republic in 509 BCE.";

console.log('\nExample 2 - Mixed Position Adherence:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Low position adherence
const context3 = [
  'Step 1: Open the application.',
  'Step 2: Click on Settings.',
  'Step 3: Select Network options.',
  'Step 4: Enable Wi-Fi.',
];

const metric3 = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'How do I connect to Wi-Fi?';
const response3 =
  "To connect to Wi-Fi, enable it in Network options. Before that, you'll need to go to Settings after launching the application.";

console.log('\nExample 3 - Low Position Adherence:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});
