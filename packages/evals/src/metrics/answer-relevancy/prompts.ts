export const ANSWER_RELEVANCY_AGENT_INSTRUCTIONS = `You are a balanced and nuanced answer relevancy evaluator. Your job is to determine if LLM outputs are relevant to the input, including handling partially relevant or uncertain cases.

Key Principles:
1. Evaluate whether the output addresses what the input is asking for
2. Consider both direct answers and related context
3. Prioritize relevance to the input over correctness
4. Recognize that responses can be partially relevant
5. Empty inputs or error messages should always be marked as "no"

Verdict Guidelines:
- "yes": Statement explicitly and directly answers the input question
  * Contains all required components in correct relationship
  * Can stand alone as a complete answer
  * For "what is X" questions, explicitly states relationship
  
- "unsure": Statement has partial relevance when it:
  * Discusses the correct topic but doesn't directly answer
  * Is incorrect but shows understanding of the question
  * Provides relevant context or background
  * Contains mix of relevant and non-relevant information
  * Shows understanding of question type but lacks specificity
  
- "no": Statement is completely off-topic or unrelated to input
  * Discusses entirely different subjects
  * Contains no relevant keywords or concepts
  * Provides error messages or system responses
  * Is empty

Scoring Guidelines:
- Each statement gets a base score:
  * "yes" statements: 10 points
  * "unsure" statements: 3 points
  * "no" statements: 0 points
- For multiple statements:
  * Calculate weighted average based on relevance
  * Consider overall coherence and focus
  * Partial credit for related context

Remember:
- Verdicts must be "yes", "no", or "unsure"
- Reasons required for all verdicts
- Number of verdicts must match statements exactly
- Better to mark as "unsure" when in doubt`;
4;
export function generateEvaluationStatementsPrompt({ output }: { output: string }) {
  return `Given the text, break it down into meaningful statements while preserving context and relationships.
Keep statements together when they form a single coherent point.
Don't split aggressively - maintain natural language flow.

Handle special cases:
- A single word answer should be treated as a complete statement
- Error messages should be treated as a single statement
- Empty strings should return an empty list
- When splitting text, keep related information together

Example:
Example text: Look! A bird! Birds are an interesting animal.

{{
    "statements": ["Look!", "A bird!", "Birds are interesting animals."]
}}

Please return only JSON format with "statements" array.
Return empty list for empty input.

Text:
${output}

JSON:
`;
}

export function generateEvaluatePrompt({ input, statements }: { input: string; statements: string[] }) {
  return `Evaluate each statement's relevance to the input question, considering direct answers, related context, and uncertain cases.

    Return JSON with array of verdict objects. Each verdict must include:
    - "verdict": "yes", "no", or "unsure"
    - "reason": Clear explanation of the verdict
    - Exact match between number of verdicts and statements

    A statement is "yes" ONLY if it:
    - Directly and explicitly states the complete answer
    - Uses clear relationship words ("is the capital of")
    - Makes the exact relationship unambiguous
    - Does not require inference or context

    A statement is "unsure" if it:
    - Discusses correct topic but lacks explicit answer
    - Is incorrect but answers the right type of question
    - Requires inference to understand the answer
    - Contains key terms without clear relationships
    - Makes statements about the answer subject
    - Discusses the exact topic type being asked about
    - Contains keywords from the input, but does not make the relationship clear
    - Only mentions related keywords without addressing the topic type

    A statement is "no" if it:
    - Is completely unrelated to the question
    - Contains no relevant concepts
    - Is empty


    Example:
    Input: "What color is the sky during daytime?"
    Statements: [
      "The sky is blue during daytime",
      "The sky is full of clouds", 
      "I had breakfast today",
      "Blue is a beautiful color",
      "Many birds fly in the sky",
    ]
    JSON:
    {{
        "verdicts": [
            {{
                "verdict": "yes",
                "reason": "This statement explicitly answers what color the sky is during daytime"
            }},
            {{
                "verdict": "unsure",
                "reason": "This statement describes the sky but doesn't address its color"
            }},
            {{
                "verdict": "no",
                "reason": "This statement about breakfast is completely unrelated to the sky"
            }},
            {{
                "verdict": "unsure",
                "reason": "This statement about blue is related to color but doesn't address the sky"
            }},
            {{
                "verdict": "unsure",
                "reason": "This statement is about the sky but doesn't address its color"
            }}
        ]
    }}

  Input:
  ${input}

  Statements:
  ${statements.join('\n')}

  JSON:
  `;
}

export function generateReasonPrompt({
  score,
  reasons,
  input,
  output,
}: {
  score: number;
  reasons: string[];
  input: string;
  output: string;
}) {
  return `Explain the irrelevancy score (0-10) for the LLM's response using this context:
  Context:
  Input: ${input}
  Output: ${output}
  Score: ${score}
  Irrelevancy Reasons: ${reasons.join('\n')}
  
  Rules:
  - Explain score based on mix of direct answers and related context
  - Consider both full and partial relevance
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Don't judge factual correctness
  - Explain both relevant and irrelevant aspects
  - For mixed responses, explain the balance

    Format:
    {
        "reason": "The score is {score} because {explanation of overall relevance}"
    }

    Example Responses:
    {
        "reason": "The score is 7 because while the first statement directly answers the question, the additional context is only partially relevant"
    }
    {
        "reason": "The score is 3 because while the answer discusses the right topic, it doesn't directly address the question"
    }
    `;
}
