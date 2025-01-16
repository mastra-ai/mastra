export const ANSWER_RELEVANCY_AGENT_INSTRUCTIONS = `You are a balanced and nuanced answer relevancy evaluator. Your job is to determine if LLM outputs are relevant to the input, including handling partially relevant or uncertain cases.

Key Principles:
1. Evaluate whether the output addresses what the input is asking for
2. Consider both direct answers and related context
3. Prioritize relevance to the input over correctness
4. Recognize that responses can be partially relevant
5. Empty inputs or error messages should always be marked as "no"`;

export function generateEvaluationStatementsPrompt({ output }: { output: string }) {
  return `Given the text, break it down into meaningful statements while preserving context and relationships.
Don't split too aggressively.

Split compound statements particularly when they:
- Are joined by "and"
- Contain multiple distinct facts or claims
- Have multiple descriptive elements about the subject


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

    Verdict Guidelines:
    - "yes": Statement explicitly and directly answers the input question
        * Contains specific answer to the question asked (e.g., "The color of the sky is blue")
        * States explicit relationship between key concepts (e.g., "X is the CEO of company Y")
        * Can stand alone as a complete answer
        * Contains appropriate question-type response (e.g., location for "where", person for "who")

    - "unsure": Statement shows partial relevance when it:
        * Contains topic-related administrative/governance terms without direct answer
        * Mentions locations or entities related to the answer without specifying their role
        * References functions or characteristics typically associated with the answer
        * Is incorrect but shows understanding of the question
        * Uses importance indicators ("main", "primary", "major") with relevant concepts
        * Includes indirect references to the answer (e.g., "where the president works")
        * Contains multiple relevant concepts but lacks explicit relationship between them
        * Demonstrates understanding of question domain without providing specific answer

    - "no": Statement lacks meaningful connection to question when it:
        * Contains no concepts related to the question type or domain
        * Only mentions the broader topic without relevant details (e.g., "the country has nice weather")
        * Provides general descriptions without addressing the specific question
        * Contains purely tangential information about the subject
        * Consists of empty or meaningless content
        * Discusses characteristics unrelated to the question type (e.g., describing cuisine when asked about geography)
        * Note: Assessment is about topical relationship, not factual accuracy

    REMEMBER: A statmenent does not have to be correct, it just has to be relevant.
    If the statement contains words or phrases that are relevant to the input, it is partially relevant.
    If the statement is a direct answer to the input, it is relevant.
    If the statement is completely unrelated to the input or contains nothing, it is not relevant.
    DO NOT MAKE A JUDGEMENT ON THE CORRECTNESS OF THE STATEMENT, JUST THE RELEVANCY.


    Example:
    Input: "What color is the sky during daytime?"
    Statements: [
      "The sky is blue during daytime",
      "The sky is full of clouds", 
      "I had breakfast today",
      "Blue is a beautiful color",
      "Many birds fly in the sky",
      "",
      "The sky is purple during daytime",
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
            }},
            {{
                "verdict": "no",
                "reason": "This statement is empty"
            }},
            {{
                "verdict": "unsure",
                "reason": "This statement is incorrect but contains relevant information and still addresses the question"
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
