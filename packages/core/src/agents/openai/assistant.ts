import OpenAI from 'openai';
import { createFileLogger } from '../file-logger';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createAssistantAgent({
  name,
  instructions,
  model,
  tools,
  response_format,
}: {
  name: string;
  tools: OpenAI.Beta.AssistantTool[];
  model: string;
  instructions: string;
  response_format?: OpenAI.Beta.Threads.AssistantResponseFormatOption;
}) {
  const assistant = await client.beta.assistants.create({
    name,
    model,
    instructions,
    tools,
    response_format,
  });

  const logger = createFileLogger({ destinationPath: `${assistant.id}.json` });

  logger({
    message: JSON.stringify(
      {
        message: 'Created assistant',
        metadata: {
          name,
          model,
          instructions,
          tools,
          timestamp: Date.now() / 1000,
        },
      },
      null,
      2
    ),
  });
}

export async function updateAssistantAgent({
  assistantId,
  name,
  instructions,
  model,
  tools,
  response_format,
}: {
  assistantId: string;
  name: string;
  tools: OpenAI.Beta.AssistantTool[];
  model: string;
  instructions: string;
  response_format?: OpenAI.Beta.Threads.AssistantResponseFormatOption;
}) {
  const assistant = await client.beta.assistants.update(assistantId, {
    name,
    model,
    instructions,
    tools,
    response_format,
  });

  const logger = createFileLogger({ destinationPath: `${assistant.id}.json` });

  logger({
    message: JSON.stringify(
      {
        message: 'Updated assistant',
        metadata: {
          name,
          model,
          instructions,
          tools,
          timestamp: Date.now() / 1000,
          response_format,
        },
      },
      null,
      2
    ),
  });
}

export async function getAssistantAgent({
  id,
  toolMap,
}: {
  id: string;
  toolMap: Record<string, any>;
}) {
  const logger = createFileLogger({ destinationPath: `${id}.json` });

  const agent = await client.beta.assistants.retrieve(id);

  const handleRunStatus = async ({
    threadId,
    run,
  }: {
    run: OpenAI.Beta.Threads.Runs.Run;
    threadId: string;
  }): Promise<any> => {
    // Check if the run is completed
    if (run.status === 'completed') {
      let messages = await client.beta.threads.messages.list(threadId);
      return messages.data?.[0];
    } else if (run.status === 'requires_action') {
      return await handleRequiresAction({ run, threadId });
    } else {
      console.error('Run did not complete:', run);
    }
  };

  const handleRequiresAction = async ({
    threadId,
    run,
  }: {
    threadId: string;
    run: OpenAI.Beta.Threads.Runs.Run;
  }): Promise<any> => {
    // Check if there are tools that require outputs
    if (
      run.required_action &&
      run.required_action.submit_tool_outputs &&
      run.required_action.submit_tool_outputs.tool_calls
    ) {
      // Loop through each tool in the required action section
      const toolOutputs = await Promise.all(
        run.required_action.submit_tool_outputs.tool_calls.map(async (tool) => {
          console.log(
            'Tool:',
            tool.function.name,
            tool.id,
            Object.keys(toolMap)
          );
          logger({
            message: JSON.stringify(
              {
                message: `Tool call: ${tool.function.name}`,
                metadata: {
                  tool: {
                    id: tool.id,
                    fn: tool.function.name,
                    availableTools: Object.keys(toolMap),
                  },
                  timestamp: Date.now() / 1000,
                },
              },
              null,
              2
            ),
          });

          const toolFn = toolMap?.[tool.function.name];

          if (!toolFn) {
            logger({
              message: JSON.stringify(
                {
                  message: `No tool fn found: ${tool.function.name}`,
                  metadata: {
                    tool: {
                      id: tool.id,
                      fn: tool.function.name,
                      availableTools: Object.keys(toolMap),

                      timestamp: Date.now() / 1000,
                    },
                  },
                },
                null,
                2
              ),
            });
            return;
          }

          console.log(
            'Executing tool:',
            tool.function.name,
            tool.id,
            tool.function.arguments
          );

          let args: Record<string, any> = {};
          try {
            if (tool.function.arguments) {
              args = JSON.parse(tool.function.arguments);

              logger({
                message: JSON.stringify(
                  {
                    message: `Tool call: ${tool.function.name} Args`,
                    metadata: {
                      args,
                      timestamp: Date.now() / 1000,
                    },
                  },
                  null,
                  2
                ),
              });
            }
          } catch (e) {
            console.error(e);
          }
          const output = await toolFn(args);

          logger({
            message: JSON.stringify(
              {
                message: `Tool call: ${tool.function.name} Output`,
                metadata: { output, timestamp: Date.now() / 1000 },
              },
              null,
              2
            ),
          });

          return {
            tool_call_id: tool.id,
            output: JSON.stringify(output),
          };
        })
      );

      if (!toolOutputs) {
        console.error('No tool outputs to submit.');

        logger({
          message: JSON.stringify(
            {
              message: `No tool outputs submitted`,
              metadata: {
                timestamp: Date.now() / 1000,
              },
            },
            null,
            2
          ),
        });

        return handleRunStatus({ threadId, run });
      }

      // Submit all tool outputs at once after collecting them in a list
      if (toolOutputs && toolOutputs?.length > 0) {
        run = await client.beta.threads.runs.submitToolOutputsAndPoll(
          threadId,
          run.id,
          {
            tool_outputs: toolOutputs as any,
          }
        );

        logger({
          message: JSON.stringify(
            {
              message: `Tool outputs submitted`,
              metadata: {
                run,

                timestamp: Date.now() / 1000,
              },
            },
            null,
            2
          ),
        });

        console.log('Tool outputs submitted successfully.');
      } else {
        logger({
          message: JSON.stringify(
            {
              message: `No tool outputs to submit`,
              metadata: {
                timestamp: Date.now() / 1000,
              },
            },
            null,
            2
          ),
        });
        console.log('No tool outputs to submit.');
      }

      // Check status after submitting tool outputs
      return handleRunStatus({ threadId, run });
    }
  };

  const getRun = async ({
    threadId,
    runId,
  }: {
    threadId: string;
    runId: string;
  }) => {
    return await client.beta.threads.runs.retrieve(threadId, runId);
  };

  return {
    agent,

    initializeThread: async (
      messages: OpenAI.Beta.ThreadCreateParams.Message[] = []
    ) => {
      return await client.beta.threads.create({
        messages,
      });
    },

    listMessages: async ({ threadId }: { threadId: string }) => {
      return await client.beta.threads.messages.list(threadId);
    },

    getRun,

    handleRunStatus,

    handleRequiresAction,

    createUserMessage: async ({
      threadId,
      content,
    }: {
      threadId: string;
      content: string;
    }) => {
      return await client.beta.threads.messages.create(threadId, {
        role: 'user',
        content,
      });
    },

    watchRun: async ({
      runId,
      threadId,
    }: {
      runId?: string;
      threadId: string;
    }) => {
      let run;
      if (runId) {
        run = await getRun({ threadId, runId });
      } else {
        run = await client.beta.threads.runs.createAndPoll(threadId, {
          assistant_id: id,
          tool_choice: 'required',
        });

        logger({
          message: JSON.stringify(
            {
              message: `Run ${runId} created, tool choice required`,
              metadata: {
                run,
                tool_choice: 'required',
                threadId,
                assistant_id: id,
                timestamp: Date.now() / 1000,
              },
            },
            null,
            2
          ),
        });
      }

      return handleRunStatus({ threadId, run });
    },
  };
}
