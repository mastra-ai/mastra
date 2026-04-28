import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { propagateVertexThoughtSignaturesToToolInvocations } from '../vertex-thought-signature';

function toolPart(
  id: string,
  toolName: string,
  providerMetadata?: { vertex?: { thoughtSignature?: string }; google?: { thoughtSignature?: string } },
): MastraDBMessage['content']['parts'][number] {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'call',
      toolCallId: id,
      toolName,
      args: {},
    },
    ...(providerMetadata ? { providerMetadata } : {}),
  } as MastraDBMessage['content']['parts'][number];
}

describe('propagateVertexThoughtSignaturesToToolInvocations', () => {
  it('copies the prior vertex thoughtSignature onto later parallel tool-invocation parts', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c1', 'query_data', { vertex: { thoughtSignature: 'sig-from-first' } })],
        },
      },
      {
        id: 'a2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c2', 'query_data')],
        },
      },
    ];

    propagateVertexThoughtSignaturesToToolInvocations(messages);

    const second = messages[1]!.content.parts[0] as {
      providerMetadata?: { vertex?: { thoughtSignature?: string } };
    };
    expect(second.providerMetadata?.vertex?.thoughtSignature).toBe('sig-from-first');
  });

  it('uses google namespace thoughtSignature as the source when vertex is absent', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c1', 'query_data', { google: { thoughtSignature: 'sig-google' } })],
        },
      },
      {
        id: 'a2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c2', 'query_data')],
        },
      },
    ];

    propagateVertexThoughtSignaturesToToolInvocations(messages);

    const second = messages[1]!.content.parts[0] as {
      providerMetadata?: { vertex?: { thoughtSignature?: string } };
    };
    expect(second.providerMetadata?.vertex?.thoughtSignature).toBe('sig-google');
  });

  it('does not copy a thoughtSignature across a user message (new turn boundary)', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c1', 'query_data', { vertex: { thoughtSignature: 'from-earlier-turn' } })],
        },
      },
      {
        id: 'u1',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Tool results here' }],
        },
      },
      {
        id: 'a2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c2', 'query_data')],
        },
      },
    ];

    propagateVertexThoughtSignaturesToToolInvocations(messages);

    const laterPart = messages[2]!.content.parts[0] as {
      providerMetadata?: { vertex?: { thoughtSignature?: string } };
    };
    expect(laterPart.providerMetadata?.vertex?.thoughtSignature).toBeUndefined();
  });

  it('does not overwrite an existing tool-invocation thoughtSignature', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c1', 'query_data', { vertex: { thoughtSignature: 'first' } })],
        },
      },
      {
        id: 'a2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [toolPart('c2', 'query_data', { vertex: { thoughtSignature: 'second-own' } })],
        },
      },
    ];

    propagateVertexThoughtSignaturesToToolInvocations(messages);

    const second = messages[1]!.content.parts[0] as {
      providerMetadata?: { vertex?: { thoughtSignature?: string } };
    };
    expect(second.providerMetadata?.vertex?.thoughtSignature).toBe('second-own');
  });
});
