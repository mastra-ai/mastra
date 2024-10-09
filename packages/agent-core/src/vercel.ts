import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { CoreMessage, generateText, tool } from 'ai';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function createAgent({
  agent_instructions,
  maxSteps = 5,
  tools,
  resultTool,
  context = [],
  model,
}: {
  model: { type: string; name?: string; toolChoice?: any };
  tools: Record<string, { description: string; parameters: any; execute: any }>;
  resultTool?: { description: string; parameters: any };
  maxSteps?: number;
  agent_instructions: string;
  context?: CoreMessage[];
}) {
  const toolsConverted = Object.entries(tools).reduce((memo, [key, val]) => {
    memo[key] = tool(val);
    return memo;
  }, {} as Record<string, any>);

  let answerTool = {};

  if (resultTool) {
    answerTool = { answer: tool(resultTool) };
  }

  let modelDef: any;

  if (model.type === 'openai') {
    let mName = model.name;
    if (!mName) {
      mName = `gpt-4o-2024-08-06`;
    }

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    modelDef = openai(mName, { structuredOutputs: true });
  } else if (model.type === 'anthropic') {
    let mName = model.name;
    if (!mName) {
      mName = `claude-3-5-sonnet-20240620`;
    }
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    modelDef = anthropic(mName);
  } else if (model.type === 'groq') {
    let mName = model.name;
    if (!mName) {
      mName = `llama-3.2-90b-text-preview`;
    }

    // Groq is compatible with OpenAI
    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });
    modelDef = groq(mName);
  }

  return async ({ prompt }: { prompt: string }) => {
    return await generateText({
      model: modelDef,
      messages: [
        ...context,
        {
          role: 'user',
          content: prompt,
        },
        {
          role: 'system',
          content: agent_instructions,
        },
      ],
      tools: {
        ...toolsConverted,
        // answer tool: the LLM will provide a structured answer
        ...answerTool,
        // no execute function - invoking it will terminate the agent
      },
      toolChoice: model?.toolChoice || 'required',
      maxSteps: maxSteps,
      // system: systemPrompt,
      onStepFinish: async (props: any) => {
        console.log(JSON.stringify(props, null, 2));
        if (
          props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
          parseInt(props?.response?.headers?.['x-ratelimit-remaining-tokens'], 10) < 2000
        ) {
          console.log('Rate limit reached, waiting 10 seconds');
          await delay(10 * 1000);
        }
      },
    });
  };
}
