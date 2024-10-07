import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';

const openai = createOpenAI({
    apiKey: 'sk-svcacct-C8pLEG6H9ZKRMQlUSJC1AXI4aHc0muVSoNPlb6TPBkrQWOsUniA3N3Elm_XpDYMPQT3BlbkFJCalrU0oEFkdvfc-ONLNmLpwJc6rEYVkgVDDJsOuiQvELnvxapwayjbOO4fHNc-XLgA'
})

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export function createAgent({
    systemPrompt,
    maxSteps = 5,
    tools,
    resultTool,
    context,
}: {
    tools: Record<string, { description: string, parameters: any, execute: any }>;
    resultTool?: { description: string, parameters: any };
    maxSteps?: number;
    systemPrompt: string;
    context?: string
}) {
    // TODO: CONVERT SYSTEM_API/INTEGRATION_API from framework to tool
    const toolsConverted = Object.entries(tools).reduce((memo, [key, val]) => {
        memo[key] = tool(val)
        return memo
    }, {})

    let answerTool = {}

    if (resultTool) {
        answerTool = { answer: tool(resultTool) }
    }


    return async ({ prompt }: { prompt: string }) => {

        // const messages = context ? [
        //     { role: 'system', content: context },
        // ] : [
        //     {
        //         role: 'user', content: prompt,
        //     }
        // ]


        // console.log(messages)

        return await generateText({
            model: openai('gpt-4o-2024-08-06', { structuredOutputs: true }),
            messages:  [
                {
                    role: 'user', content: prompt,
                }
            ],
            tools: {
                ...toolsConverted,
                // answer tool: the LLM will provide a structured answer
                ...answerTool,
                // no execute function - invoking it will terminate the agent
            },
            toolChoice: 'required',
            maxSteps: maxSteps,
            system: systemPrompt,
            onStepFinish: async (props) => {
                console.log(JSON.stringify(props, null, 2))
                if (props?.response?.headers?.['x-ratelimit-remaining-tokens'] && parseInt(props?.response?.headers?.['x-ratelimit-remaining-tokens'], 10) < 2000) {
                    console.log('Rate limit reached, waiting 10 seconds')
                    await delay(10 * 1000)
                }
            },
        });
    }
}