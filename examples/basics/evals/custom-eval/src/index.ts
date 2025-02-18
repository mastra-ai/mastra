import { mastra } from './mastra';

const chefAgent = mastra.getAgent('chefAgent');

const metric = chefAgent.evals.dietaryPreferences;

// Example 1: Recipe matches dietary preferences
const input1 = 'I am a vegetarian, please suggest a healthy meal.';

console.log('Example 1 - Vegetarian Meal:');
console.log('Input:', input1);

const response1 = await chefAgent.generate(input1);
console.log('Agent Response:', response1.text);
const result1 = await metric.measure(input1, response1.text);
console.log('Metric Result:', {
  score: result1.score,
  ingredients: result1.info.ingredients,
  reason: result1.info.reason,
});

// Example 2: Recipe partially matches preferences
const input2 = 'I am lactose intolerant but I love protein-rich meals.';

console.log('\nExample 2 - Lactose Intolerant Meal:');
console.log('Input:', input2);

const response2 = await chefAgent.generate(input2);
console.log('Agent Response:', response2.text);
const result2 = await metric.measure(input2, response2.text);
console.log('Metric Result:', {
  score: result2.score,
  ingredients: result2.info.ingredients,
  reason: result2.info.reason,
});

// Example 3: Recipe conflicts with preferences
const input3 = 'I am vegan, what can I cook for dinner?';

console.log('\nExample 3 - Vegan Meal:');
console.log('Input:', input3);

const response3 = await chefAgent.generate(input3);
console.log('Agent Response:', response3.text);
const result3 = await metric.measure(input3, response3.text);
console.log('Metric Result:', {
  score: result3.score,
  ingredients: result3.info.ingredients,
  reason: result3.info.reason,
});
