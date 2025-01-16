import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, generateReasonPrompt, PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS } from './prompts';

export class PromptAlignmentJudge extends MastraAgentJudge {
  constructor(provider: string, name: string) {
    super(provider, name, PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS, 'Prompt Alignment');
  }

  async evaluate(input: string, actualOutput: string, instructions: string[]): Promise<string> {
    const prompt = generateEvaluatePrompt({ input, output: actualOutput, instructions });
    const result = await this.agent.generate(prompt);
    return result.text;
  }

  async getReason(input: string, actualOutput: string, score: number, reasons: string[]): Promise<string> {
    const prompt = generateReasonPrompt({ input, output: actualOutput, reasons, score });
    const result = await this.agent.generate(prompt);
    return result.text;
  }
}
