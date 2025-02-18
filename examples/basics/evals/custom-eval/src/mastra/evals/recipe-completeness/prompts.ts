export const RECIPE_COMPLETENESS_INSTRUCTIONS = `You are a Master Chef that evaluates recipes for completeness. Your role is to ensure recipes include all essential information needed for successful cooking.`;

export const generateCompletenessPrompt = ({
  input,
  output,
}: {
  input: string;
  output: string;
}) => `Analyze if this recipe includes all essential components for successful cooking.

Essential components to check:
1. Ingredient Quantities
   - All ingredients must have specific measurements
   - Example of incomplete: "add tomatoes"
   - Example of complete: "add 2 diced tomatoes"

2. Cooking Times
   - Each cooking step needs a specific duration
   - Example of incomplete: "cook until done"
   - Example of complete: "cook for 15-20 minutes"

3. Cooking Temperatures
   - All heating steps need specific temperatures
   - Example of incomplete: "bake in oven"
   - Example of complete: "bake at 350°F (175°C)"

Examples:

Incomplete Recipe:
"Mix flour and water. Add salt and yeast. Bake until golden."
Response: {
  "missing": [
    "flour quantity",
    "water quantity",
    "salt quantity",
    "yeast quantity",
    "baking temperature",
    "baking time"
  ],
  "verdict": "Incomplete"
}

Complete Recipe:
"Mix 2 cups flour and 1 cup warm water. Add 1 tsp salt and 2 tsp yeast. Bake at 350°F for 30 minutes until golden brown."
Response: {
  "missing": [],
  "verdict": "Complete"
}

User input: ${input}
Analyze this recipe:
${output}

Return your response in this format:
{
  "missing": ["list each missing element"],
  "verdict": "Complete or Incomplete"
}`;

export const generateReasonPrompt = ({
  input,
  output,
  missing,
  verdict,
}: {
  input: string;
  output: string;
  missing: string[];
  verdict: string;
}) => `Explain why this recipe is ${verdict} based on its completeness.

${missing.length > 0 ? `The recipe is missing: ${missing.join(', ')}` : 'The recipe includes all essential components'}

Example responses:
1. For incomplete recipe:
{
    "reason": "The recipe is incomplete because it lacks several essential components: flour quantity, baking temperature, and cooking time. These missing elements would make it difficult for someone to successfully recreate the dish."
}

2. For complete recipe:
{
    "reason": "The recipe is complete as it provides all necessary measurements, cooking times, and temperatures needed to successfully prepare the dish."
}

User input: ${input}

Recipe to analyze: ${output}

Return your response in this format:
{
    "reason": "The recipe is ${verdict} because [reason]"
}`;
