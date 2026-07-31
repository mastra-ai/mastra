export const SUMMARIZATION_AGENT_INSTRUCTIONS = `You are a strict summarization evaluator. Your job is to determine whether a summary is factually faithful to its source text and whether it preserves the information the source states.

Key Principles:
1. Judge only against the text you are given, never against prior knowledge
2. A claim is supported only when the source states or directly implies it
3. Treat approximations as deviations when the source is precise: "about 2020" does not match "2020"
4. Allow semantically equivalent phrasing: "founded in Boston" matches "based in Boston"
5. Judge each claim and each question independently
6. Factual accuracy and information coverage are separate concerns and are judged separately`;

/**
 * Builds the preprocess prompt, which covers everything that needs the source text.
 *
 * Claims are extracted from the summary and judged against the source in one pass,
 * so every verdict carries the claim it belongs to. Questions are drawn from the
 * source for the coverage step that follows.
 *
 * @param maxQuestions - Upper bound on the generated questions
 * @returns A prompt asking for `{ alignment, questions }`
 */
export function createSourceJudgementPrompt({
  sourceText,
  summary,
  maxQuestions,
}: {
  sourceText: string;
  summary: string;
  maxQuestions: number;
}) {
  return `Complete two independent parts.

Part 1 (alignment): extract the atomic claims the summary makes, then decide whether the source text supports each one.
- A claim is a single statement that asserts one piece of information
- Break compound statements into individual claims
- Include factual assertions such as numbers, dates, and quantities
- Exclude questions, commands, and purely stylistic text
- Set "supported" to true only when the source states or directly implies the claim, and to false when the source contradicts it or does not contain it
- Return an empty list when the summary makes no claims

Part 2 (questions): write at most ${maxQuestions} closed-ended questions drawn from the source text.
- Every question must be answerable as "yes" from the source text alone
- Cover the most important facts and main points first
- Each question must be specific, unambiguous, and verifiable from the source
- Choose the questions from the source alone. Do not let the summary influence which facts you pick, and do not skip a fact because the summary omits it
- Never write questions that could be answered "maybe" or "partially"
- Return an empty list when the source text is empty

Matching guidelines for Part 1:
- Dates, numbers, and proper nouns must match exactly: "2020" does not match "about 2020", "ABC Corp" does not match "ABC Company"
- Domain terms must match exactly: "quantum supremacy" does not match "quantum advantage"
- General phrasing may differ when the meaning holds: "developed technology" matches "made breakthroughs"
- Weaker or stronger claims do not match: "became successful" does not match "dominated the market"

Format:
{
    "alignment": [
        {
            "claim": "the claim the summary makes",
            "supported": true,
            "reason": "why the source does or does not support this claim"
        }
    ],
    "questions": ["a question the source answers with yes"]
}

Example:
Source Text: "Company Y was established in Boston in 2015. Their first ML model achieved 95% accuracy. The company relocated to Seattle in 2018."
Summary: "Company Y, founded in Boston in 2015, built an ML model with 99% accuracy."

{
    "alignment": [
        {
            "claim": "Company Y was founded in Boston in 2015",
            "supported": true,
            "reason": "The source states the company was established in Boston in 2015"
        },
        {
            "claim": "Company Y built an ML model with 99% accuracy",
            "supported": false,
            "reason": "The source states 95% accuracy, which contradicts 99%"
        }
    ],
    "questions": [
        "Was Company Y established in Boston in 2015?",
        "Did their first ML model achieve 95% accuracy?",
        "Did the company relocate to Seattle in 2018?"
    ]
}

Source Text:
${sourceText}

Summary:
${summary}

JSON:
`;
}

/**
 * Builds the analyze prompt, which answers the coverage questions.
 *
 * The source text is deliberately absent. A judge that could see it would answer
 * from the source instead of the summary, which would hide exactly the omissions
 * this axis exists to measure.
 *
 * @returns A prompt asking for `{ coverage }`
 */
export function createCoveragePrompt({ summary, questions }: { summary: string; questions: string[] }) {
  return `Decide whether each question can be answered from the summary below. The summary is the only evidence you have, and you must not rely on prior knowledge.

Summary:
${summary}

Number of questions: ${questions.length}

Questions:
${questions.map((question, index) => `[${index}] ${question}`).join('\n')}

Set "answered" to true only when the summary holds enough information to answer the question, and to false when the summary omits or contradicts that information.

Matching guidelines:
- Dates, numbers, and proper nouns must match exactly: "2020" does not match "about 2020", "ABC Corp" does not match "ABC Company"
- Domain terms must match exactly: "quantum supremacy" does not match "quantum advantage"
- General phrasing may differ when the meaning holds: "developed technology" matches "made breakthroughs"
- Weaker or stronger claims do not match: "became successful" does not match "dominated the market"

The number of verdicts MUST MATCH the number of questions exactly.

Format:
{
    "coverage": [
        {
            "question": "the question being answered",
            "answered": true,
            "reason": "why the summary can or cannot answer this question"
        }
    ]
}

Example:
Summary: "Company Y, founded in Boston in 2015, built an ML model with 99% accuracy."
Questions: ["Was Company Y established in Boston in 2015?", "Did their first ML model achieve 95% accuracy?", "Did the company relocate to Seattle in 2018?"]

{
    "coverage": [
        {
            "question": "Was Company Y established in Boston in 2015?",
            "answered": true,
            "reason": "The summary states the company was founded in Boston in 2015"
        },
        {
            "question": "Did their first ML model achieve 95% accuracy?",
            "answered": false,
            "reason": "The summary reports 99% accuracy, so the question cannot be answered as asked"
        },
        {
            "question": "Did the company relocate to Seattle in 2018?",
            "answered": false,
            "reason": "The summary does not mention the relocation"
        }
    ]
}`;
}

/**
 * Builds the prompt that explains a finished score.
 *
 * Both axis scores and the failing claims and questions are passed in so the
 * explanation names the axis that decided the result instead of recalculating it.
 *
 * @returns A prompt asking for a one-sentence explanation of the score
 */
export function createSummarizationReasonPrompt({
  sourceText,
  summary,
  score,
  scale,
  alignmentScore,
  coverageScore,
  unsupportedClaims,
  missingQuestions,
}: {
  sourceText: string;
  summary: string;
  score: number;
  scale: number;
  alignmentScore: number;
  coverageScore: number;
  unsupportedClaims: string[];
  missingQuestions: string[];
}) {
  return `Explain the summarization score for the given summary.

Source Text:
${sourceText}

Summary:
${summary}

Score: ${score} out of ${scale}
Alignment score: ${alignmentScore}
Coverage score: ${coverageScore}
Claims the source does not support:
${unsupportedClaims.length > 0 ? unsupportedClaims.map(claim => `- ${claim}`).join('\n') : '- none'}
Questions the summary cannot answer:
${missingQuestions.length > 0 ? missingQuestions.map(question => `- ${question}`).join('\n') : '- none'}

Summarization takes the lower of two scores, so the weaker axis decides the result:
- Alignment = supported claims / total claims
- Coverage = answered questions / total questions
- Score = min(alignment, coverage) × scale

Rules for explanation:
- Name the axis that produced the score
- Point at the specific claims or questions behind it
- Keep the explanation short and concrete
- Use the given score, don't recalculate

Format:
"The score is ${score} because {explanation of the summarization quality}"

Example responses:
"The score is 0.5 because coverage was the weaker axis: the summary answers 2 of 4 questions from the source and leaves out both the employee count and the relocation date."
"The score is 0.67 because alignment was the weaker axis: the claim about 99% accuracy contradicts the source, which reports 95%."
"The score is 1.0 because every claim in the summary is supported by the source and the summary answers every question drawn from it."`;
}
