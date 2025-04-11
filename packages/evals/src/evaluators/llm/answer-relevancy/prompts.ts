import { z } from 'zod';
import type { LLMEvaluatorReasonPromptArgs, LLMEvaluatorEvalPromptArgs } from '../types';

export const ANSWER_RELEVANCY_INSTRUCTIONS = `
    You are a balanced and nuanced answer relevancy evaluator. Your job is to determine if LLM outputs are relevant to the input, including handling partially relevant or uncertain cases.

    Key Principles:
    1. Evaluate whether the output addresses what the input is asking for
    2. Consider both direct answers and related context
    3. Prioritize relevance to the input over correctness
    4. Recognize that responses can be partially relevant
    5. Empty inputs or error messages should always be marked as "no"
    6. Responses that discuss the type of information being asked show partial relevance
`;

export const STATEMENT_TEMPLATE =
  'Given the text, break it down into meaningful statements while preserving context and relationships.\n  Don\'t split too aggressively.\n  \n  Split compound statements particularly when they:\n  - Are joined by "and"\n  - Contain multiple distinct facts or claims\n  - Have multiple descriptive elements about the subject\n  \n  \n  Handle special cases:\n  - A single word answer should be treated as a complete statement\n  - Error messages should be treated as a single statement\n  - Empty strings should return an empty list\n  - When splitting text, keep related information together\n  \n  Example:\n  Example text: Look! A bird! Birds are an interesting animal.\n  \n  {{\n      "statements": ["Look!", "A bird!", "Birds are interesting animals."]\n  }}\n  \n  Please return only JSON format with "statements" array.\n  Return empty list for empty input.\n  \n  Text:\n  {output}\n  \n  JSON:\n  ';

export function generateEvaluationStatementsPrompt({ output }: { output: string }) {
  return STATEMENT_TEMPLATE.replace('{output}', output);
}

export const REASON_TEMPLATE =
  'Explain the irrelevancy score where 0 is the lowest and {scale} is the highest for the LLM\'s response using this context:\n    Context:\n    Input: {input}\n    Output: {output}\n    Score: {score}\n    Outcomes: {outcomes}\n    \n    Rules:\n    - Explain score based on mix of direct answers and related context\n    - Consider both full and partial relevance\n    - Keep explanation concise and focused\n    - Use given score, don\'t recalculate\n    - Don\'t judge factual correctness\n    - Explain both relevant and irrelevant aspects\n    - For mixed responses, explain the balance\n      Format:\n      {\n          "reason": "The score is {score} because {explanation of overall relevance}"\n      }\n      Example Responses:\n      {\n          "reason": "The score is 7 because while the first statement directly answers the question, the additional context is only partially relevant"\n      }\n      {\n          "reason": "The score is 3 because while the answer discusses the right topic, it doesn\'t directly address the question"\n      }\n      ';

export function generateReasonPrompt({
  input,
  output,
  eval_result,
  settings,
  outcomes,
  formatter,
  template,
}: LLMEvaluatorReasonPromptArgs) {
  return formatter(template, {
    input,
    output,
    eval_result: String(eval_result.score),
    scale: String(settings.scale),
    outcomes: JSON.stringify(outcomes),
  });
}

export const EVAL_TEMPLATE = `Evaluate each statement's relevance to the input question, considering direct answers, related context, and uncertain cases.

      Return JSON with array of outcome objects. Each outcome must include:
      - "outcome": "yes", "no", or "unsure"
      - "reason": Clear explanation of the outcome
      - "claim": The statement being evaluated

      Outcome Guidelines:
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
      Input: "What color is the sky during daytime?"
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
      {{
          "outcomes": [
              {{
                  "outcome": "yes",
                  "reason": "This statement explicitly answers what color the sky is during daytime",
                  "claim": "The sky is blue during daytime"
              }},
              {{
                  "outcome": "unsure",
                  "reason": "This statement describes the sky but doesn't address its color",
                  "claim": "The sky is full of clouds"
              }},
              {{
                  "outcome": "no",
                  "reason": "This statement about breakfast is completely unrelated to the sky",
                  "claim": "I had breakfast today"
              }},
              {{
                  "outcome": "unsure",
                  "reason": "This statement about blue is related to color but doesn't address the sky",
                  "claim": "Blue is a beautiful color"
              }},
              {{
                  "outcome": "unsure",
                  "reason": "This statement is about the sky but doesn't address its color",
                  "claim": "Many birds fly in the sky"
              }},
              {{
                  "outcome": "no",
                  "reason": "This statement is empty",
                  "claim": ""
              }},
              {{
                  "outcome": "unsure",
                  "reason": "This statement is incorrect but contains relevant information and still addresses the question",
                  "claim": "The sky is purple during daytime"
              }},
              {{
                  "outcome": "no",
                  "reason": "This statement is about daytime but doesn't address the sky",
                  "claim": "Daytime is when the sun is up"
              }}
          ]
      }}

  The number of outcomes MUST MATCH the number of statements exactly.

    Input:
    {input}

    Number of statements: {statementCount}

    Statements:
    {statements}

    JSON:
    `;

export async function generateEvaluationPrompt({
  input,
  context,
  settings,
  output,
  formatter,
  template,
}: LLMEvaluatorEvalPromptArgs) {
  const statements = generateEvaluationStatementsPrompt({ output });
  return formatter(template, {
    input,
    statements,
    statementCount: statements.length,
    ...settings,
    context: context?.join(', ') || '',
    output,
  });
}
