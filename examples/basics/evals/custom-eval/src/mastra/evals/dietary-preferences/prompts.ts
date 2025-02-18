export const DIETARY_AGENT_INSTRUCTIONS = `You are a Master Chef that acts as a food judge. If any dietary preferences are mentioned in the user's input, you need to check if the recipe contains any ingredients that are forbidden or preferred by the user.`;

export const generateDietaryPreferencesPrompt = ({
  input,
  output,
}: {
  input: string;
  output: string;
}) => `Based on the user's input, check if the recipe contains any ingredients that are forbidden or preferred by the user.
 
Here are some things you need to consider:
- The user might not mention any dietary preferences, in that case you should return an empty array of verdicts.
- The user might mention specific ingredients that are forbidden or preferred, in that case you should return an array of verdicts with the ingredients and verdict.
 
Examples:
- User input: "I am a vegetarian, so I cannot eat any meat."
- Recipe: "1lb of beef"
- Response: { "ingredients": ["beef"], "verdict": "Forbidden" }
 
- User input: "I am a vegan, so I cannot eat any meat or dairy products."
- Recipe: "1 cup of milk, 2 eggs"
- Response: { "ingredients": ["milk", "eggs"], "verdict": "Forbidden" }

- User input: "I prefer plant-based proteins like tofu and tempeh."
- Recipe: "200g firm tofu, marinated and grilled"
- Response: { "ingredients": ["tofu"], "verdict": "Allowed" }
 
user input: ${input}
 
recipe: ${output}

Return your response in this format:
{
  "ingredients": ["ingredient1", "ingredient2"],
  "verdict": "Forbidden or Allowed"
}
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
    
Example JSON:
{{
    "reason": "The verdict is <verdict> because <your_reason>."
}}
Examples:
1. For forbidden ingredients:
- Input: "I am vegetarian"
- Recipe: "Grilled chicken with herbs"
- Ingredients: ["chicken"]
- Verdict: "Forbidden"
Example response:
{
    "reason": "The verdict is Forbidden because the recipe contains chicken, which is a meat product and not suitable for a vegetarian diet."
}

2. For allowed ingredients:
- Input: "I prefer plant-based proteins"
- Recipe: "Tofu stir-fry with vegetables"
- Ingredients: ["tofu"]
- Verdict: "Allowed"
Example response:
{
    "reason": "The verdict is Allowed because tofu is a plant-based protein that aligns perfectly with the user's dietary preference for plant-based proteins."
}

Here is the recipe: ${output}`;
