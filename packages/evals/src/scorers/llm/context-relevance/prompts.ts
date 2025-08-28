export const CONTEXT_RELEVANCE_INSTRUCTIONS = `You are an expert context relevance evaluator. Your job is to analyze whether the provided context information was appropriate and useful for generating the agent's response to the user's query.

Key Evaluation Criteria:
1. **Relevance**: Does the context directly relate to the user's query?
2. **Utility**: Did the context help produce a better response?
3. **Completeness**: Was the context sufficient for the task?
4. **Quality**: Is the context accurate and trustworthy?

Evaluation Guidelines:
- Context that directly answers or supports the user's query should be marked as highly relevant
- Context that provides background information relevant to the query should be considered moderately relevant  
- Context that is tangentially related but doesn't directly help should be marked as low relevance
- Context that is completely unrelated should be marked as irrelevant
- Consider whether missing context might have led to a better response

Be thorough and fair in your evaluation, considering both what context was provided and what might have been more useful.`;

export function createAnalyzePrompt({
  userQuery,
  agentResponse,
  providedContext,
}: {
  userQuery: string;
  agentResponse: string;
  providedContext: string[];
}) {
  const contextList = providedContext.map((ctx, index) => `[${index}] ${ctx}`).join('\n');

  return `Analyze the relevance of the provided context for answering the user's query and generating the agent's response.

User Query:
${userQuery}

Agent Response:
${agentResponse}

Context pieces to evaluate:
${contextList}

For each context piece, evaluate:
1. **Relevance Level**: How relevant is it to the user's query?
   - "high": Directly addresses the query or provides essential information
   - "medium": Provides supporting or background information that's helpful
   - "low": Tangentially related but not very helpful
   - "none": Completely irrelevant or unrelated

2. **Usage**: Was this context actually used in generating the agent's response?
   - true: The response clearly incorporates or reflects this information
   - false: This information doesn't appear to be used in the response

3. **Reasoning**: Explain your assessment in detail

Also identify any missing context that should have been provided to better answer the query.

Format your response as:
{
  "evaluations": [
    {
      "context_index": 0,
      "contextPiece": "the actual text of the context piece",
      "relevanceLevel": "high/medium/low/none", 
      "wasUsed": true/false,
      "reasoning": "detailed explanation of the evaluation"
    }
  ],
  "missingContext": ["list of missing information that would have been helpful"],
  "overallAssessment": "summary of the context quality and usage"
}

The number of evaluations MUST match the number of context pieces exactly.

Example:
User Query: "What are the benefits of exercise?"
Agent Response: "Regular exercise improves cardiovascular health and mental wellbeing."
Context:
[0] "Exercise strengthens the heart and improves blood circulation."
[1] "A balanced diet is important for overall health."
[2] "Regular physical activity reduces stress and anxiety levels."

{
  "evaluations": [
    {
      "context_index": 0,
      "contextPiece": "Exercise strengthens the heart and improves blood circulation.",
      "relevanceLevel": "high",
      "wasUsed": true,
      "reasoning": "This context directly supports the cardiovascular health benefit mentioned in the response"
    },
    {
      "context_index": 1,
      "contextPiece": "A balanced diet is important for overall health.",
      "relevanceLevel": "none",
      "wasUsed": false,
      "reasoning": "This context is about diet, not exercise benefits, and doesn't contribute to answering the query"
    },
    {
      "context_index": 2,
      "contextPiece": "Regular physical activity reduces stress and anxiety levels.",
      "relevanceLevel": "high", 
      "wasUsed": true,
      "reasoning": "This context directly supports the mental wellbeing benefit mentioned in the response"
    }
  ],
  "missingContext": [],
  "overallAssessment": "The context is mostly high-quality with 2 out of 3 pieces being highly relevant and used in the response"
}`;
}

export function createReasonPrompt({
  userQuery,
  score,
  evaluations,
  missingContext,
  scale,
}: {
  userQuery: string;
  score: number;
  evaluations: Array<{
    context_index: number;
    contextPiece: string;
    relevanceLevel: string;
    wasUsed: boolean;
    reasoning: string;
  }>;
  missingContext: string[];
  scale: number;
}) {
  return `Explain the context relevance score for the provided context based on its relevance and usage in generating the agent's response.

User Query:
${userQuery}

Score: ${score} out of ${scale}

Context Evaluations:
${evaluations
  .map(
    evaluation =>
      `[${evaluation.context_index}] Relevance: ${evaluation.relevanceLevel}, Used: ${evaluation.wasUsed ? 'Yes' : 'No'}
   Context: "${evaluation.contextPiece}"
   Reasoning: ${evaluation.reasoning}`,
  )
  .join('\n\n')}

${missingContext.length > 0 ? `\nMissing Context Issues:\n${missingContext.map(item => `- ${item}`).join('\n')}` : ''}

Context Relevance measures how well the provided context supports answering the user's query and generating the expected response. The score considers:
- Relevance levels (high=1.0, medium=0.7, low=0.3, none=0.0)
- Usage penalties (10% penalty per unused high-relevance context)
- Missing context penalties (up to 50% penalty for identified gaps)

Rules for explanation:
- Explain the score based on context relevance levels and usage
- Mention any penalties applied for unused relevant context or missing information
- Keep explanation concise and actionable for improving context selection
- Use the given score, don't recalculate

Format:
"The score is ${score} because {explanation of context relevance, usage, and any penalties}"

Example responses:
"The score is 0.85 because 2 out of 3 context pieces are highly relevant and used in the response, with only minor penalty for one unused medium-relevance context piece."
"The score is 1.0 because all context pieces are highly relevant to the query about exercise benefits and were effectively used in generating the comprehensive response."
"The score is 0.40 because while some context is relevant, key information about the topic was missing and one highly relevant context piece was not utilized in the response."`;
}
