export const createExtractPrompt = (output: string) => `
        Given the text, break it down into meaningful statements while preserving context and relationships.

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

        {
            "statements": ["Look!", "A bird!", "Birds are interesting animals."]
        }

        Please return only JSON format with "statements" array.
        Return empty list for empty input.

        Text:
        ${output}

        JSON:
  `;

export const createScorePrompt = (
  input: string,
  statements: string[],
) => `Evaluate each statement's relevance to the input question, considering direct answers, related context, and uncertain cases.

      Return JSON with array of result objects. Each result must include:
      - "result": "yes", "no", or "unsure"
      - "reason": Clear explanation of the result

      Result Guidelines:
      - "yes": Statement explicitly and directly answers the input question when it:
          * Contains specific answer to the question asked (e.g., "The color of the sky is blue")
          * States explicit relationship between key concepts (e.g., "X is the CEO of company Y")
          * Can stand alone as a complete answer
          * Contains appropriate question-type response (e.g., location for "where", person for "who")
          * Note: If statement is incorrect but directly addresses the question, mark as "unsure"

      - "unsure": Statement shows partial relevance when it:
          * Discusses the type of information being asked about (e.g., mentions temperatures when asked about temperature)
          * Contains information about the answer without explicit statement
          * Uses importance indicators ("main", "primary", "major") with relevant concepts
          * Includes indirect references to the answer (e.g., "where the president works")
          * Contains topic-related administrative/governance terms without direct answer
          * References functions or characteristics typically associated with the answer
          * Uses terms that match what's being asked about
          * Mentions related entities without specifying their relationship to the answer
          * Is incorrect but shows understanding of the question
          * Contains the answer term but needs more context to be complete
          * Contains measurement units or quantities relevant to the question type
          * References locations or entities in the same category as what's being asked about
          * Provides relevant information without using explicit question-type terminology
          * Contains references to properties of the subject that relate to the question type

      - "no": Statement lacks meaningful connection to question when it:
          * Contains neither the subject nor the type of information being requested
          * Contains no terms related to what's being asked about
          * Contains only general subject information without relating to what's being asked
          * Consists of empty or meaningless content
          * Contains purely tangential information with no mention of the subject or question type
          * Discusses the subject but not the specific attribute being asked about
          * Note: Assessment is about connection to what's being asked, not factual accuracy
          * Contains no connection to what's being asked about (neither the subject nor the type of information requested)

      REMEMBER: 
      - If the statement contains words or phrases that are relevant to the input, it is partially relevant.
      - If the statement is a direct answer to the input, it is relevant.
      - If the statement is completely unrelated to the input or contains nothing, it is not relevant.
      - DO NOT MAKE A JUDGEMENT ON THE CORRECTNESS OF THE STATEMENT, JUST THE RELEVANCY.

      STRICT RULES:
      - If a statement mentions the type of information being requested, it should be marked as "unsure" ONLY if it's discussing that type meaningfully (not just mentioning it)
      - Subject mentions alone are NOT enough for relevance - they must connect to what's being asked about
      - Empty or meaningless statements are always "no"
      - General facts about the subject without connection to the question type should be marked as "no"
      - ALWAYS mark a statement as "no" if it discusses the topic without any connection to the question type
      - Statements that mention neither the subject nor the type of information are always "no"
      - Type-level relevance overrides topic-only content
      - Measurement/quantity relevance counts as type-level relevance
      - Administrative/governance terms are only relevant if they relate to the question type
      - Descriptive facts about the subject should be marked as "no" unless they directly relate to the question type

      Examples of "no" statements:
          * "Japan has beautiful seasons" for "What is Japan's largest city?"
          * "Trees grow tall" for "How tall is Mount Everest?"
          * "The weather is nice" for "Who is the president?"

      Example:
      Input: [{ "role": "user", "content": "What color is the sky during daytime?" }]
      Statements: [
        "The sky is blue during daytime",
        "The sky is full of clouds", 
        "I had breakfast today",
        "Blue is a beautiful color",
        "Many birds fly in the sky",
        "",
        "The sky is purple during daytime",
        "Daytime is when the sun is up",
      ]
      JSON:
      {
          "results": [
              {
                  "result": "yes",
                  "reason": "This statement explicitly answers what color the sky is during daytime"
              },
              {
                  "result": "unsure",
                  "reason": "This statement describes the sky but doesn't address its color"
              },
              {
                  "result": "no",
                  "reason": "This statement about breakfast is completely unrelated to the sky"
              },
              {
                  "result": "unsure",
                  "reason": "This statement about blue is related to color but doesn't address the sky"
              },
              {
                  "result": "unsure",
                  "reason": "This statement is about the sky but doesn't address its color"
              },
              {
                  "result": "no",
                  "reason": "This statement is empty"
              },
              {
                  "result": "unsure",
                  "reason": "This statement is incorrect but contains relevant information and still addresses the question"
              },
              {
                  "result": "no",
                  "reason": "This statement is about daytime but doesn't address the sky"
              }
          ]
      }

    The number of results MUST MATCH the number of statements exactly. If there are no statements, the result should be an empty array.

    Input:
    ${input}

    Number of statements: ${statements.length}

    Statements:
    ${statements.join('\n')}

    JSON:
`;

export const createReasonPrompt = ({
  input,
  output,
  score,
  results,
  scale,
}: {
  input: string;
  output: string;
  score: number;
  results: { result: string; reason: string }[];
  scale: number;
}) => `
    Explain the relevancy score where 0 is the lowest and ${scale} is the highest for the LLM's response using this context:
      Context:
      Input: ${input}
      Output: ${output}
      Score: ${score}
      Results: ${JSON.stringify(results)}

      Rules:
      - Explain score based on mix of direct answers and related context
      - Consider both full and partial relevance
      - Keep explanation concise and focused
      - Use given score, don't recalculate
      - Don't judge factual correctness
      - Explain both relevant and irrelevant aspects
      - if results is empty, explain why
      - For mixed responses, explain the balance
        Format:
        "The score is {score} because {explanation of overall relevance}"

        Example Responses:
        "The score is 7 because while the first statement directly answers the question, the additional context is only partially relevant"
        "The score is 3 because while the answer discusses the right topic, it doesn't directly address the question"
`;
