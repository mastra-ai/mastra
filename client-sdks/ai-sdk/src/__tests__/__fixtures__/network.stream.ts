export const networkStreamFixture = [
  {
    type: 'routing-agent-start',
    payload: {
      networkId: 'purchase-agent',
      agentId: 'routing-agent',
      runId: '127e29db-ddb9-4184-b203-fa55193c07f1',
      inputData: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        primitiveId: '',
        primitiveType: 'none',
        iteration: 0,
        threadResourceId: 'Purchase Agent',
        threadId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
        isOneOff: false,
        verboseIntrospection: true,
      },
    },
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
    from: 'NETWORK',
  },
  {
    type: 'routing-agent-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      result: '',
      primitiveId: 'inventoryAgent',
      primitiveType: 'agent',
      prompt: 'Check if there is any laptop in stock and provide details of available laptops if any.',
      isComplete: false,
      selectionReason:
        'The first step is to check inventory for any laptops in stock using the inventoryAgent. This is necessary before proceeding to purchase or create an invoice. The purchaseWorkflow and createInvoiceTool cannot be used before confirming stock availability.',
      iteration: 0,
      runId: '127e29db-ddb9-4184-b203-fa55193c07f1',
      usage: {
        inputTokens: 1095,
        outputTokens: 80,
        totalTokens: 1175,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-start',
    payload: {
      agentId: 'inventory-agent',
      args: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        result: '',
        primitiveId: 'inventoryAgent',
        primitiveType: 'agent',
        prompt: 'Check if there is any laptop in stock and provide details of available laptops if any.',
        isComplete: false,
        selectionReason:
          'The first step is to check inventory for any laptops in stock using the inventoryAgent. This is necessary before proceeding to purchase or create an invoice. The purchaseWorkflow and createInvoiceTool cannot be used before confirming stock availability.',
        iteration: 0,
        runId: '127e29db-ddb9-4184-b203-fa55193c07f1',
      },
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-start',
    payload: {
      type: 'start',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'inventory-agent',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-step-start',
    payload: {
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      type: 'step-start',
      payload: {
        request: {
          body: {
            model: 'gpt-4.1-mini',
            input: [
              {
                role: 'system',
                content: 'You are a inventory agent. You are responsible for searching the inventory for the item.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                  },
                ],
              },
            ],
            temperature: 0,
            tools: [
              {
                type: 'function',
                name: 'inventoryTool',
                description: 'Search the inventory for the item',
                parameters: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                    },
                    description: {
                      type: 'string',
                    },
                  },
                  required: ['name', 'description'],
                  additionalProperties: false,
                  $schema: 'http://json-schema.org/draft-07/schema#',
                },
                strict: false,
              },
            ],
            tool_choice: 'auto',
          },
        },
        warnings: [],
        messageId: 'cff25b28-0091-4786-a2b9-adaa20afb0a5',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-input-streaming-start',
    payload: {
      type: 'tool-call-input-streaming-start',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: '{"',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: 'name',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: '":"',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: 'l',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: 'aptop',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: '","',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: 'description',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: '":"',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: 'search',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: ' for',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: ' laptops',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: ' in',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: ' inventory',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-delta',
    payload: {
      type: 'tool-call-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        argsTextDelta: '"}',
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call-input-streaming-end',
    payload: {
      type: 'tool-call-input-streaming-end',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-call',
    payload: {
      type: 'tool-call',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
        args: {
          name: 'laptop',
          description: 'search for laptops in inventory',
        },
        providerMetadata: {
          openai: {
            itemId: 'fc_09bc42f0080957e5006925806bd6c08190a51578564593e705',
          },
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-data-inventory-search',
    payload: {
      type: 'data-inventory-search',
      data: {
        name: 'laptop',
        description: 'search for laptops in inventory',
      },
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-tool-result',
    payload: {
      type: 'tool-result',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        args: {
          name: 'laptop',
          description: 'search for laptops in inventory',
        },
        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
        toolName: 'inventoryTool',
        result: {
          inStock: true,
          quantity: 10,
        },
        providerMetadata: {
          openai: {
            itemId: 'fc_09bc42f0080957e5006925806bd6c08190a51578564593e705',
          },
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-step-finish',
    payload: {
      type: 'step-finish',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        messageId: 'cff25b28-0091-4786-a2b9-adaa20afb0a5',
        stepResult: {
          reason: 'tool-calls',
          isContinued: true,
        },
        metadata: {
          providerMetadata: {
            openai: {
              responseId: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
              serviceTier: 'default',
            },
          },
          id: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
          timestamp: '2025-11-25T10:09:47.000Z',
          modelId: 'gpt-4.1-mini-2025-04-14',
          headers: {
            'alt-svc': 'h3=":443"; ma=86400',
            'cf-cache-status': 'DYNAMIC',
            'cf-ray': '9a405a3e4cd25661-BRU',
            connection: 'keep-alive',
            'content-type': 'text/event-stream; charset=utf-8',
            date: 'Tue, 25 Nov 2025 10:09:47 GMT',
            'openai-organization': 'mastra-qb2kpb',
            'openai-processing-ms': '36',
            'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
            'openai-version': '2020-10-01',
            server: 'cloudflare',
            'set-cookie':
              '_cfuvid=Rh17MnuWGQPVL4u1Yza4q32dkc4Cw9dXX31aEw.GfzM-1764065387420-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
            'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
            'transfer-encoding': 'chunked',
            'x-content-type-options': 'nosniff',
            'x-envoy-upstream-service-time': '40',
            'x-request-id': 'req_853056aabff54496a337f8368ab34b07',
          },
          modelMetadata: {
            modelId: 'gpt-4.1-mini',
            modelVersion: 'v2',
            modelProvider: 'openai',
          },
          request: {
            body: {
              model: 'gpt-4.1-mini',
              input: [
                {
                  role: 'system',
                  content: 'You are a inventory agent. You are responsible for searching the inventory for the item.',
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                    },
                  ],
                },
              ],
              temperature: 0,
              tools: [
                {
                  type: 'function',
                  name: 'inventoryTool',
                  description: 'Search the inventory for the item',
                  parameters: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      description: {
                        type: 'string',
                      },
                    },
                    required: ['name', 'description'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                  },
                  strict: false,
                },
              ],
              tool_choice: 'auto',
            },
          },
        },
        output: {
          text: '',
          toolCalls: [
            {
              toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
              toolName: 'inventoryTool',
              args: {
                name: 'laptop',
                description: 'search for laptops in inventory',
              },
              providerMetadata: {
                openai: {
                  itemId: 'fc_09bc42f0080957e5006925806bd6c08190a51578564593e705',
                },
              },
            },
          ],
          usage: {
            inputTokens: 80,
            outputTokens: 24,
            totalTokens: 104,
            reasoningTokens: 0,
            cachedInputTokens: 0,
          },
          steps: [
            {
              content: [],
              usage: {
                inputTokens: 80,
                outputTokens: 24,
                totalTokens: 104,
                reasoningTokens: 0,
                cachedInputTokens: 0,
              },
              warnings: [],
              request: {
                body: {
                  model: 'gpt-4.1-mini',
                  input: [
                    {
                      role: 'system',
                      content:
                        'You are a inventory agent. You are responsible for searching the inventory for the item.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                        },
                      ],
                    },
                  ],
                  temperature: 0,
                  tools: [
                    {
                      type: 'function',
                      name: 'inventoryTool',
                      description: 'Search the inventory for the item',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          description: {
                            type: 'string',
                          },
                        },
                        required: ['name', 'description'],
                        additionalProperties: false,
                        $schema: 'http://json-schema.org/draft-07/schema#',
                      },
                      strict: false,
                    },
                  ],
                  tool_choice: 'auto',
                },
              },
              response: {
                id: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
                timestamp: '2025-11-25T10:09:47.000Z',
                modelId: 'gpt-4.1-mini-2025-04-14',
                headers: {
                  'alt-svc': 'h3=":443"; ma=86400',
                  'cf-cache-status': 'DYNAMIC',
                  'cf-ray': '9a405a3e4cd25661-BRU',
                  connection: 'keep-alive',
                  'content-type': 'text/event-stream; charset=utf-8',
                  date: 'Tue, 25 Nov 2025 10:09:47 GMT',
                  'openai-organization': 'mastra-qb2kpb',
                  'openai-processing-ms': '36',
                  'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
                  'openai-version': '2020-10-01',
                  server: 'cloudflare',
                  'set-cookie':
                    '_cfuvid=Rh17MnuWGQPVL4u1Yza4q32dkc4Cw9dXX31aEw.GfzM-1764065387420-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
                  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
                  'transfer-encoding': 'chunked',
                  'x-content-type-options': 'nosniff',
                  'x-envoy-upstream-service-time': '40',
                  'x-request-id': 'req_853056aabff54496a337f8368ab34b07',
                },
                messages: [
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        input: {
                          name: 'laptop',
                          description: 'search for laptops in inventory',
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    content: [],
                  },
                ],
              },
              providerMetadata: {
                openai: {
                  responseId: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
                  serviceTier: 'default',
                },
              },
            },
            {
              content: [],
              usage: {
                inputTokens: 119,
                outputTokens: 28,
                totalTokens: 147,
                reasoningTokens: 0,
                cachedInputTokens: 0,
              },
              warnings: [],
              request: {
                body: {
                  model: 'gpt-4.1-mini',
                  input: [
                    {
                      role: 'system',
                      content:
                        'You are a inventory agent. You are responsible for searching the inventory for the item.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                        },
                      ],
                    },
                    {
                      type: 'function_call',
                      call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                      name: 'inventoryTool',
                      arguments: '{"name":"laptop","description":"search for laptops in inventory"}',
                    },
                    {
                      type: 'function_call_output',
                      call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                      output: '{"inStock":true,"quantity":10}',
                    },
                  ],
                  temperature: 0,
                  tools: [
                    {
                      type: 'function',
                      name: 'inventoryTool',
                      description: 'Search the inventory for the item',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          description: {
                            type: 'string',
                          },
                        },
                        required: ['name', 'description'],
                        additionalProperties: false,
                        $schema: 'http://json-schema.org/draft-07/schema#',
                      },
                      strict: false,
                    },
                  ],
                  tool_choice: 'auto',
                },
              },
              response: {
                id: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
                timestamp: '2025-11-25T10:09:49.000Z',
                modelId: 'gpt-4.1-mini-2025-04-14',
                headers: {
                  'alt-svc': 'h3=":443"; ma=86400',
                  'cf-cache-status': 'DYNAMIC',
                  'cf-ray': '9a405a4c7f6c5661-BRU',
                  connection: 'keep-alive',
                  'content-type': 'text/event-stream; charset=utf-8',
                  date: 'Tue, 25 Nov 2025 10:09:49 GMT',
                  'openai-organization': 'mastra-qb2kpb',
                  'openai-processing-ms': '43',
                  'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
                  'openai-version': '2020-10-01',
                  server: 'cloudflare',
                  'set-cookie':
                    '_cfuvid=hPiOSYblEXuveyCreAl9yJZXYTIl3NlW5Wi0tfvBbBY-1764065389704-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
                  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
                  'transfer-encoding': 'chunked',
                  'x-content-type-options': 'nosniff',
                  'x-envoy-upstream-service-time': '48',
                  'x-request-id': 'req_5268ea3198114ac990464d7a2837b891',
                },
                messages: [
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        input: {
                          name: 'laptop',
                          description: 'search for laptops in inventory',
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    content: [
                      {
                        type: 'tool-result',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        output: {
                          type: 'json',
                          value: {
                            inStock: true,
                            quantity: 10,
                          },
                        },
                      },
                    ],
                  },
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'text',
                        text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                      },
                    ],
                  },
                ],
              },
              providerMetadata: {
                openai: {
                  responseId: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
                  serviceTier: 'default',
                },
              },
            },
          ],
        },
        messages: {
          all: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  input: {
                    name: 'laptop',
                    description: 'search for laptops in inventory',
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  output: {
                    type: 'json',
                    value: {
                      inStock: true,
                      quantity: 10,
                    },
                  },
                },
              ],
            },
          ],
          user: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                },
              ],
            },
          ],
          nonUser: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  input: {
                    name: 'laptop',
                    description: 'search for laptops in inventory',
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  output: {
                    type: 'json',
                    value: {
                      inStock: true,
                      quantity: 10,
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-step-start',
    payload: {
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      type: 'step-start',
      payload: {
        request: {
          body: {
            model: 'gpt-4.1-mini',
            input: [
              {
                role: 'system',
                content: 'You are a inventory agent. You are responsible for searching the inventory for the item.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                  },
                ],
              },
              {
                type: 'function_call',
                call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                name: 'inventoryTool',
                arguments: '{"name":"laptop","description":"search for laptops in inventory"}',
              },
              {
                type: 'function_call_output',
                call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                output: '{"inStock":true,"quantity":10}',
              },
            ],
            temperature: 0,
            tools: [
              {
                type: 'function',
                name: 'inventoryTool',
                description: 'Search the inventory for the item',
                parameters: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                    },
                    description: {
                      type: 'string',
                    },
                  },
                  required: ['name', 'description'],
                  additionalProperties: false,
                  $schema: 'http://json-schema.org/draft-07/schema#',
                },
                strict: false,
              },
            ],
            tool_choice: 'auto',
          },
        },
        warnings: [],
        messageId: 'cff25b28-0091-4786-a2b9-adaa20afb0a5',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-start',
    payload: {
      type: 'text-start',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        providerMetadata: {
          openai: {
            itemId: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
          },
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: 'There',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' are',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' ',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: '10',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' laptops',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' currently',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' in',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' stock',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: '.',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' Would',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' you',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' like',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' details',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' on',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' the',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' specifications',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ',',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' brands',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ',',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' or',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' prices',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' of',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' these',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' available',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: ' laptops',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-delta',
    payload: {
      type: 'text-delta',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
        text: '?',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-text-end',
    payload: {
      type: 'text-end',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        type: 'text-end',
        id: 'msg_0341bb2ed5f21981006925806dfe208197b82432226e46f2df',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-step-finish',
    payload: {
      type: 'step-finish',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        messageId: 'cff25b28-0091-4786-a2b9-adaa20afb0a5',
        stepResult: {
          reason: 'stop',
          isContinued: false,
        },
        metadata: {
          providerMetadata: {
            openai: {
              responseId: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
              serviceTier: 'default',
            },
          },
          id: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
          timestamp: '2025-11-25T10:09:49.000Z',
          modelId: 'gpt-4.1-mini-2025-04-14',
          headers: {
            'alt-svc': 'h3=":443"; ma=86400',
            'cf-cache-status': 'DYNAMIC',
            'cf-ray': '9a405a4c7f6c5661-BRU',
            connection: 'keep-alive',
            'content-type': 'text/event-stream; charset=utf-8',
            date: 'Tue, 25 Nov 2025 10:09:49 GMT',
            'openai-organization': 'mastra-qb2kpb',
            'openai-processing-ms': '43',
            'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
            'openai-version': '2020-10-01',
            server: 'cloudflare',
            'set-cookie':
              '_cfuvid=hPiOSYblEXuveyCreAl9yJZXYTIl3NlW5Wi0tfvBbBY-1764065389704-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
            'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
            'transfer-encoding': 'chunked',
            'x-content-type-options': 'nosniff',
            'x-envoy-upstream-service-time': '48',
            'x-request-id': 'req_5268ea3198114ac990464d7a2837b891',
          },
          modelMetadata: {
            modelId: 'gpt-4.1-mini',
            modelVersion: 'v2',
            modelProvider: 'openai',
          },
          request: {
            body: {
              model: 'gpt-4.1-mini',
              input: [
                {
                  role: 'system',
                  content: 'You are a inventory agent. You are responsible for searching the inventory for the item.',
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                    },
                  ],
                },
                {
                  type: 'function_call',
                  call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  name: 'inventoryTool',
                  arguments: '{"name":"laptop","description":"search for laptops in inventory"}',
                },
                {
                  type: 'function_call_output',
                  call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  output: '{"inStock":true,"quantity":10}',
                },
              ],
              temperature: 0,
              tools: [
                {
                  type: 'function',
                  name: 'inventoryTool',
                  description: 'Search the inventory for the item',
                  parameters: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      description: {
                        type: 'string',
                      },
                    },
                    required: ['name', 'description'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                  },
                  strict: false,
                },
              ],
              tool_choice: 'auto',
            },
          },
        },
        output: {
          text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
          toolCalls: [],
          usage: {
            inputTokens: 199,
            outputTokens: 52,
            totalTokens: 251,
            reasoningTokens: 0,
            cachedInputTokens: 0,
          },
          steps: [
            {
              content: [],
              usage: {
                inputTokens: 80,
                outputTokens: 24,
                totalTokens: 104,
                reasoningTokens: 0,
                cachedInputTokens: 0,
              },
              warnings: [],
              request: {
                body: {
                  model: 'gpt-4.1-mini',
                  input: [
                    {
                      role: 'system',
                      content:
                        'You are a inventory agent. You are responsible for searching the inventory for the item.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                        },
                      ],
                    },
                  ],
                  temperature: 0,
                  tools: [
                    {
                      type: 'function',
                      name: 'inventoryTool',
                      description: 'Search the inventory for the item',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          description: {
                            type: 'string',
                          },
                        },
                        required: ['name', 'description'],
                        additionalProperties: false,
                        $schema: 'http://json-schema.org/draft-07/schema#',
                      },
                      strict: false,
                    },
                  ],
                  tool_choice: 'auto',
                },
              },
              response: {
                id: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
                timestamp: '2025-11-25T10:09:47.000Z',
                modelId: 'gpt-4.1-mini-2025-04-14',
                headers: {
                  'alt-svc': 'h3=":443"; ma=86400',
                  'cf-cache-status': 'DYNAMIC',
                  'cf-ray': '9a405a3e4cd25661-BRU',
                  connection: 'keep-alive',
                  'content-type': 'text/event-stream; charset=utf-8',
                  date: 'Tue, 25 Nov 2025 10:09:47 GMT',
                  'openai-organization': 'mastra-qb2kpb',
                  'openai-processing-ms': '36',
                  'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
                  'openai-version': '2020-10-01',
                  server: 'cloudflare',
                  'set-cookie':
                    '_cfuvid=Rh17MnuWGQPVL4u1Yza4q32dkc4Cw9dXX31aEw.GfzM-1764065387420-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
                  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
                  'transfer-encoding': 'chunked',
                  'x-content-type-options': 'nosniff',
                  'x-envoy-upstream-service-time': '40',
                  'x-request-id': 'req_853056aabff54496a337f8368ab34b07',
                },
                messages: [
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        input: {
                          name: 'laptop',
                          description: 'search for laptops in inventory',
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    content: [],
                  },
                ],
              },
              providerMetadata: {
                openai: {
                  responseId: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
                  serviceTier: 'default',
                },
              },
            },
            {
              content: [],
              usage: {
                inputTokens: 119,
                outputTokens: 28,
                totalTokens: 147,
                reasoningTokens: 0,
                cachedInputTokens: 0,
              },
              warnings: [],
              request: {
                body: {
                  model: 'gpt-4.1-mini',
                  input: [
                    {
                      role: 'system',
                      content:
                        'You are a inventory agent. You are responsible for searching the inventory for the item.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                        },
                      ],
                    },
                    {
                      type: 'function_call',
                      call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                      name: 'inventoryTool',
                      arguments: '{"name":"laptop","description":"search for laptops in inventory"}',
                    },
                    {
                      type: 'function_call_output',
                      call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                      output: '{"inStock":true,"quantity":10}',
                    },
                  ],
                  temperature: 0,
                  tools: [
                    {
                      type: 'function',
                      name: 'inventoryTool',
                      description: 'Search the inventory for the item',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          description: {
                            type: 'string',
                          },
                        },
                        required: ['name', 'description'],
                        additionalProperties: false,
                        $schema: 'http://json-schema.org/draft-07/schema#',
                      },
                      strict: false,
                    },
                  ],
                  tool_choice: 'auto',
                },
              },
              response: {
                id: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
                timestamp: '2025-11-25T10:09:49.000Z',
                modelId: 'gpt-4.1-mini-2025-04-14',
                headers: {
                  'alt-svc': 'h3=":443"; ma=86400',
                  'cf-cache-status': 'DYNAMIC',
                  'cf-ray': '9a405a4c7f6c5661-BRU',
                  connection: 'keep-alive',
                  'content-type': 'text/event-stream; charset=utf-8',
                  date: 'Tue, 25 Nov 2025 10:09:49 GMT',
                  'openai-organization': 'mastra-qb2kpb',
                  'openai-processing-ms': '43',
                  'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
                  'openai-version': '2020-10-01',
                  server: 'cloudflare',
                  'set-cookie':
                    '_cfuvid=hPiOSYblEXuveyCreAl9yJZXYTIl3NlW5Wi0tfvBbBY-1764065389704-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
                  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
                  'transfer-encoding': 'chunked',
                  'x-content-type-options': 'nosniff',
                  'x-envoy-upstream-service-time': '48',
                  'x-request-id': 'req_5268ea3198114ac990464d7a2837b891',
                },
                messages: [
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        input: {
                          name: 'laptop',
                          description: 'search for laptops in inventory',
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    content: [
                      {
                        type: 'tool-result',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        output: {
                          type: 'json',
                          value: {
                            inStock: true,
                            quantity: 10,
                          },
                        },
                      },
                    ],
                  },
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'text',
                        text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                      },
                    ],
                  },
                ],
              },
              providerMetadata: {
                openai: {
                  responseId: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
                  serviceTier: 'default',
                },
              },
            },
          ],
        },
        messages: {
          all: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  input: {
                    name: 'laptop',
                    description: 'search for laptops in inventory',
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  output: {
                    type: 'json',
                    value: {
                      inStock: true,
                      quantity: 10,
                    },
                  },
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                },
              ],
            },
          ],
          user: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                },
              ],
            },
          ],
          nonUser: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  input: {
                    name: 'laptop',
                    description: 'search for laptops in inventory',
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  output: {
                    type: 'json',
                    value: {
                      inStock: true,
                      quantity: 10,
                    },
                  },
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                },
              ],
            },
          ],
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-event-finish',
    payload: {
      type: 'finish',
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      from: 'AGENT',
      payload: {
        messageId: 'cff25b28-0091-4786-a2b9-adaa20afb0a5',
        stepResult: {
          reason: 'stop',
          isContinued: false,
        },
        metadata: {
          providerMetadata: {
            openai: {
              responseId: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
              serviceTier: 'default',
            },
          },
          id: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
          timestamp: '2025-11-25T10:09:49.000Z',
          modelId: 'gpt-4.1-mini-2025-04-14',
          headers: {
            'alt-svc': 'h3=":443"; ma=86400',
            'cf-cache-status': 'DYNAMIC',
            'cf-ray': '9a405a4c7f6c5661-BRU',
            connection: 'keep-alive',
            'content-type': 'text/event-stream; charset=utf-8',
            date: 'Tue, 25 Nov 2025 10:09:49 GMT',
            'openai-organization': 'mastra-qb2kpb',
            'openai-processing-ms': '43',
            'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
            'openai-version': '2020-10-01',
            server: 'cloudflare',
            'set-cookie':
              '_cfuvid=hPiOSYblEXuveyCreAl9yJZXYTIl3NlW5Wi0tfvBbBY-1764065389704-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
            'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
            'transfer-encoding': 'chunked',
            'x-content-type-options': 'nosniff',
            'x-envoy-upstream-service-time': '48',
            'x-request-id': 'req_5268ea3198114ac990464d7a2837b891',
          },
          modelMetadata: {
            modelId: 'gpt-4.1-mini',
            modelVersion: 'v2',
            modelProvider: 'openai',
          },
          request: {
            body: {
              model: 'gpt-4.1-mini',
              input: [
                {
                  role: 'system',
                  content: 'You are a inventory agent. You are responsible for searching the inventory for the item.',
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                    },
                  ],
                },
                {
                  type: 'function_call',
                  call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  name: 'inventoryTool',
                  arguments: '{"name":"laptop","description":"search for laptops in inventory"}',
                },
                {
                  type: 'function_call_output',
                  call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  output: '{"inStock":true,"quantity":10}',
                },
              ],
              temperature: 0,
              tools: [
                {
                  type: 'function',
                  name: 'inventoryTool',
                  description: 'Search the inventory for the item',
                  parameters: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      description: {
                        type: 'string',
                      },
                    },
                    required: ['name', 'description'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                  },
                  strict: false,
                },
              ],
              tool_choice: 'auto',
            },
          },
        },
        output: {
          text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
          toolCalls: [],
          usage: {
            inputTokens: 199,
            outputTokens: 52,
            totalTokens: 251,
            reasoningTokens: 0,
            cachedInputTokens: 0,
          },
          steps: [
            {
              content: [],
              usage: {
                inputTokens: 80,
                outputTokens: 24,
                totalTokens: 104,
                reasoningTokens: 0,
                cachedInputTokens: 0,
              },
              warnings: [],
              request: {
                body: {
                  model: 'gpt-4.1-mini',
                  input: [
                    {
                      role: 'system',
                      content:
                        'You are a inventory agent. You are responsible for searching the inventory for the item.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                        },
                      ],
                    },
                  ],
                  temperature: 0,
                  tools: [
                    {
                      type: 'function',
                      name: 'inventoryTool',
                      description: 'Search the inventory for the item',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          description: {
                            type: 'string',
                          },
                        },
                        required: ['name', 'description'],
                        additionalProperties: false,
                        $schema: 'http://json-schema.org/draft-07/schema#',
                      },
                      strict: false,
                    },
                  ],
                  tool_choice: 'auto',
                },
              },
              response: {
                id: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
                timestamp: '2025-11-25T10:09:47.000Z',
                modelId: 'gpt-4.1-mini-2025-04-14',
                headers: {
                  'alt-svc': 'h3=":443"; ma=86400',
                  'cf-cache-status': 'DYNAMIC',
                  'cf-ray': '9a405a3e4cd25661-BRU',
                  connection: 'keep-alive',
                  'content-type': 'text/event-stream; charset=utf-8',
                  date: 'Tue, 25 Nov 2025 10:09:47 GMT',
                  'openai-organization': 'mastra-qb2kpb',
                  'openai-processing-ms': '36',
                  'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
                  'openai-version': '2020-10-01',
                  server: 'cloudflare',
                  'set-cookie':
                    '_cfuvid=Rh17MnuWGQPVL4u1Yza4q32dkc4Cw9dXX31aEw.GfzM-1764065387420-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
                  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
                  'transfer-encoding': 'chunked',
                  'x-content-type-options': 'nosniff',
                  'x-envoy-upstream-service-time': '40',
                  'x-request-id': 'req_853056aabff54496a337f8368ab34b07',
                },
                messages: [
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        input: {
                          name: 'laptop',
                          description: 'search for laptops in inventory',
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    content: [],
                  },
                ],
              },
              providerMetadata: {
                openai: {
                  responseId: 'resp_09bc42f0080957e5006925806b54b8819093a815c290466c05',
                  serviceTier: 'default',
                },
              },
            },
            {
              content: [],
              usage: {
                inputTokens: 119,
                outputTokens: 28,
                totalTokens: 147,
                reasoningTokens: 0,
                cachedInputTokens: 0,
              },
              warnings: [],
              request: {
                body: {
                  model: 'gpt-4.1-mini',
                  input: [
                    {
                      role: 'system',
                      content:
                        'You are a inventory agent. You are responsible for searching the inventory for the item.',
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                        },
                      ],
                    },
                    {
                      type: 'function_call',
                      call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                      name: 'inventoryTool',
                      arguments: '{"name":"laptop","description":"search for laptops in inventory"}',
                    },
                    {
                      type: 'function_call_output',
                      call_id: 'call_vicDAfjqUhIAo5yJntWKClnq',
                      output: '{"inStock":true,"quantity":10}',
                    },
                  ],
                  temperature: 0,
                  tools: [
                    {
                      type: 'function',
                      name: 'inventoryTool',
                      description: 'Search the inventory for the item',
                      parameters: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          description: {
                            type: 'string',
                          },
                        },
                        required: ['name', 'description'],
                        additionalProperties: false,
                        $schema: 'http://json-schema.org/draft-07/schema#',
                      },
                      strict: false,
                    },
                  ],
                  tool_choice: 'auto',
                },
              },
              response: {
                id: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
                timestamp: '2025-11-25T10:09:49.000Z',
                modelId: 'gpt-4.1-mini-2025-04-14',
                headers: {
                  'alt-svc': 'h3=":443"; ma=86400',
                  'cf-cache-status': 'DYNAMIC',
                  'cf-ray': '9a405a4c7f6c5661-BRU',
                  connection: 'keep-alive',
                  'content-type': 'text/event-stream; charset=utf-8',
                  date: 'Tue, 25 Nov 2025 10:09:49 GMT',
                  'openai-organization': 'mastra-qb2kpb',
                  'openai-processing-ms': '43',
                  'openai-project': 'proj_Cvw1JiXoxHTeEWgnnK3t9AYG',
                  'openai-version': '2020-10-01',
                  server: 'cloudflare',
                  'set-cookie':
                    '_cfuvid=hPiOSYblEXuveyCreAl9yJZXYTIl3NlW5Wi0tfvBbBY-1764065389704-0.0.1.1-604800000; path=/; domain=.api.openai.com; HttpOnly; Secure; SameSite=None',
                  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
                  'transfer-encoding': 'chunked',
                  'x-content-type-options': 'nosniff',
                  'x-envoy-upstream-service-time': '48',
                  'x-request-id': 'req_5268ea3198114ac990464d7a2837b891',
                },
                messages: [
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'tool-call',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        input: {
                          name: 'laptop',
                          description: 'search for laptops in inventory',
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    content: [
                      {
                        type: 'tool-result',
                        toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                        toolName: 'inventoryTool',
                        output: {
                          type: 'json',
                          value: {
                            inStock: true,
                            quantity: 10,
                          },
                        },
                      },
                    ],
                  },
                  {
                    role: 'assistant',
                    content: [
                      {
                        type: 'text',
                        text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                      },
                    ],
                  },
                ],
              },
              providerMetadata: {
                openai: {
                  responseId: 'resp_0341bb2ed5f21981006925806d9d9c8197985597c8f2d2d79b',
                  serviceTier: 'default',
                },
              },
            },
          ],
        },
        messages: {
          all: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  input: {
                    name: 'laptop',
                    description: 'search for laptops in inventory',
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  output: {
                    type: 'json',
                    value: {
                      inStock: true,
                      quantity: 10,
                    },
                  },
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                },
              ],
            },
          ],
          user: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Check if there is any laptop in stock and provide details of available laptops if any.',
                },
              ],
            },
          ],
          nonUser: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  input: {
                    name: 'laptop',
                    description: 'search for laptops in inventory',
                  },
                },
              ],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call_vicDAfjqUhIAo5yJntWKClnq',
                  toolName: 'inventoryTool',
                  output: {
                    type: 'json',
                    value: {
                      inStock: true,
                      quantity: 10,
                    },
                  },
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
                },
              ],
            },
          ],
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'agent-execution-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      agentId: 'inventory-agent',
      result:
        'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
      isComplete: false,
      iteration: 0,
      runId: 'e36706b4-3f2e-4655-9b05-e38bbce14894',
      usage: {
        inputTokens: 199,
        outputTokens: 52,
        totalTokens: 251,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-start',
    payload: {
      networkId: 'purchase-agent',
      agentId: 'routing-agent',
      runId: 'db385cba-7ed9-4ea5-9bd1-5cc2b414007f',
      inputData: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        isComplete: false,
        result:
          'There are 10 laptops currently in stock. Would you like details on the specifications, brands, or prices of these available laptops?',
        primitiveId: 'inventoryAgent',
        primitiveType: 'agent',
        iteration: 1,
        isOneOff: false,
        threadId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
        threadResourceId: 'Purchase Agent',
      },
    },
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
    from: 'NETWORK',
  },
  {
    type: 'routing-agent-text-start',
    payload: {
      runId: 'db385cba-7ed9-4ea5-9bd1-5cc2b414007f',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      result: '',
      primitiveId: 'purchaseWorkflow',
      primitiveType: 'workflow',
      prompt: '{"name":"laptop","quantity":1}',
      isComplete: false,
      selectionReason:
        'The laptops are in stock, so the next step is to purchase one laptop using the purchaseWorkflow. After successful purchase, the invoice will be created as per the workflow instructions.',
      iteration: 1,
      runId: 'db385cba-7ed9-4ea5-9bd1-5cc2b414007f',
      usage: {
        inputTokens: 1727,
        outputTokens: 65,
        totalTokens: 1792,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-start',
    payload: {
      workflowId: 'purchase-workflow-step',
      args: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        result: '',
        primitiveId: 'purchaseWorkflow',
        primitiveType: 'workflow',
        prompt: '{"name":"laptop","quantity":1}',
        isComplete: false,
        selectionReason:
          'The laptops are in stock, so the next step is to purchase one laptop using the purchaseWorkflow. After successful purchase, the invoice will be created as per the workflow instructions.',
        iteration: 1,
        runId: 'db385cba-7ed9-4ea5-9bd1-5cc2b414007f',
      },
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-event-workflow-start',
    payload: {
      type: 'workflow-start',
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
      from: 'WORKFLOW',
      payload: {
        workflowId: 'purchase-workflow-step',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-event-workflow-step-start',
    payload: {
      type: 'workflow-step-start',
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
      from: 'WORKFLOW',
      payload: {
        stepName: 'purchase-step',
        id: 'purchase-step',
        stepCallId: 'ac650cd2-660f-40af-b889-4c103f1c7e1c',
        payload: {
          name: 'laptop',
          quantity: 1,
        },
        startedAt: 1764065396602,
        status: 'running',
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-event-data-purchase',
    payload: {
      type: 'data-purchase',
      id: 'purchase-44e0b559-168c-4c71-b472-7f16fd26fcbd',
      data: {
        name: 'laptop',
      },
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-event-workflow-step-result',
    payload: {
      type: 'workflow-step-result',
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
      from: 'WORKFLOW',
      payload: {
        stepName: 'purchase-step',
        id: 'purchase-step',
        stepCallId: 'ac650cd2-660f-40af-b889-4c103f1c7e1c',
        status: 'success',
        output: {
          success: true,
        },
        endedAt: 1764065396605,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-event-workflow-finish',
    payload: {
      type: 'workflow-finish',
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
      from: 'WORKFLOW',
      payload: {
        workflowStatus: 'success',
        metadata: {},
        output: {
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
          },
        },
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'workflow-execution-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      primitiveId: 'purchaseWorkflow',
      primitiveType: 'workflow',
      result: {
        status: 'success',
        steps: {
          input: {
            name: 'laptop',
            quantity: 1,
          },
          'purchase-step': {
            payload: {
              name: 'laptop',
              quantity: 1,
            },
            startedAt: 1764065396602,
            status: 'success',
            output: {
              success: true,
            },
            endedAt: 1764065396605,
          },
        },
        input: {
          name: 'laptop',
          quantity: 1,
        },
        result: {
          success: true,
        },
      },
      isComplete: false,
      iteration: 1,
      name: 'purchase-workflow-step',
      runId: 'b41d42ee-f006-4725-baa0-547d5fadb1d0',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-start',
    payload: {
      networkId: 'purchase-agent',
      agentId: 'routing-agent',
      runId: '6341c803-16ef-43b2-a103-1839b345dd71',
      inputData: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        isComplete: false,
        result:
          '{"isNetwork":true,"primitiveType":"workflow","primitiveId":"purchaseWorkflow","selectionReason":"The inventoryAgent confirmed laptops are in stock, so the next step is to purchase one laptop using the purchaseWorkflow. This aligns with the workflow instructions to purchase after confirming stock.","input":{"name":"laptop","quantity":1},"finalResult":{"runId":"44e0b559-168c-4c71-b472-7f16fd26fcbd","runResult":{"status":"success","steps":{"input":{"name":"laptop","quantity":1},"purchase-step":{"payload":{"name":"laptop","quantity":1},"startedAt":1764065408319,"status":"success","output":{"success":true},"endedAt":1764065408319}},"input":{"name":"laptop","quantity":1},"result":{"success":true}},"chunks":[{"type":"workflow-start","runId":"44e0b559-168c-4c71-b472-7f16fd26fcbd","from":"WORKFLOW","payload":{"workflowId":"purchase-workflow-step"}},{"type":"workflow-step-start","runId":"44e0b559-168c-4c71-b472-7f16fd26fcbd","from":"WORKFLOW","payload":{"stepName":"purchase-step","id":"purchase-step","stepCallId":"5a6ecd5a-e0ef-4aa1-90f0-52e729e632e9","payload":{"name":"laptop","quantity":1},"startedAt":1764065408319,"status":"running"}},{"type":"data-purchase","id":"purchase-44e0b559-168c-4c71-b472-7f16fd26fcbd","data":{"name":"laptop"}},{"type":"workflow-step-result","runId":"44e0b559-168c-4c71-b472-7f16fd26fcbd","from":"WORKFLOW","payload":{"stepName":"purchase-step","id":"purchase-step","stepCallId":"5a6ecd5a-e0ef-4aa1-90f0-52e729e632e9","status":"success","output":{"success":true},"endedAt":1764065408319}},{"type":"workflow-finish","runId":"44e0b559-168c-4c71-b472-7f16fd26fcbd","from":"WORKFLOW","payload":{"workflowStatus":"success","metadata":{},"output":{"usage":{"inputTokens":0,"outputTokens":0,"totalTokens":0,"cachedInputTokens":0,"reasoningTokens":0}}}}],"runSuccess":true}}',
        primitiveId: 'purchaseWorkflow',
        primitiveType: 'workflow',
        iteration: 3,
        isOneOff: false,
        threadId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
        threadResourceId: 'Purchase Agent',
      },
    },
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
    from: 'NETWORK',
  },
  {
    type: 'routing-agent-text-start',
    payload: {
      runId: '6341c803-16ef-43b2-a103-1839b345dd71',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      result: '',
      primitiveId: 'createInvoiceTool',
      primitiveType: 'tool',
      prompt: '{"name":"laptop","quantity":1}',
      isComplete: false,
      selectionReason:
        'The laptop purchase was successful, so the next step according to the system instructions is to create an invoice for the purchase using the createInvoiceTool.',
      iteration: 3,
      runId: '6341c803-16ef-43b2-a103-1839b345dd71',
      usage: {
        inputTokens: 2848,
        outputTokens: 60,
        totalTokens: 2908,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'tool-execution-start',
    payload: {
      args: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        result: '',
        primitiveId: 'createInvoiceTool',
        primitiveType: 'tool',
        prompt: '{"name":"laptop","quantity":1}',
        isComplete: false,
        selectionReason:
          'The laptop purchase was successful, so the next step according to the system instructions is to create an invoice for the purchase using the createInvoiceTool.',
        iteration: 3,
        runId: '6341c803-16ef-43b2-a103-1839b345dd71',
        args: {
          name: 'laptop',
          quantity: 1,
        },
        toolName: 'create-invoice',
        toolCallId: 'e51d529e-54b1-4f60-b4c3-1dceaad45109',
      },
      runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'tool-execution-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      primitiveId: 'create-invoice',
      primitiveType: 'tool',
      result: {
        success: true,
      },
      isComplete: false,
      iteration: 3,
      toolCallId: 'e51d529e-54b1-4f60-b4c3-1dceaad45109',
      toolName: 'create-invoice',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-start',
    payload: {
      networkId: 'purchase-agent',
      agentId: 'routing-agent',
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      inputData: {
        task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
        isComplete: false,
        result: {
          success: true,
        },
        primitiveId: 'createInvoiceTool',
        primitiveType: 'tool',
        iteration: 4,
        isOneOff: false,
        threadId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
        threadResourceId: 'Purchase Agent',
      },
    },
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
    from: 'NETWORK',
  },
  {
    type: 'routing-agent-text-start',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: 'The',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' laptop',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' was',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' successfully',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' found',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' in',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' stock',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ',',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' purchased',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ',',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' and',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' an',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' invoice',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' was',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' created',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' as',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' requested',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: '.',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' Your',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' purchase',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' of',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' one',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' laptop',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' is',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' complete',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ',',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' and',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' the',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' invoice',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' has',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' been',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: ' generated',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-text-delta',
    payload: {
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      text: '.',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'routing-agent-end',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      primitiveId: '',
      primitiveType: 'none',
      prompt: '',
      result:
        'The laptop was successfully found in stock, purchased, and an invoice was created as requested. Your purchase of one laptop is complete, and the invoice has been generated.',
      isComplete: true,
      selectionReason:
        'The system instructions specify that after a successful purchase, an invoice must be created immediately. Since the purchase was successful and the invoice creation tool returned success, the task is complete.',
      iteration: 4,
      runId: 'a26bfb66-8e2a-418c-9a3d-5d83473137c1',
      usage: {
        inputTokens: 2670,
        outputTokens: 82,
        totalTokens: 2752,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'network-execution-event-step-finish',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      result:
        'The laptop was successfully found in stock, purchased, and an invoice was created as requested. Your purchase of one laptop is complete, and the invoice has been generated.',
      isComplete: true,
      iteration: 4,
      runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
  {
    type: 'network-execution-event-finish',
    payload: {
      task: 'I want to purchase a laptop, any you have in stock suffices. I would like an invoice with my purchase.',
      isComplete: true,
      result:
        'The laptop was successfully found in stock, purchased, and an invoice was created as requested. Your purchase of one laptop is complete, and the invoice has been generated.',
      primitiveId: '',
      primitiveType: 'none',
      iteration: 4,
      isOneOff: false,
      threadId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
      threadResourceId: 'Purchase Agent',
      usage: {
        inputTokens: 10792,
        outputTokens: 404,
        totalTokens: 11196,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
    },
    from: 'NETWORK',
    runId: '44e0b559-168c-4c71-b472-7f16fd26fcbd',
  },
];
