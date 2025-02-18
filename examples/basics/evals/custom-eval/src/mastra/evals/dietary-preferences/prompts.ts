export const DIETARY_AGENT_INSTRUCTIONS = `You are a Master Chef that acts as a food judge. If any dietary preferences are mentioned in the user's input, you need to check if the recipe contains any ingredients that are forbidden or preferred by the user.`;

export const generateDietaryPreferencesPrompt = ({
  input,
  output,
}: {
  input: string;
  output: string;
}) => `Based on the user's input, check if the recipe contains any ingredients that are forbidden or preferred by the user.
 
Here are some things you need to consider:
- The user might not mention any dietary preferences, in that case you should return an empty array.
- The user might mention specific ingredients that are forbidden or preferred, in that case you should return an array with the ingredient and the verdict.
 
Examples:
- User input: "I am a vegetarian, so I cannot eat any meat."
- Recipe: "1lb of beef"
- Verdict: "Forbidden"
 
- User input: "I am a vegan, so I cannot eat any meat or dairy products."
- Recipe: "1 cup of milk"
- Verdict: "Forbidden"
 
user input: ${input}
 
recipe: ${output}
`;

export const generateReasonPrompt = ({
  input,
  output,
  verdict,
  ingredients,
}: {
  input: string;
  output: string;
  verdict: string;
  ingredients: string[];
}) => `Explain why the recipe with the ingredients ${ingredients.join(', ')} is ${verdict} according to the user's input: ${input}
    
Here is the recipe: ${output}`;
