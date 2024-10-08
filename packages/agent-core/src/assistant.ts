
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: 'sk-svcacct-C8pLEG6H9ZKRMQlUSJC1AXI4aHc0muVSoNPlb6TPBkrQWOsUniA3N3Elm_XpDYMPQT3BlbkFJCalrU0oEFkdvfc-ONLNmLpwJc6rEYVkgVDDJsOuiQvELnvxapwayjbOO4fHNc-XLgA' })

export async function createAssistantAgent({
    name,
    instructions,
    model,
    tools,
}: {
    name: string
    tools: OpenAI.Beta.AssistantTool[]
    model: string
    instructions: string
}) {
    return await client.beta.assistants.create({
        name,
        model,
        instructions,
        tools,
    });
}

export async function getAssistantAgent({ id, toolMap }: { id: string, toolMap: Record<string, any> }) {
    const agent = await client.beta.assistants.retrieve(id);

    const handleRunStatus = async ({ threadId, run }: { run: OpenAI.Beta.Threads.Runs.Run, threadId: string }): Promise<any> => {
        // Check if the run is completed
        if (run.status === "completed") {
            let messages = await client.beta.threads.messages.list(threadId);
            return messages.data?.[0];
        } else if (run.status === "requires_action") {
            return await handleRequiresAction({ run, threadId });
        } else {
            console.error("Run did not complete:", run);
        }
    }

    const handleRequiresAction = async ({ threadId, run }: { threadId: string, run: OpenAI.Beta.Threads.Runs.Run }): Promise<any> => {
        console.log(JSON.stringify(run, null, 2), '### Handle requires action')
        // Check if there are tools that require outputs
        if (
            run.required_action &&
            run.required_action.submit_tool_outputs &&
            run.required_action.submit_tool_outputs.tool_calls
        ) {
            // Loop through each tool in the required action section
            const toolOutputs = await Promise.all(run.required_action.submit_tool_outputs.tool_calls.map(
                async (tool) => {
                    if (tool.function.name === "getSportsNews") {
                        const data = await toolMap.getSportsNews();

                        const output = data?.articles?.map((a: Record<string, string>) => {
                            return {
                                headline: a.headline,
                                description: a.description,
                            }
                        });

                        return {
                            tool_call_id: tool.id,
                            output: JSON.stringify(output),
                        };
                    }
                },
            ));

            if (!toolOutputs) {
                console.error("No tool outputs to submit.");
                return handleRunStatus({ threadId, run });
            }

            // Submit all tool outputs at once after collecting them in a list
            if (toolOutputs && toolOutputs?.length > 0) {
                run = await client.beta.threads.runs.submitToolOutputsAndPoll(
                    threadId,
                    run.id,
                    { tool_outputs: toolOutputs as any },
                );
                console.log("Tool outputs submitted successfully.");
            } else {
                console.log("No tool outputs to submit.");
            }

            // Check status after submitting tool outputs
            return handleRunStatus({ threadId, run });
        }
    };

    const getRun = async ({ threadId, runId }: { threadId: string, runId: string }) => {
        return await client.beta.threads.runs.retrieve(
            threadId,
            runId
        );
    }

    return {
        agent,

        initializeThread: async (messages: OpenAI.Beta.ThreadCreateParams.Message[] = []) => {
            return await client.beta.threads.create({
                messages,
            });
        },

        listMessages: async ({ threadId }: { threadId: string }) => {
            return await client.beta.threads.messages.list(
                threadId
            );
        },

        getRun,

        handleRunStatus,

        handleRequiresAction,

        createUserMessage: async ({ threadId, content }: { threadId: string, content: string }) => {
            return await client.beta.threads.messages.create(
                threadId,
                { role: "user", content }
            );
        },

        watchRun: async ({ runId, threadId }: { runId?: string, threadId: string }) => {
            let run
            if (runId) {
                run = await getRun({ threadId, runId });
            } else {
                run = await client.beta.threads.runs.createAndPoll(
                    threadId,
                    {
                        assistant_id: id,
                        tool_choice: 'required',
                    }
                );
            }

            return handleRunStatus({ threadId, run });
        }
    }
}

