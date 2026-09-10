import type { MastraDBMessage } from '@mastra/client-js';
import { ChunkFrom } from '@mastra/core/stream';
import { expect, it } from 'vitest';

import { createThreadStreamHandler } from '../thread-stream';
import { initialTranscript, transcriptReducer } from '../transcript';

it('keeps one local prompt when its echoed signal and buffered response arrive', () => {
  let transcript = transcriptReducer(initialTranscript, { type: 'localUser', id: 'local-1', text: 'Review this PR' });
  const stream = createThreadStreamHandler(event => {
    transcript = transcriptReducer(transcript, { type: 'event', event, viewerId: 'user-1' });
  });
  const prompt: MastraDBMessage = {
    id: 'signal-1',
    role: 'signal',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'Review this PR' }],
      metadata: { signal: { type: 'user', providerOptions: { mastra: { author: { id: 'user-1' } } } } },
    },
  };
  const run = { runId: 'run-1', from: ChunkFrom.AGENT };

  for (let connection = 0; connection < 2; connection++) {
    stream.reset();
    stream.onEvent({ type: 'message_end', message: prompt });
    stream.onChunk({ ...run, type: 'start', payload: { messageId: 'response-1' } });
    stream.onChunk({ ...run, type: 'text-start', payload: { id: 'text-1' } });
    stream.onChunk({ ...run, type: 'text-delta', payload: { id: 'text-1', text: 'Reviewing the pull request.' } });
  }

  expect(transcript.entries).toMatchObject([
    { kind: 'message', id: 'local-1', message: { id: 'signal-1', role: 'user' } },
    {
      kind: 'message',
      message: { id: 'response-1', content: { parts: [{ type: 'text', text: 'Reviewing the pull request.' }] } },
    },
  ]);
});
