'use client';
import { v4 as uuid } from '@lukeed/uuid';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { useState, ReactNode, useEffect, useRef } from 'react';

import { ChatProps } from '@/types';
import { useMastraClient } from '@/contexts/mastra-client-context';
import { useVNextNetworkChat } from '@/services/vnext-network-chat-provider';
import { useMessages } from './vnext-message-provider';
import { formatJSON } from '@/lib/formatting';

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  return message;
};

type VNextMastraNetworkRuntimeProviderProps = Omit<ChatProps, 'agentId' | 'agentName' | 'modelSettings'> & {
  networkId: string;
};

export function VNextMastraNetworkRuntimeProvider({
  children,
  networkId,
  memory,
  threadId,
  refreshThreadList,
  initialMessages,
}: Readonly<{
  children: ReactNode;
}> &
  VNextMastraNetworkRuntimeProviderProps) {
  const runIdRef = useRef<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const { messages, setMessages, appendToLastMessage } = useMessages();
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);

  const { handleStep, state, setState } = useVNextNetworkChat();
  const id = runIdRef.current;
  const currentState = id ? state[id] : undefined;

  useEffect(() => {
    if (!currentState) return;
    const hasFinished = Boolean(currentState?.steps?.['finish']);
    if (!hasFinished) return;

    const workflowStep = currentState?.steps?.['workflow-step'];
    if (!workflowStep) return;

    const workflowStepResult = workflowStep?.['step-result'];
    if (!workflowStepResult) return;

    const workflowStepResultOutput = workflowStepResult?.output;
    if (!workflowStepResultOutput) return;

    const run = async () => {
      const parsedResult = JSON.parse(workflowStepResult?.output?.result ?? '{}') ?? {};
      const runResult = parsedResult?.runResult ?? {};
      const formatted = await formatJSON(JSON.stringify(runResult));

      setMessages(msgs => [
        ...msgs,
        { role: 'assistant', content: [{ type: 'text', text: `\`\`\`json\n${formatted}\`\`\`` }] },
      ]);
    };

    run();
  }, [currentState]);

  useEffect(() => {
    const hasNewInitialMessages = initialMessages && initialMessages?.length > messages?.length;
    if (
      messages.length === 0 ||
      currentThreadId !== threadId ||
      (hasNewInitialMessages && currentThreadId === threadId)
    ) {
      const run = async (result: string, messageId: string) => {
        const formatted = await formatJSON(result);

        const finalResponse = `\`\`\`json\n${formatted}\`\`\``;

        setMessages(currentConversation => {
          return currentConversation.map(message => {
            if (message.metadata?.custom?.id === messageId) {
              return { ...message, content: [{ type: 'text', text: finalResponse }] };
            }
            return message;
          });
        });
      };

      if (initialMessages && threadId && memory) {
        for (const message of initialMessages) {
          if (message.role === 'user') {
            setMessages(currentConversation => [...currentConversation, message]);
          }
          if (message.role === 'assistant') {
            const id = uuid();
            const formattedMessageId = uuid();
            const parts = message.parts;
            const routingStep = parts?.[2];
            const responseStep = parts?.[3];
            const routingDecision = JSON.parse(routingStep?.text ?? '{}');

            const resourceStepId = routingDecision?.resourceType === 'agent' ? 'agent-step' : 'workflow-step';

            let finalResponse = responseStep?.text ?? '';
            let runId = '';

            let runResult = {};

            if (resourceStepId === 'workflow-step') {
              const parsedResult = JSON.parse(responseStep?.text ?? '{}') ?? {};
              runResult = parsedResult?.runResult ?? {};
              runId = parsedResult?.runId ?? '';
            }

            setState(currentState => {
              return {
                ...currentState,
                [id]: {
                  executionSteps: ['start', 'routing-step', resourceStepId, 'finish'],
                  runId,
                  steps: {
                    start: {},
                    'routing-step': {
                      'step-result': {
                        output: routingDecision,
                        status: 'success',
                      },
                    },
                    [resourceStepId]: {
                      'step-result': {
                        output: {
                          resourceId: routingDecision?.resourceId,
                        },
                        status: 'success',
                      },
                    },
                    finish: {},
                  },
                },
              };
            });

            setMessages(currentConversation => {
              return [
                ...currentConversation,
                {
                  role: 'assistant',
                  metadata: {
                    custom: {
                      id,
                    },
                  },
                  content: [
                    {
                      type: 'text',
                      text: 'start',
                    },
                  ],
                },
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: resourceStepId === 'workflow-step' ? '' : finalResponse }],
                  metadata: {
                    custom: {
                      id: formattedMessageId,
                    },
                  },
                },
              ];
            });

            if (resourceStepId === 'workflow-step') {
              run(JSON.stringify(runResult), formattedMessageId);
            }
          }
        }
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory, messages]);

  const mastra = useMastraClient();

  const network = mastra.getVNextNetwork(networkId);

  const onNew = async (message: AppendMessage) => {
    runIdRef.current = undefined;

    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);
    setIsRunning(true);

    try {
      await network.stream(
        {
          message: input,
          threadId,
          resourceId: networkId,
        },
        record => {
          if (runIdRef.current) {
            if ((record as any).type === 'tool-call-delta') {
              appendToLastMessage((record as any).argsTextDelta);
            } else if ((record as any).type === 'tool-call-streaming-start') {
              setMessages(msgs => [...msgs, { role: 'assistant', content: [{ type: 'text', text: '' }] }]);
              setTimeout(() => {
                refreshThreadList?.();
              }, 500);
              return;
            } else {
              handleStep(runIdRef.current, record);
            }
          } else if ((record as any).type === 'start') {
            const id = uuid();
            runIdRef.current = id;

            setMessages(currentConversation => {
              return [
                ...currentConversation,
                {
                  role: 'assistant',
                  metadata: {
                    custom: {
                      id,
                    },
                  },
                  content: [
                    {
                      type: 'text',
                      text: 'start',
                    },
                  ],
                },
              ];
            });
          }

          setTimeout(() => {
            refreshThreadList?.();
          }, 500);
        },
      );

      setIsRunning(false);
    } catch (error) {
      console.error('Error occurred in VNextMastraNetworkRuntimeProvider', error);
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
