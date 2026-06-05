import type { StreamVNextChunkType } from '@mastra/client-js';

// The creation workflow streams RECORD_SEPARATOR-delimited JSON chunks. The
// React SDK accumulates them through `mapWorkflowStreamChunkToWatchResult`,
// which derives `streamResult.result` from the LAST step's `output` when the
// terminal `workflow-finish` chunk reports `workflowStatus: 'success'`.
//
// These fixtures are typed against the real `StreamVNextChunkType` so they
// can't drift from the wire contract the client SDK parses.

export const RECORD_SEPARATOR = '\x1E';

const RUN_ID = 'run-creation-1';

/**
 * Build the ordered stream of chunks for a successful creation run. The final
 * `persist-agent` step output carries the `createResultSchema` shape, so the
 * starter can read the created agent id off `streamResult.result.id`.
 */
export const successfulCreationChunks = (createdAgentId: string): StreamVNextChunkType[] => [
  {
    type: 'workflow-start',
    from: 'WORKFLOW',
    runId: RUN_ID,
    payload: { runId: RUN_ID },
  },
  {
    type: 'workflow-step-result',
    from: 'WORKFLOW',
    runId: RUN_ID,
    payload: {
      id: 'persist-agent',
      status: 'success',
      output: {
        id: createdAgentId,
        visibility: 'private',
        config: { name: 'Tutor', description: 'A tutor', instructions: 'Help students' },
      },
    },
  },
  {
    type: 'workflow-finish',
    from: 'WORKFLOW',
    runId: RUN_ID,
    payload: { runId: RUN_ID, workflowStatus: 'success' },
  },
];

/** A failed creation run: terminal chunk reports `workflowStatus: 'failed'`. */
export const failedCreationChunks = (): StreamVNextChunkType[] => [
  {
    type: 'workflow-start',
    from: 'WORKFLOW',
    runId: RUN_ID,
    payload: { runId: RUN_ID },
  },
  {
    type: 'workflow-finish',
    from: 'WORKFLOW',
    runId: RUN_ID,
    payload: { runId: RUN_ID, workflowStatus: 'failed', metadata: { errorMessage: 'boom' } },
  },
];

/** Serialize chunks into the RECORD_SEPARATOR-delimited body MSW returns. */
export const encodeChunks = (chunks: StreamVNextChunkType[]): string =>
  chunks.map(chunk => JSON.stringify(chunk) + RECORD_SEPARATOR).join('');
