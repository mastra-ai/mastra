import type { MastraDBMessage } from '@mastra/client-js';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { createThreadStreamHandler } from '../thread-stream';
import { initialTranscript, transcriptReducer } from '../transcript';

const run = { runId: 'run-1', from: ChunkFrom.AGENT };
const start: ChunkType = { ...run, type: 'start', payload: { messageId: 'reply-1' } };
const call = { toolCallId: 'call-1', toolName: 'lookupCustomer', args: { customerId: 'cus_123' } };

describe('Factory thread stream projection', () => {
  it('preserves separate response messages when a multi-step run is replayed', () => {
    let transcript = initialTranscript;
    const stream = createThreadStreamHandler(event => {
      transcript = transcriptReducer(transcript, { type: 'event', event });
    });
    const buffered: ChunkType[] = [
      start,
      { ...run, type: 'text-start', payload: { id: 'first-text' } },
      { ...run, type: 'text-delta', payload: { id: 'first-text', text: 'First response.' } },
      { ...run, type: 'step-start', payload: { messageId: 'reply-2', request: {} } },
      { ...run, type: 'text-start', payload: { id: 'second-text' } },
      { ...run, type: 'text-delta', payload: { id: 'second-text', text: 'Second response.' } },
    ];

    for (const chunk of buffered) stream.onChunk(chunk);
    stream.reset();
    for (const chunk of buffered) stream.onChunk(chunk);

    expect(transcript.entries).toMatchObject([
      {
        kind: 'message',
        streaming: false,
        message: { id: 'reply-1', content: { parts: [{ type: 'text', text: 'First response.' }] } },
      },
      {
        kind: 'message',
        streaming: true,
        message: { id: 'reply-2', content: { parts: [{ type: 'text', text: 'Second response.' }] } },
      },
    ]);
  });

  it.each(['stream', 'history'])('clears a replayed approval when its completion arrives through %s', completion => {
    let transcript = initialTranscript;
    const stream = createThreadStreamHandler(event => {
      transcript = transcriptReducer(transcript, { type: 'event', event });
    });
    const buffered: ChunkType[] = [
      start,
      { ...run, type: 'text-start', payload: { id: 'text-1' } },
      { ...run, type: 'text-delta', payload: { id: 'text-1', text: 'Reviewing the customer.' } },
      { ...run, type: 'tool-call', payload: { ...call, args: { ...call.args, __mastraMetadata: undefined } } },
      { ...run, type: 'tool-call-approval', payload: { ...call, resumeSchema: '{}' } },
    ];
    for (const chunk of buffered) stream.onChunk(chunk);
    expect(transcript.entries.filter(entry => entry.kind === 'approval')).toHaveLength(1);

    stream.reset();
    for (const chunk of buffered) stream.onChunk(chunk);
    stream.onEvent({ type: 'tool_approval_required', toolCallId: 'other-call', toolName: 'sendEmail', args: {} });
    if (completion === 'stream') {
      stream.onChunk({ ...run, type: 'tool-result', payload: { ...call, result: 'Customer found' } });
    } else {
      const closingMessage: MastraDBMessage = {
        id: 'closing',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'Review finished.' }] },
      };
      transcript = transcriptReducer(transcript, {
        type: 'event',
        event: { type: 'message_end', message: closingMessage },
      });
      transcript = transcriptReducer(transcript, {
        type: 'mergeWindow',
        messages: [
          {
            id: 'reply-1',
            role: 'assistant',
            createdAt: new Date(),
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Reviewing the customer.' },
                { type: 'tool-invocation', toolInvocation: { ...call, state: 'result', result: 'Customer found' } },
              ],
            },
          },
          {
            ...closingMessage,
            id: 'recovered',
            content: { format: 2, parts: [{ type: 'text', text: 'A step finished while disconnected.' }] },
          },
          closingMessage,
        ],
      });
    }

    expect(transcript.entries).toMatchObject([
      {
        kind: 'message',
        message: {
          id: 'reply-1',
          content: {
            parts: [
              { type: 'text', text: 'Reviewing the customer.' },
              { type: 'tool-invocation', toolInvocation: { state: 'result', result: 'Customer found' } },
            ],
          },
        },
      },
      { kind: 'approval', toolCallId: 'other-call', toolName: 'sendEmail' },
      ...(completion === 'history'
        ? [
            { kind: 'message', message: { id: 'recovered' } },
            { kind: 'message', message: { id: 'closing' } },
          ]
        : []),
    ]);
  });
});
