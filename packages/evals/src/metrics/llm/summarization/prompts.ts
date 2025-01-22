export const SUMMARIZATION_AGENT_INSTRUCTIONS = `
You are a strict and thorough summarization evaluator. Your job is to determine if LLM-generated summaries are factually correct and contain necessary details from the original text.

Key Principles:
1. Be EXTRA STRICT in evaluating factual correctness and coverage.
2. Only give a "yes" verdict if a statement is COMPLETELY supported by the original text.
3. Give "no" if the statement contradicts the original text.
4. Give "unsure" if the statement cannot be verified from the original text.
5. Focus on both factual accuracy and coverage of key information.
`;

export function generateAlignmentPrompt({
  originalText,
  summaryClaims,
}: {
  originalText: string;
  summaryClaims: string[];
}) {
  return `
    For the provided list of summary claims, determine whether each statement is factually correct and supported by the original text.
    Make sure to judge each statement independently. Do not let statements influence each other.
    Generate a list of verdicts in JSON format, where each verdict must have:
    - "claim": The original claim being evaluated
    - "verdict": Strictly "yes", "no", or "unsure"
    - "reason": Always provide a reason explaining your verdict

    Be EXTRA STRICT in your evaluation:
    - Give "yes" if the statement is COMPLETELY supported by the original text
    - Give "no" if the statement contradicts the original text
    - Give "unsure" if the statement cannot be verified from the original text
    - Allow for approximate language if directionally correct (e.g., "around 1995" for "1995")

    The number of verdicts MUST MATCH the number of claims exactly.

    Example:
    Original Text: "The company was founded in 1995 by John Smith. It started with 10 employees and grew to 500 by 2020. The company is based in Seattle."
    Summary Claims: [
      "The company was established around 1995",
      "The company currently has 1000 employees",
      "The founder was John Smith",
      "The business might be doing well in the Pacific Northwest"
    ]

    {
      "verdicts": [
        {
          "claim": "The company was established around 1995",
          "verdict": "yes",
          "reason": "The founding year is correctly stated with acceptable approximation ('around 1995' matches '1995')"
        },
        {
          "claim": "The company currently has 1000 employees",
          "verdict": "no",
          "reason": "The current employee count of 1000 contradicts the original text, which states 500 employees by 2020"
        },
        {
          "claim": "The founder was John Smith",
          "verdict": "yes",
          "reason": "The founder John Smith is correctly identified from the original text"
        },
        {
          "claim": "The business might be doing well in the Pacific Northwest",
          "verdict": "unsure",
          "reason": "While the location (Pacific Northwest/Seattle) is correct, the business performance claim cannot be verified from the original text"
        }
      ]
    }

    Original Text:
    ${originalText}

    Summary Claims:
    ${JSON.stringify(summaryClaims)}

    JSON:
  `;
}

export function generateQuestionsPrompt({
  originalText,
  numberOfQuestions = 5,
}: {
  originalText: string;
  numberOfQuestions?: number;
}) {
  return `
    Based on the given text, generate ${numberOfQuestions} closed-ended questions that can be answered with STRICTLY 'yes' or 'no'.
    The questions should capture key information from the original text.

    Key requirements:
    - Questions MUST be answerable as STRICTLY 'yes' based on the original text
    - Each question must be verifiable with ONLY the information in the text
    - Focus on important facts and main points
    - Questions should be specific and unambiguous
    - Avoid questions about minor or irrelevant details
    - No questions that could be interpreted as "maybe" or "partially"

    Example:
    Original Text: "The company was founded in 1995 by John Smith. It started with 10 employees and grew to 500 by 2020. The company is based in Seattle."

    {
      "questions": [
        "Was the company founded in 1995?",  
        "Was John Smith the founder?",       
        "Did it start with 10 employees?",   
        "Did it have 500 employees by 2020?",
        "Is the company based in Seattle?"
      ]
    }

    Original Text:
    ${originalText}

    JSON:
  `;
}

export function generateAnswersPrompt({
  originalText,
  summary,
  questions,
}: {
  originalText: string;
  summary: string;
  questions: string[];
}) {
  return `
    Based on the given summary, determine if each question can be answered with STRICTLY 'yes' or 'no'.
    Make sure to judge each question independently. Do not let questions influence each other.

    Be STRICT in your evaluation:
    - Give "yes" if the summary provides enough information to definitively answer the question
    - Give "no" if the summary lacks the necessary information or provides contradicting information
    - Each answer must be based ONLY on the information in the summary

    Example:
    Original Text: "The company was founded in 1995 by John Smith. It started with 10 employees and grew to 500 by 2020."
    Summary: "The company was established in 1995 and currently has 1000 employees."
    Questions: [
      "Was the company founded in 1995?",
      "Was John Smith the founder?",
      "Did it start with 10 employees?"
    ]

    {
      "answers": ["yes", "no", "no"]
    }

    Original Text:
    ${originalText}

    Summary:
    ${summary}

    Questions:
    ${JSON.stringify(questions)}

    JSON:
  `;
}

export function generateReasonPrompt({
  originalText,
  summary,
  alignmentScore,
  coverageScore,
  finalScore,
  alignmentVerdicts,
  coverageVerdicts,
  scale,
}: {
  originalText: string;
  summary: string;
  alignmentScore: number;
  coverageScore: number;
  finalScore: number;
  alignmentVerdicts: { verdict: string; reason: string }[];
  coverageVerdicts: { verdict: string; reason: string }[];
  scale: number;
}) {
  return `
    Explain the summarization score where 0 is the lowest and ${scale} is the highest for the LLM's summary using this context:

    Context:
    Original Text: ${originalText}
    Summary: ${summary}
    Alignment Score: ${alignmentScore}
    Coverage Score: ${coverageScore}
    Final Score: ${finalScore}
    Alignment Verdicts: ${JSON.stringify(alignmentVerdicts)}
    Coverage Verdicts: ${JSON.stringify(coverageVerdicts)}

    Rules (follow these rules exactly. do not deviate):
    - Keep your response concise and to the point
    - Do not change scores from what is given
    - Explain both alignment and coverage aspects
    - If there are "no" verdicts, explain why the scores are not higher

    Output format:
    {
      "reason": "The score is {score} because {explanation of alignment and coverage}"
    }

    Example Responses:
    {
      "reason": "The score is ${scale} because the summary is completely factual and covers all key information from the original text"
    }
    {
      "reason": "The score is 0 because the summary contains hallucinations and misses critical information"
    }
  `;
}
