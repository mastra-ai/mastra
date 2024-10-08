import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, tool } from 'ai';

const openai = createOpenAI({
    apiKey: 'sk-svcacct-C8pLEG6H9ZKRMQlUSJC1AXI4aHc0muVSoNPlb6TPBkrQWOsUniA3N3Elm_XpDYMPQT3BlbkFJCalrU0oEFkdvfc-ONLNmLpwJc6rEYVkgVDDJsOuiQvELnvxapwayjbOO4fHNc-XLgA'
})

const anthropic = createAnthropic({
    apiKey: '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'
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function createAgent({
    systemPrompt,
    maxSteps = 5,
    tools,
    resultTool,
    toolChoice = 'required',
    context,
    model,
}: {
    model: { type: string, name?: string }
    toolChoice?: any
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
    }, {} as Record<string, any>)

    let answerTool = {}

    if (resultTool) {
        answerTool = { answer: tool(resultTool) }
    }

    let modelDef: any
    
    if (model.type === 'openai') {
        let mName = model.name
        if (!mName) {
            mName = `gpt-4o-2024-08-06`
        }
        modelDef = openai(mName, { structuredOutputs: true })
    } else if (model.type === 'anthropic') {
        let mName = model.name
        if (!mName) {
            mName = `claude-3-5-sonnet-20240620`
        }
        modelDef = anthropic(mName)
    }

    return async ({ prompt }: { prompt: string }) => {
        return await generateText({
            model: modelDef,
            messages:  [
                {
                    role: 'user', content: prompt,
                },
                {
                    role: 'system', content: systemPrompt,
                },
            ],
            tools: {
                ...toolsConverted,
                // answer tool: the LLM will provide a structured answer
                ...answerTool,
                // no execute function - invoking it will terminate the agent
            },
            toolChoice,
            maxSteps: maxSteps,
            // system: systemPrompt,
            onStepFinish: async (props: any) => {
                console.log(JSON.stringify(props, null, 2))
                if (props?.response?.headers?.['x-ratelimit-remaining-tokens'] && parseInt(props?.response?.headers?.['x-ratelimit-remaining-tokens'], 10) < 2000) {
                    console.log('Rate limit reached, waiting 10 seconds')
                    await delay(10 * 1000)
                }
            },
        });
    }
}

export * from './assistant'