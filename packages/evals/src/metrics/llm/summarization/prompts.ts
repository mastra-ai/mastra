export const SUMMARIZATION_AGENT_INSTRUCTIONS = `
You are a strict and thorough summarization evaluator. Your job is to determine if LLM-generated summaries are factually correct and contain necessary details from the original text.

Key Principles:
1. Be EXTRA STRICT in evaluating factual correctness and coverage.
2. Only give a "yes" verdict if a statement is COMPLETELY supported by the original text.
3. Give "no" if the statement contradicts or deviates from the original text.
4. Focus on both factual accuracy and coverage of key information.
5. Exact details matter - approximations or generalizations count as deviations.
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
      "The company has thousands of employees",
      "The founder was John Smith",
      "The business might be doing well in the Pacific Northwest"
      "The company is growing rapidly"
    ]
    {
      "verdicts": [
        {
          "claim": "The company was established around 1995",
          "verdict": "yes",
          "reason": "The founding year is correctly stated with acceptable approximation ('around 1995' matches '1995')"
        },
        {
          "claim": "The company has thousands of employees",
          "verdict": "no",
          "reason": "The original text states 500 employees, which contradicts thousands"
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
        },
        {
          "claim": "The company is growing rapidly",
          "verdict": "no",
          "reason": "The original text does not mention growth or a specific rate of growth"
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

export function generateQuestionsPrompt({ originalText }: { originalText: string }) {
  return `
    Given the input text, generate yes/no questions to verify if key information is preserved in a summary. Follow these rules:

    Key requirements:
    - Questions MUST be answerable as STRICTLY 'yes' based on the original text
    - Each question must be verifiable with ONLY the information in the text
    - Focus on important facts and main points
    - Questions should be specific and unambiguous
    - No questions that could be interpreted as "maybe" or "partially"

    Example:
    Original Text: "The company was founded in 1995 by John Smith. It started with 10 employees and grew to 500 by 2020. The company is based in Seattle."
    {
      "questions": [
        "Was the company founded in 1995?",
        "Was John Smith the founder?",
        "Did it start with 10 employees?",
        "Did it grow to 500 employees by 2020?",
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
    
    Matching guidelines:
    Facts:
    - Locations must be treated equally when referring to the same place:
        - "founded in X" = "based in X" = "located in X"
        - "headquarters in X" = "located in X"
    - Dates and numbers must match exactly: "2020" ≠ "about 2020"
    - Names and proper nouns must match exactly: "ABC Corp" ≠ "ABC Company"

    Technical Content:
    - Domain terms must match exactly:
        - Scientific concepts: "quantum supremacy" ≠ "quantum advantage"
        - Industry standards: "ISO 9001 certified" ≠ "quality certified"
        - Technical metrics: "99.99% uptime" ≠ "high availability"
    - Technical achievements allow semantic equivalence:
        - "revolutionary quantum computing" = "breakthroughs in quantum computing"
        - "developed AI system" = "created AI solution"
        - "new technology" ≠ "revolutionary technology"

    General Concepts:
    - Allow semantically equivalent phrases: "developed technology" = "made breakthroughs"
    - Reject weaker/stronger claims: "became successful" ≠ "dominated the market"
    - Reject generalizations: "made progress" ≠ "achieved specific milestone"

    Time & Progression:
    - Temporal patterns must match exactly: "steadily growing" ≠ "continues to grow"
    - Future references must match exactly: "next year" ≠ "future plans"
    - Durations must match exactly: "for 5 years" ≠ "for several years"

    Example 1:
    Original Text: "Company Y was established in Boston in 2015. Their first ML model achieved 95% accuracy. The company relocated to Seattle in 2018."
    Summary: "Company Y, founded in Boston in 2015 and later moved to Seattle, developed an ML model with 95% accuracy."
    Questions: [
    "Was Company Y founded in Boston?",
    "Was the company founded in 2015?",
    "Did their ML model achieve 95% accuracy?",
    "Did they move to Seattle?",
    "Did they move in 2018?"
    ]
    {
    "answers": ["yes", "yes", "yes", "yes", "yes"]
    }


    Example 2:
    Original Text: "Company X created revolutionary machine learning solutions in 2020. Their AI model achieved 99% accuracy on benchmarks and processed data 5x faster than competitors. The team grew from 50 to 200 engineers."
    Summary: "In 2020, Company X made breakthroughs in ML technology. Their AI reached 99% accuracy and had 5x speed improvements. Team size increased to about 200 people."
    Questions: [
    "Did Company X create revolutionary ML solutions in 2020?",
    "Did their AI model achieve 99% accuracy?",
    "Was their solution 5x faster than competitors?",
    "Did the team grow to exactly 200 engineers?",
    "Did they start with 50 engineers?"
    ]
    {
    "answers": ["yes", "yes", "yes", "no", "no"]
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
