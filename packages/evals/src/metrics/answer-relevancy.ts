import { type ModelConfig } from '@mastra/core';
import { type MeasureParams, type MetricResult, MetricWithLLM } from '@mastra/core';

export class AnswerRelevancy extends MetricWithLLM {
  private statementPrompt = `Given the text, breakdown and generate a list of statements presented. Ambiguous statements and single words can also be considered as statements.

EXAMPLES:
Input: Shoes. The shoes can be refunded at no extra cost. Thanks for asking the question!
Output: {"statements":["Shoes.","Shoes can be refunded at no extra cost","Thanks for asking the question!"]}

Text:
{{actualOutput}}

Please output your response in the following format: JSON`;

  private verdictPrompt = `For the provided list of statements, determine whether each statement is relevant to address the input.
Please generate a list of JSON with two keys: "verdict" and "reason".
The 'verdict' key should STRICTLY be either a 'yes', 'idk' or 'no'. Answer 'yes' if the statement is relevant to addressing the original input, 'no' if the statement is irrelevant, and 'idk' if it is ambiguous (eg., not directly relevant but could be used as a supporting point 
to address the input).
The 'reason' is the reason for the verdict.
Provide a 'reason' ONLY if the answer is 'no'.
The provided statements are statements made in the actual output.



EXAMPLES:
Input: input: What should I do if there is an earthquake?
statements: ["Shoes.", "Thanks for asking the question!", "Is there anything else I can help you with?", "Duck and hide"]
Output: {"verdicts":[{"verdict":"no","reason":"The 'Shoes.' statement made in the actual output is completely irrelevant to the input, which asks about what to do in the event of an earthquake."},{"verdict":"idk"},{"verdict":"idk"},{"verdict":"yes"}]}
Since you are going to generate a verdict for each statement, the number of 'verdicts' SHOULD BE STRICTLY EQUAL to the number of 'statements'.

Input:
{{input}}

Statements:
{{actualOutput}}      

Please output your response in the following format: JSON`;

  private reasonPrompt = `Given the answer relevancy score, the list of reasons of irrelevant statements made in the actual output, and the input, provide a CONCISE reason for the score. Explain why it is not higher, but also why it is at its current score.
The irrelevant statements represent things in the actual output that is irrelevant to addressing whatever is asked/talked about in the input.
If there is nothing irrelevant, just say something positive with an upbeat encouraging tone (but don't overdo it otherwise it gets annoying).

Example JSON:
{
  "reason": "The score is <answer_relevancy_score> because <your_reason>."
}

Answer Relevancy Score:
{{score}}

Reasons why the score can't be higher based on irrelevant statements in the actual output:
{{irrelevantStatements}}

Input:
{{input}}

Please output your response in the following format: JSON`;

  constructor(model: ModelConfig) {
    super(model);
  }

  async measure(args: MeasureParams): Promise<MetricResult> {
    const statementPrompt = this.statementPrompt.replace('{{actualOutput}}', args.output);
    await this.llm.generate(statementPrompt);

    const verdictPrompt = this.verdictPrompt.replace('{{input}}', args.input).replace('{{actualOutput}}', args.output);

    const { text: verdictText } = await this.llm.generate(verdictPrompt);

    const { verdicts } = JSON.parse(verdictText.replace(/```json\n|```/g, '')) as {
      verdicts: Array<{
        verdict: string;
        reason: string;
      }>;
    };

    const numberOfVerdicts = verdicts.length;
    if (numberOfVerdicts === 0) {
      return {
        score: 1,
      };
    }

    const relevantCount = verdicts.filter(verdict => verdict.verdict.trim().toLowerCase() !== 'no').length;

    const score = relevantCount / numberOfVerdicts;

    const irrelevantStatements = verdicts
      .filter(verdict => verdict.verdict.trim().toLowerCase() === 'no')
      .map(verdict => verdict.reason);

    const reasonPrompt = this.reasonPrompt
      .replace('{{irrelevantStatements}}', irrelevantStatements.join('\n'))
      .replace('{{input}}', args.input)
      .replace('{{score}}', score.toFixed(2));
    const { text: reasonText } = await this.llm.generate(reasonPrompt);

    return { score: Math.round(score * 100) / 100, reason: reasonText };
  }
}
