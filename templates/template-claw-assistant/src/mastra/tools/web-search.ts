import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const trimTrailingSlash = (value: string) => (value.endsWith('/') ? value.slice(0, -1) : value);

const getGatewayUrl = () => trimTrailingSlash(process.env.MASTRA_GATEWAY_URL ?? 'https://gateway-api.mastra.ai');

const getGatewayChatCompletionsUrl = () => {
  const gatewayUrl = getGatewayUrl();

  if (gatewayUrl.endsWith('/v1')) {
    return `${gatewayUrl}/chat/completions`;
  }

  return `${gatewayUrl}/v1/chat/completions`;
};

const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

type GatewayAnnotation = {
  type?: string;
  url_citation?: {
    title?: string;
    url?: string;
  };
};

type GatewayResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      annotations?: GatewayAnnotation[];
    };
  }>;
};

const parseContent = (content: string | Array<{ type?: string; text?: string }> | undefined) => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }

  return '';
};

const parseSources = (annotations: GatewayAnnotation[] = []) => {
  const seen = new Set<string>();

  return annotations
    .map(annotation => annotation.url_citation)
    .filter((citation): citation is { title?: string; url?: string } => Boolean(citation?.url))
    .map(citation => ({ title: citation.title ?? citation.url!, url: citation.url! }))
    .filter(source => {
      if (seen.has(source.url)) {
        return false;
      }

      seen.add(source.url);
      return true;
    });
};

export const webSearchTool = createTool({
  id: 'web_search',
  description: 'Search the web through the Gateway and return a concise answer with source URLs.',
  inputSchema: z.object({
    query: z.string().describe('A targeted web search query.'),
  }),
  outputSchema: z.object({
    answer: z.string(),
    sources: z.array(sourceSchema),
  }),
  execute: async inputData => {
    const apiKey = process.env.MASTRA_GATEWAY_API_KEY;

    if (!apiKey) {
      throw new Error('MASTRA_GATEWAY_API_KEY is required to use web_search.');
    }

    const response = await fetch(getGatewayChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          {
            role: 'system',
            content:
              'Search the web for the user query. Return a concise factual summary and preserve source citations in the response metadata.',
          },
          {
            role: 'user',
            content: inputData.query,
          },
        ],
        tools: [
          {
            type: 'openrouter:web_search',
            search_context_size: 'medium',
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gateway web search failed: ${response.status} ${response.statusText}`.trim());
    }

    const data = (await response.json()) as GatewayResponse;
    const message = data.choices?.[0]?.message;

    return {
      answer: parseContent(message?.content),
      sources: parseSources(message?.annotations),
    };
  },
});
