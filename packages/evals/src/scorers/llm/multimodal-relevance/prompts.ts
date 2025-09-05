export const createAnalyzePrompt = ({
  userInput,
  aiResponse,
  contexts,
}: {
  userInput: string;
  aiResponse: string;
  contexts: Array<{ type: 'text' | 'image' | 'multimodal'; content: string | any }>;
}) => {
  const contextDescription = contexts
    .map((ctx, index) => {
      if (ctx.type === 'text') {
        return `Context ${index + 1} (Text): ${ctx.content}`;
      } else if (ctx.type === 'image') {
        return `Context ${index + 1} (Image): [Image data provided - analyze visual content]`;
      } else {
        return `Context ${index + 1} (Multimodal): ${typeof ctx.content === 'string' ? ctx.content : '[Complex multimodal content]'}`;
      }
    })
    .join('\n\n');

  return `You are an expert evaluator for multimodal AI systems. Your task is to determine whether an AI response is relevant to the user's query given the provided multimodal contexts (text, images, or both).

EVALUATION CRITERIA:

A response is RELEVANT when it:
- Directly addresses the user's question using information from the provided contexts
- Correctly interprets and references visual content from images when applicable
- Synthesizes information from multiple modalities appropriately
- Answers based on what can be observed or read in the provided contexts

A response is NOT RELEVANT when it:
- Ignores the provided contexts completely
- Makes claims that contradict the context information
- Fails to utilize relevant visual information when images are provided
- Provides generic responses without grounding in the specific contexts
- Misinterprets multimodal content significantly

SCORING GUIDELINES:
- Focus on how well the response uses the provided contexts, not factual accuracy
- Consider multimodal alignment: does the response appropriately reference both text and visual elements?
- Partial relevance should be scored between 0 and 1 based on how much context is utilized
- Complete irrelevance (ignoring all contexts) = 0
- Perfect relevance (fully grounded in contexts) = 1

USER QUERY:
${userInput}

PROVIDED CONTEXTS:
${contextDescription}

AI RESPONSE:
${aiResponse}

EVALUATION TASK:
Analyze the AI response against the user query and provided contexts. Consider:
1. Does the response address the user's question?
2. Does it appropriately use information from the text contexts?
3. If images are provided, does it reference or interpret visual content accurately?
4. Is the response grounded in the provided contexts rather than external knowledge?

Return a JSON object with your analysis:
{
  "contextual_grounding": "Description of how well the response uses the provided contexts",
  "multimodal_alignment": "Assessment of how the response handles different modalities (text/images)",
  "query_alignment": "Evaluation of how directly the response addresses the user's question",
  "relevance_score": 0.0-1.0,
  "reasoning": "Detailed explanation of the relevance assessment"
}`;
};

export const createScorePrompt = ({
  userInput,
  aiResponse,
  analysisResult,
}: {
  userInput: string;
  aiResponse: string;
  analysisResult: {
    contextual_grounding: string;
    multimodal_alignment: string;
    query_alignment: string;
    relevance_score: number;
    reasoning: string;
  };
}) => `Based on the detailed analysis provided, assign a final relevance score from 0.0 to 1.0.

USER QUERY: ${userInput}

AI RESPONSE: ${aiResponse}

ANALYSIS RESULTS:
- Contextual Grounding: ${analysisResult.contextual_grounding}
- Multimodal Alignment: ${analysisResult.multimodal_alignment}
- Query Alignment: ${analysisResult.query_alignment}
- Initial Score: ${analysisResult.relevance_score}
- Reasoning: ${analysisResult.reasoning}

Provide a final score that reflects the overall multimodal relevance quality. Consider:
- Weight contextual grounding heavily (40%)
- Consider query alignment (30%)
- Factor in multimodal handling (30%)

Return only a number between 0.0 and 1.0 representing the final relevance score.`;

export const createReasonPrompt = ({
  userInput,
  aiResponse,
  score,
  analysisResult,
}: {
  userInput: string;
  aiResponse: string;
  score: number;
  analysisResult: {
    contextual_grounding: string;
    multimodal_alignment: string;
    query_alignment: string;
    relevance_score: number;
    reasoning: string;
  };
}) => `Provide a clear explanation for the multimodal relevance score of ${score}.

USER QUERY: ${userInput}

AI RESPONSE: ${aiResponse}

ANALYSIS: ${analysisResult.reasoning}

Explain the score by addressing:
1. How well the response utilized the provided contexts
2. Whether multimodal elements were appropriately handled
3. The degree to which the user's query was addressed

Format: "The score is ${score} because [explanation focusing on multimodal relevance assessment]"

Keep the explanation concise and focus on the key factors that determined the relevance score.`;
