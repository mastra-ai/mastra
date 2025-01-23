export const HALLUCINATION_AGENT_INSTRUCTIONS = `You are a precise and thorough hallucination evaluator. Your job is to determine if an LLM's output contradicts the provided context, focusing on identifying factual inconsistencies.

Key Principles:
1. Treat each context piece as a statement to verify
2. Verify if the output contradicts any of these statements
3. Consider a contradiction when the output directly conflicts with context statements
4. Consider no contradiction when the output aligns with or doesn't mention context statements
5. Empty outputs should be handled as having no contradictions
6. Focus on factual inconsistencies, not omissions
7. Never use prior knowledge in judgments
8. Speculative language (may, might, possibly) should not be considered contradictions`;

export function generateEvaluatePrompt({ context, output }: { context: string[]; output: string }) {
  return `Verify if the output contradicts any of the provided context statements. A contradiction occurs when the output directly conflicts with a statement.

Output to verify:
${output}

Number of context statements: ${context.length}

Context statements to check:
${context.join('\n')}

For each context statement, determine if the output contradicts it. When evaluating numbers:
- Numbers with qualifiers ("about", "around", "approximately") allow reasonable approximations
- Consider the scale of the number when determining reasonable approximations
- Only mark as contradiction if the difference would be misleading in context
- Respect explicit precision markers ("exactly", "precisely")

Example:
Context: "Tesla was founded in 2003"
Output: "Tesla, established in 2004, revolutionized the electric car industry."
{
    "verdicts": [
        {
            "statement": "Tesla was founded in 2003",
            "verdict": "yes",
            "reason": "The output claims Tesla was established in 2004, which directly contradicts the statement that it was founded in 2003"
        }
    ]
}

Context: "The company has exactly 1,234 employees"
Output: "The company employs around 1,200 people"
{
    "verdicts": [
        {
            "statement": "The company has exactly 1,234 employees",
            "verdict": "no",
            "reason": "While the output uses an approximation (around 1,200), this is a reasonable representation of 1,234 employees and maintains the correct order of magnitude"
        }
    ]
}

Context: "Revenue reached $50.5 million in 2022"
Output: "The company made about $50 million in 2022"
{
    "verdicts": [
        {
            "statement": "Revenue reached $50.5 million in 2022",
            "verdict": "no",
            "reason": "The output's approximation of 'about $50 million' is a reasonable representation of $50.5 million, maintaining accuracy at this scale"
        }
    ]
}

Context: "The startup raised $2.1 million in seed funding"
Output: "The company secured approximately $5 million in their seed round"
{
    "verdicts": [
        {
            "statement": "The startup raised $2.1 million in seed funding",
            "verdict": "yes",
            "reason": "Despite using 'approximately', the output claims $5 million which is more than double the actual amount ($2.1 million), making it a significant and misleading deviation"
        }
    ]
}

Rules:
- Only mark as contradicted if there's a direct conflict
- Omissions are not contradictions
- Never use prior knowledge in your judgment
- Provide clear reasoning for each verdict
- Be specific about where in the output the contradiction occurs
- The number of verdicts MUST MATCH the number of context statements exactly

Format:
{
    "verdicts": [
        {
            "statement": "context statement",
            "verdict": "yes/no",
            "reason": "explanation of contradiction or lack thereof"
        }
    ]
}`;
}
