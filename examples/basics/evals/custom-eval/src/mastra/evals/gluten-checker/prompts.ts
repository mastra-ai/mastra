export const GLUTEN_INSTRUCTIONS = `You are a Chef that identifies if recipes contain gluten.`;

export const generateGlutenPrompt = ({ output }: { output: string }) => `Check if this recipe is gluten-free.

Check for:
- Wheat
- Barley
- Rye
- Common sources like flour, pasta, bread

Example with gluten:
"Mix flour and water to make dough"
Response: {
  "isGlutenFree": false,
  "glutenSources": ["flour"]
}

Example gluten-free:
"Mix rice, beans, and vegetables"
Response: {
  "isGlutenFree": true,
  "glutenSources": []
}

Recipe to analyze:
${output}

Return your response in this format:
{
  "isGlutenFree": boolean,
  "glutenSources": ["list ingredients containing gluten"]
}`;

export const generateReasonPrompt = ({
  isGlutenFree,
  glutenSources,
}: {
  isGlutenFree: boolean;
  glutenSources: string[];
}) => `Explain why this recipe is${isGlutenFree ? '' : ' not'} gluten-free.

${glutenSources.length > 0 ? `Sources of gluten: ${glutenSources.join(', ')}` : 'No gluten-containing ingredients found'}

Return your response in this format:
{
  "reason": "This recipe is [gluten-free/contains gluten] because [explanation]"
}`;
