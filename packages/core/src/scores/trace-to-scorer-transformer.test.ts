// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  buildSpanTree,
  transformTraceToScorerInput,
  transformTraceToScorerOutput,
  type Span,
  type Trace,
} from './transformer';

// Test data based on transformer.ts real example
const sampleTrace = {
  traceId: '601067e4ed9e530222de09d08b72bde3',
  spans: [
    {
      traceId: '601067e4ed9e530222de09d08b72bde3',
      spanId: '9eaedd6eb7ff0cc8',
      parentSpanId: '0662b9d2479806ff',
      name: "llm: 'gpt-4o'",
      scope: null,
      spanType: 'llm_generation',
      attributes: {
        model: 'gpt-4o',
        provider: 'openai.chat',
        parameters: {},
        streaming: false,
        finishReason: 'stop',
        usage: {
          promptTokens: 49,
          completionTokens: 296,
          totalTokens: 345,
        },
      },
      metadata: {
        runId: '56ddc556-a089-40b9-a56c-6b91d23f0a13',
      },
      links: null,
      input: {
        messages: [
          {
            role: 'system',
            content:
              '\n    You are a agent that harasses you. You are a jerk. You are a meanie. You are a bully. You are a asshole.\n    ',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Plan weather activities for Seattle',
              },
            ],
          },
        ],
      },
      output: {
        text: "Seattle is known for its rainy weather, but that doesn't mean you can't have a great time! Here are some activities you can enjoy, rain or shine:\n\n1. **Visit the Museum of Pop Culture (MoPOP):** Dive into the world of music, science fiction, and pop culture in this uniquely designed museum.\n\n2. **Explore Pike Place Market:** Rain or shine, this iconic market is bustling with activity. Enjoy fresh produce, seafood, and local crafts.\n\n3. **Seattle Art Museum (SAM):** Spend a day exploring the diverse art collections and exhibitions.\n\n4. **Chihuly Garden and Glass:** Marvel at the stunning glass sculptures by Dale Chihuly, both indoors and in the garden.\n\n5. **Seattle Aquarium:** Discover marine life native to the Pacific Northwest.\n\n6. **Take a Coffee Tour:** Seattle is famous for its coffee culture. Visit local coffee shops and roasters for a warm cup of joe.\n\n7. **Indoor Rock Climbing:** Check out one of Seattle's indoor climbing gyms for some active fun.\n\n8. **Catch a Show:** Enjoy live music, theater, or comedy at one of Seattle's many venues.\n\n9. **Visit the Pacific Science Center:** Engage with interactive exhibits and watch a movie in the IMAX theater.\n\n10. **Relax in a Cozy Café:** Find a cozy spot to read a book or people-watch while enjoying a hot beverage.\n\nRemember to bring a raincoat or umbrella, just in case!",
        reasoning: [],
        files: [],
        sources: [],
        warnings: [],
      },
      error: null,
      startedAt: '2025-09-17T19:32:52.321Z',
      endedAt: '2025-09-17T19:33:02.650Z',
      createdAt: '2025-09-17T19:32:57.313Z',
      updatedAt: '2025-09-17T19:33:07.653Z',
      isEvent: 0,
    },
    {
      traceId: '601067e4ed9e530222de09d08b72bde3',
      spanId: '0662b9d2479806ff',
      parentSpanId: 'd81d1e2acd9f38da',
      name: "agent run: 'Agent That Harasses You'",
      scope: null,
      spanType: 'agent_run',
      attributes: {
        agentId: 'Agent That Harasses You',
        instructions:
          '\n    You are a agent that harasses you. You are a jerk. You are a meanie. You are a bully. You are a asshole.\n    ',
        availableTools: [],
      },
      metadata: {
        runId: '56ddc556-a089-40b9-a56c-6b91d23f0a13',
      },
      links: null,
      input: {
        messages: 'Plan weather activities for Seattle',
      },
      output: {
        text: "Seattle is known for its rainy weather, but that doesn't mean you can't have a great time! Here are some activities you can enjoy, rain or shine:\n\n1. **Visit the Museum of Pop Culture (MoPOP):** Dive into the world of music, science fiction, and pop culture in this uniquely designed museum.\n\n2. **Explore Pike Place Market:** Rain or shine, this iconic market is bustling with activity. Enjoy fresh produce, seafood, and local crafts.\n\n3. **Seattle Art Museum (SAM):** Spend a day exploring the diverse art collections and exhibitions.\n\n4. **Chihuly Garden and Glass:** Marvel at the stunning glass sculptures by Dale Chihuly, both indoors and in the garden.\n\n5. **Seattle Aquarium:** Discover marine life native to the Pacific Northwest.\n\n6. **Take a Coffee Tour:** Seattle is famous for its coffee culture. Visit local coffee shops and roasters for a warm cup of joe.\n\n7. **Indoor Rock Climbing:** Check out one of Seattle's indoor climbing gyms for some active fun.\n\n8. **Catch a Show:** Enjoy live music, theater, or comedy at one of Seattle's many venues.\n\n9. **Visit the Pacific Science Center:** Engage with interactive exhibits and watch a movie in the IMAX theater.\n\n10. **Relax in a Cozy Café:** Find a cozy spot to read a book or people-watch while enjoying a hot beverage.\n\nRemember to bring a raincoat or umbrella, just in case!",
        files: [],
      },
      error: null,
      startedAt: '2025-09-17T19:32:52.317Z',
      endedAt: '2025-09-17T19:33:02.653Z',
      createdAt: '2025-09-17T19:32:57.313Z',
      updatedAt: '2025-09-17T19:33:07.653Z',
      isEvent: 0,
    },
    {
      traceId: '601067e4ed9e530222de09d08b72bde3',
      spanId: 'd81d1e2acd9f38da',
      parentSpanId: '8530645411446563',
      name: "tool: 'weatherPlanningTool'",
      scope: null,
      spanType: 'tool_call',
      attributes: {
        toolId: 'weatherPlanningTool',
        toolDescription: 'Plan weather activities',
        toolType: 'tool',
      },
      metadata: null,
      links: null,
      input: {
        city: 'Seattle',
        weather: 'sunny',
      },
      output: {
        activities:
          "Seattle is known for its rainy weather, but that doesn't mean you can't have a great time! Here are some activities you can enjoy, rain or shine:\n\n1. **Visit the Museum of Pop Culture (MoPOP):** Dive into the world of music, science fiction, and pop culture in this uniquely designed museum.\n\n2. **Explore Pike Place Market:** Rain or shine, this iconic market is bustling with activity. Enjoy fresh produce, seafood, and local crafts.\n\n3. **Seattle Art Museum (SAM):** Spend a day exploring the diverse art collections and exhibitions.\n\n4. **Chihuly Garden and Glass:** Marvel at the stunning glass sculptures by Dale Chihuly, both indoors and in the garden.\n\n5. **Seattle Aquarium:** Discover marine life native to the Pacific Northwest.\n\n6. **Take a Coffee Tour:** Seattle is famous for its coffee culture. Visit local coffee shops and roasters for a warm cup of joe.\n\n7. **Indoor Rock Climbing:** Check out one of Seattle's indoor climbing gyms for some active fun.\n\n8. **Catch a Show:** Enjoy live music, theater, or comedy at one of Seattle's many venues.\n\n9. **Visit the Pacific Science Center:** Engage with interactive exhibits and watch a movie in the IMAX theater.\n\n10. **Relax in a Cozy Café:** Find a cozy spot to read a book or people-watch while enjoying a hot beverage.\n\nRemember to bring a raincoat or umbrella, just in case!",
      },
      error: null,
      startedAt: '2025-09-17T19:32:52.310Z',
      endedAt: '2025-09-17T19:33:02.654Z',
      createdAt: '2025-09-17T19:32:57.313Z',
      updatedAt: '2025-09-17T19:33:07.653Z',
      isEvent: 0,
    },
    {
      traceId: '601067e4ed9e530222de09d08b72bde3',
      spanId: 'b72a3867871b89de',
      parentSpanId: '8530645411446563',
      name: "tool: 'weatherInfo'",
      scope: null,
      spanType: 'tool_call',
      attributes: {
        toolId: 'weatherInfo',
        toolDescription: 'Fetches the current weather information for a given city',
        toolType: 'tool',
      },
      metadata: null,
      links: null,
      input: {
        city: 'Seattle',
      },
      output: {
        city: 'Seattle',
        weather: 'sunny',
        temperature_celsius: 19,
        temperature_fahrenheit: 66,
        humidity: 50,
        wind: '10 mph',
      },
      error: null,
      startedAt: '2025-09-17T19:32:50.165Z',
      endedAt: '2025-09-17T19:32:50.166Z',
      createdAt: '2025-09-17T19:32:51.381Z',
      updatedAt: '2025-09-17T19:32:51.384Z',
      isEvent: 0,
    },
    {
      traceId: '601067e4ed9e530222de09d08b72bde3',
      spanId: '4148bbf369faecd5',
      parentSpanId: '8530645411446563',
      name: "llm: 'gpt-4o-mini'",
      scope: null,
      spanType: 'llm_generation',
      attributes: {
        model: 'gpt-4o-mini',
        provider: 'openai.responses',
        streaming: true,
        parameters: {
          temperature: 0,
        },
        finishReason: 'stop',
        usage: {
          promptTokens: 1036,
          completionTokens: 280,
          totalTokens: 1316,
        },
      },
      metadata: {
        runId: 'chefModelV2Agent',
        threadId: 'dfc182aa-155d-4be3-b77d-e3665bcc105c',
        resourceId: 'chefModelV2Agent',
      },
      links: null,
      input: {
        messages: [
          {
            role: 'system',
            content:
              '\n  when you are asked to cook a meal, you must use the tool cooking-tool\n  when you are asked to get weather information, you must use the tool weather-info then use the tool weather-planning-tool to plan the activities\n      ',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'sup',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Hey there! How can I assist you today?',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: "what's the weather in seattle and what activites can i do",
              },
            ],
          },
        ],
      },
      output: {
        text: "The weather in Seattle is currently sunny, with a temperature of 66°F (19°C) and a light wind at 10 mph. Here are some activities you can enjoy:\n\n1. **Visit the Museum of Pop Culture (MoPOP)**: Dive into music, science fiction, and pop culture.\n2. **Explore Pike Place Market**: Enjoy fresh produce, seafood, and local crafts.\n3. **Seattle Art Museum (SAM)**: Discover diverse art collections and exhibitions.\n4. **Chihuly Garden and Glass**: Marvel at stunning glass sculptures by Dale Chihuly.\n5. **Seattle Aquarium**: Learn about marine life native to the Pacific Northwest.\n6. **Take a Coffee Tour**: Experience Seattle's famous coffee culture.\n7. **Indoor Rock Climbing**: Try out one of Seattle's indoor climbing gyms.\n8. **Catch a Show**: Enjoy live music, theater, or comedy at local venues.\n9. **Visit the Pacific Science Center**: Engage with interactive exhibits and watch an IMAX movie.\n10. **Relax in a Cozy Café**: Find a spot to read or people-watch while enjoying a hot beverage.\n\nEnjoy your day in Seattle!",
        reasoning: [],
        files: [],
        sources: [],
        warnings: [],
      },
      error: null,
      startedAt: '2025-09-17T19:32:46.387Z',
      endedAt: '2025-09-17T19:33:08.577Z',
      createdAt: '2025-09-17T19:32:51.381Z',
      updatedAt: '2025-09-17T19:33:13.580Z',
      isEvent: 0,
    },
    {
      traceId: '601067e4ed9e530222de09d08b72bde3',
      spanId: '8530645411446563',
      parentSpanId: null,
      name: "agent run: 'Chef Agent V2 Model'",
      scope: null,
      spanType: 'agent_run',
      attributes: {
        agentId: 'Chef Agent V2 Model',
        instructions:
          '\n  when you are asked to cook a meal, you must use the tool cooking-tool\n  when you are asked to get weather information, you must use the tool weather-info then use the tool weather-planning-tool to plan the activities\n      ',
      },
      metadata: {
        runId: 'chefModelV2Agent',
        resourceId: 'chefModelV2Agent',
        threadId: 'dfc182aa-155d-4be3-b77d-e3665bcc105c',
      },
      links: null,
      input: [
        {
          role: 'user',
          content: "what's the weather in seattle and what activites can i do",
        },
      ],
      output: {
        text: "The weather in Seattle is currently sunny, with a temperature of 66°F (19°C) and a light wind at 10 mph. Here are some activities you can enjoy:\n\n1. **Visit the Museum of Pop Culture (MoPOP)**: Dive into music, science fiction, and pop culture.\n2. **Explore Pike Place Market**: Enjoy fresh produce, seafood, and local crafts.\n3. **Seattle Art Museum (SAM)**: Discover diverse art collections and exhibitions.\n4. **Chihuly Garden and Glass**: Marvel at stunning glass sculptures by Dale Chihuly.\n5. **Seattle Aquarium**: Learn about marine life native to the Pacific Northwest.\n6. **Take a Coffee Tour**: Experience Seattle's famous coffee culture.\n7. **Indoor Rock Climbing**: Try out one of Seattle's indoor climbing gyms.\n8. **Catch a Show**: Enjoy live music, theater, or comedy at local venues.\n9. **Visit the Pacific Science Center**: Engage with interactive exhibits and watch an IMAX movie.\n10. **Relax in a Cozy Café**: Find a spot to read or people-watch while enjoying a hot beverage.\n\nEnjoy your day in Seattle!",
        files: [],
      },
      error: null,
      startedAt: '2025-09-17T19:32:46.371Z',
      endedAt: '2025-09-17T19:33:08.577Z',
      createdAt: '2025-09-17T19:32:51.381Z',
      updatedAt: '2025-09-17T19:33:13.580Z',
      isEvent: 0,
    },
  ],
};

const expectedScorerInput = {
  inputMessages: [
    {
      id: 'synthetic-input-1', // We'll generate synthetic IDs since trace doesn't have them
      role: 'user',
      content: "what's the weather in seattle and what activites can i do",
      createdAt: '2025-09-17T19:32:46.371Z', // From root agent span startedAt
      parts: [
        {
          type: 'text',
          text: "what's the weather in seattle and what activites can i do",
        },
      ],
      experimental_attachments: [],
    },
  ],
  rememberedMessages: [
    // Note: The trace shows conversation history in LLM span, but we can't distinguish
    // which are "remembered" vs current input, so we'll extract all non-current messages
    {
      id: 'synthetic-memory-1',
      role: 'user',
      content: 'sup',
      createdAt: '2025-09-17T19:32:46.387Z', // From LLM span startedAt (best we have)
      parts: [
        {
          type: 'text',
          text: 'sup',
        },
      ],
      experimental_attachments: [],
    },
    {
      id: 'synthetic-memory-2',
      role: 'assistant',
      content: 'Hey there! How can I assist you today?',
      createdAt: '2025-09-17T19:32:46.387Z',
      parts: [
        {
          type: 'text',
          text: 'Hey there! How can I assist you today?',
        },
      ],
    },
  ],
  systemMessages: [
    {
      role: 'system',
      content:
        '\n  when you are asked to cook a meal, you must use the tool cooking-tool\n  when you are asked to get weather information, you must use the tool weather-info then use the tool weather-planning-tool to plan the activities\n      ',
    },
  ],
  taggedSystemMessages: {}, // Keep empty - trace doesn't have tagged system messages
};

const expectedScorerOutput = [
  {
    id: 'synthetic-response-1', // Generate synthetic ID
    role: 'assistant',
    content:
      "The weather in Seattle is currently sunny, with a temperature of 66°F (19°C) and a light wind at 10 mph. Here are some activities you can enjoy:\n\n1. **Visit the Museum of Pop Culture (MoPOP)**: Dive into music, science fiction, and pop culture.\n2. **Explore Pike Place Market**: Enjoy fresh produce, seafood, and local crafts.\n3. **Seattle Art Museum (SAM)**: Discover diverse art collections and exhibitions.\n4. **Chihuly Garden and Glass**: Marvel at stunning glass sculptures by Dale Chihuly.\n5. **Seattle Aquarium**: Learn about marine life native to the Pacific Northwest.\n6. **Take a Coffee Tour**: Experience Seattle's famous coffee culture.\n7. **Indoor Rock Climbing**: Try out one of Seattle's indoor climbing gyms.\n8. **Catch a Show**: Enjoy live music, theater, or comedy at local venues.\n9. **Visit the Pacific Science Center**: Engage with interactive exhibits and watch an IMAX movie.\n10. **Relax in a Cozy Café**: Find a spot to read or people-watch while enjoying a hot beverage.\n\nEnjoy your day in Seattle!",
    createdAt: '2025-09-17T19:33:08.577Z', // From root agent span endedAt
    parts: [
      // Tool invocations reconstructed from tool_call spans, ordered by startedAt
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'synthetic-call-1', // Generate synthetic call IDs
          toolName: 'weatherInfo', // From tool span attributes.toolId
          args: {
            city: 'Seattle', // From tool span input
          },
          result: {
            city: 'Seattle',
            weather: 'sunny',
            temperature_celsius: 19,
            temperature_fahrenheit: 66,
            humidity: 50,
            wind: '10 mph', // From tool span output
          },
        },
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'synthetic-call-2',
          toolName: 'weatherPlanningTool',
          args: {
            city: 'Seattle',
            weather: 'sunny',
          },
          result: {
            activities:
              "Seattle is known for its rainy weather, but that doesn't mean you can't have a great time! Here are some activities you can enjoy, rain or shine:\n\n1. **Visit the Museum of Pop Culture (MoPOP):** Dive into the world of music, science fiction, and pop culture in this uniquely designed museum.\n\n2. **Explore Pike Place Market:** Rain or shine, this iconic market is bustling with activity. Enjoy fresh produce, seafood, and local crafts.\n\n3. **Seattle Art Museum (SAM):** Spend a day exploring the diverse art collections and exhibitions.\n\n4. **Chihuly Garden and Glass:** Marvel at the stunning glass sculptures by Dale Chihuly, both indoors and in the garden.\n\n5. **Seattle Aquarium:** Discover marine life native to the Pacific Northwest.\n\n6. **Take a Coffee Tour:** Seattle is famous for its coffee culture. Visit local coffee shops and roasters for a warm cup of joe.\n\n7. **Indoor Rock Climbing:** Check out one of Seattle's indoor climbing gyms for some active fun.\n\n8. **Catch a Show:** Enjoy live music, theater, or comedy at one of Seattle's many venues.\n\n9. **Visit the Pacific Science Center:** Engage with interactive exhibits and watch a movie in the IMAX theater.\n\n10. **Relax in a Cozy Café:** Find a cozy spot to read a book or people-watch while enjoying a hot beverage.\n\nRemember to bring a raincoat or umbrella, just in case!",
          },
        },
      },
      // Note: Omitting step-start for now - can be added later if needed
      {
        type: 'text',
        text: "The weather in Seattle is currently sunny, with a temperature of 66°F (19°C) and a light wind at 10 mph. Here are some activities you can enjoy:\n\n1. **Visit the Museum of Pop Culture (MoPOP)**: Dive into music, science fiction, and pop culture.\n2. **Explore Pike Place Market**: Enjoy fresh produce, seafood, and local crafts.\n3. **Seattle Art Museum (SAM)**: Discover diverse art collections and exhibitions.\n4. **Chihuly Garden and Glass**: Marvel at stunning glass sculptures by Dale Chihuly.\n5. **Seattle Aquarium**: Learn about marine life native to the Pacific Northwest.\n6. **Take a Coffee Tour**: Experience Seattle's famous coffee culture.\n7. **Indoor Rock Climbing**: Try out one of Seattle's indoor climbing gyms.\n8. **Catch a Show**: Enjoy live music, theater, or comedy at local venues.\n9. **Visit the Pacific Science Center**: Engage with interactive exhibits and watch an IMAX movie.\n10. **Relax in a Cozy Café**: Find a spot to read or people-watch while enjoying a hot beverage.\n\nEnjoy your day in Seattle!", // From LLM span output.text
      },
    ],
    toolInvocations: [
      // Duplicate the tool invocations at the top level (AI SDK v4 format requirement)
      {
        state: 'result',
        toolCallId: 'synthetic-call-1',
        toolName: 'weatherInfo',
        args: {
          city: 'Seattle',
        },
        result: {
          city: 'Seattle',
          weather: 'sunny',
          temperature_celsius: 19,
          temperature_fahrenheit: 66,
          humidity: 50,
          wind: '10 mph',
        },
      },
      {
        state: 'result',
        toolCallId: 'synthetic-call-2',
        toolName: 'weatherPlanningTool',
        args: {
          city: 'Seattle',
          weather: 'sunny',
        },
        result: {
          activities:
            "Seattle is known for its rainy weather, but that doesn't mean you can't have a great time! Here are some activities you can enjoy, rain or shine:\n\n1. **Visit the Museum of Pop Culture (MoPOP):** Dive into the world of music, science fiction, and pop culture in this uniquely designed museum.\n\n2. **Explore Pike Place Market:** Rain or shine, this iconic market is bustling with activity. Enjoy fresh produce, seafood, and local crafts.\n\n3. **Seattle Art Museum (SAM):** Spend a day exploring the diverse art collections and exhibitions.\n\n4. **Chihuly Garden and Glass:** Marvel at the stunning glass sculptures by Dale Chihuly, both indoors and in the garden.\n\n5. **Seattle Aquarium:** Discover marine life native to the Pacific Northwest.\n\n6. **Take a Coffee Tour:** Seattle is famous for its coffee culture. Visit local coffee shops and roasters for a warm cup of joe.\n\n7. **Indoor Rock Climbing:** Check out one of Seattle's indoor climbing gyms for some active fun.\n\n8. **Catch a Show:** Enjoy live music, theater, or comedy at one of Seattle's many venues.\n\n9. **Visit the Pacific Science Center:** Engage with interactive exhibits and watch a movie in the IMAX theater.\n\n10. **Relax in a Cozy Café:** Find a cozy spot to read a book or people-watch while enjoying a hot beverage.\n\nRemember to bring a raincoat or umbrella, just in case!",
        },
      },
    ],
  },
];

describe('buildSpanTree', () => {
  it('should build correct span tree from sample trace', () => {
    const spanTree = buildSpanTree(sampleTrace.spans as Span[]);

    // Check span map contains all spans
    expect(spanTree.spanMap.size).toBe(6);
    expect(spanTree.spanMap.has('9eaedd6eb7ff0cc8')).toBe(true); // LLM span
    expect(spanTree.spanMap.has('0662b9d2479806ff')).toBe(true); // Agent span
    expect(spanTree.spanMap.has('d81d1e2acd9f38da')).toBe(true); // Tool span
    expect(spanTree.spanMap.has('b72a3867871b89de')).toBe(true); // Tool span
    expect(spanTree.spanMap.has('4148bbf369faecd5')).toBe(true); // LLM span
    expect(spanTree.spanMap.has('8530645411446563')).toBe(true); // Root agent span

    // Check root span (should be exactly one with parentSpanId: null)
    expect(spanTree.rootSpans).toHaveLength(1);
    expect(spanTree.rootSpans[0].spanId).toBe('8530645411446563');
    expect(spanTree.rootSpans[0].name).toBe("agent run: 'Chef Agent V2 Model'");
    expect(spanTree.rootSpans[0].parentSpanId).toBe(null);

    // Check children of root span
    const rootChildren = spanTree.childrenMap.get('8530645411446563');
    expect(rootChildren).toHaveLength(3);

    // Should include LLM span and 2 tool spans, sorted by startedAt
    const childIds = rootChildren?.map(child => child.spanId);
    expect(childIds).toContain('4148bbf369faecd5'); // LLM span
    expect(childIds).toContain('b72a3867871b89de'); // weatherInfo tool
    expect(childIds).toContain('d81d1e2acd9f38da'); // weatherPlanningTool

    // Check children are sorted by startedAt timestamp
    const sortedByTime = rootChildren?.map(child => new Date(child.startedAt).getTime());
    expect(sortedByTime).toEqual([...sortedByTime!].sort((a, b) => a - b));
  });

  it('should handle nested agent spans', () => {
    const spanTree = buildSpanTree(sampleTrace.spans as Span[]);

    // Check nested agent span (0662b9d2479806ff) under another agent (d81d1e2acd9f38da)
    const nestedAgentChildren = spanTree.childrenMap.get('d81d1e2acd9f38da');
    expect(nestedAgentChildren).toHaveLength(1);
    expect(nestedAgentChildren?.[0].spanId).toBe('0662b9d2479806ff');
    expect(nestedAgentChildren?.[0].spanType).toBe('agent_run');

    // Check the LLM span under the nested agent
    const llmChildren = spanTree.childrenMap.get('0662b9d2479806ff');
    expect(llmChildren).toHaveLength(1);
    expect(llmChildren?.[0].spanId).toBe('9eaedd6eb7ff0cc8');
    expect(llmChildren?.[0].spanType).toBe('llm_generation');
  });
});

describe('Trace to Scorer Transformer', () => {
  it.only('should transform trace to complete scorer input and output', () => {
    // Test scorer input transformation
    const scorerInput = transformTraceToScorerInput(sampleTrace as Trace);
    console.log(`scorerInput`, JSON.stringify(scorerInput, null, 2));

    // Validate input messages
    expect(scorerInput.inputMessages).toHaveLength(1);
    expect(scorerInput.inputMessages[0].content).toBe("what's the weather in seattle and what activites can i do");
    expect(scorerInput.inputMessages[0].role).toBe('user');
    expect(scorerInput.inputMessages[0].id).toMatch(/^input-/);

    // Validate system messages
    expect(scorerInput.systemMessages).toHaveLength(1);
    expect(scorerInput.systemMessages[0].content).toContain('when you are asked to cook a meal');
    expect(scorerInput.systemMessages[0].role).toBe('system');

    // Validate remembered messages (conversation history)
    expect(scorerInput.rememberedMessages).toHaveLength(2);
    expect(scorerInput.rememberedMessages[0].content).toBe('sup');
    expect(scorerInput.rememberedMessages[0].role).toBe('user');
    expect(scorerInput.rememberedMessages[1].content).toBe('Hey there! How can I assist you today?');
    expect(scorerInput.rememberedMessages[1].role).toBe('assistant');

    // Validate tagged system messages (should be empty)
    expect(scorerInput.taggedSystemMessages).toEqual({});

    // Test scorer output transformation
    const scorerOutput = transformTraceToScorerOutput(sampleTrace as Trace);

    console.log(`scorerOutput`, JSON.stringify(scorerOutput, null, 2));

    // Should return array with one assistant message
    expect(scorerOutput).toHaveLength(1);
    const assistantMessage = scorerOutput[0];

    // Validate basic message properties
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.content).toContain('The weather in Seattle is currently sunny');
    expect(assistantMessage.id).toMatch(/^response-/);

    // Validate tool invocation parts
    const toolParts = assistantMessage.parts?.filter(p => p.type === 'tool-invocation');
    expect(toolParts).toHaveLength(2);

    // Check weatherInfo tool
    const weatherInfoPart = toolParts?.find(p => p.toolInvocation?.toolName === 'weatherInfo');
    const weatherInfoTool = weatherInfoPart?.toolInvocation;
    expect(weatherInfoTool).toBeDefined();
    expect(weatherInfoTool?.state).toBe('result');
    expect(weatherInfoTool?.toolCallId).toMatch(/^call-/);
    expect(weatherInfoTool?.args).toEqual({ city: 'Seattle' });
    expect(weatherInfoTool?.result).toEqual({
      city: 'Seattle',
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    });

    // Check weatherPlanningTool
    const planningPart = toolParts?.find(p => p.toolInvocation?.toolName === 'weatherPlanningTool');
    const planningTool = planningPart?.toolInvocation;
    expect(planningTool).toBeDefined();
    expect(planningTool?.state).toBe('result');
    expect(planningTool?.args).toEqual({ city: 'Seattle', weather: 'sunny' });
    expect(planningTool?.result.activities).toContain('Seattle is known for its rainy weather');

    // Validate message parts
    expect(assistantMessage.parts).toHaveLength(3); // 2 tool invocations + 1 text

    const textPart = assistantMessage.parts?.find(p => p.type === 'text');
    expect(textPart?.text).toContain('The weather in Seattle is currently sunny');
  });
});

// Legacy test cases
describe('Legacy Tests', () => {
  it('should extract input messages from root agent span', () => {
    // TODO: Implement transformTraceToScorerInput function
    // const result = transformTraceToScorerInput(sampleTrace);
    // expect(result.inputMessages).toHaveLength(1);
    // expect(result.inputMessages[0].content).toBe("what's the weather in seattle and what activites can i do");
  });

  it('should extract system messages from LLM span', () => {
    // TODO: Test system message extraction
  });

  it('should separate remembered messages from current input', () => {
    // TODO: Test memory vs input message separation logic
  });

  it('should build span tree correctly', () => {
    // TODO: Test span hierarchy parsing
  });

  it('should reconstruct tool invocations from tool spans', () => {
    // TODO: Test tool invocation reconstruction
  });

  it('should generate scorer output with tool invocations', () => {
    // TODO: Test complete transformation to scorer output format
  });

  // Edge cases
  it('should handle traces with no tool calls', () => {
    // TODO: Test simple text-only conversations
  });

  it('should handle missing LLM spans', () => {
    // TODO: Test error handling for malformed traces
  });

  it('should handle parallel tool calls correctly', () => {
    // TODO: Test tool calls that overlap in time
  });
});

// Additional test data for edge cases
const simpleTraceNoTools = {
  traceId: 'simple-trace',
  spans: [
    {
      spanId: 'root-1',
      parentSpanId: null,
      name: "agent run: 'Simple Agent'",
      spanType: 'agent_run',
      input: [{ role: 'user', content: 'Hello' }],
      startedAt: '2025-09-17T19:32:46.371Z',
    },
    {
      spanId: 'llm-1',
      parentSpanId: 'root-1',
      name: "llm: 'gpt-4'",
      spanType: 'llm_generation',
      input: {
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
      },
      output: {
        text: 'Hello! How can I help you today?',
      },
      startedAt: '2025-09-17T19:32:46.387Z',
    },
  ],
};

export { sampleTrace, expectedScorerInput, expectedScorerOutput, simpleTraceNoTools };
