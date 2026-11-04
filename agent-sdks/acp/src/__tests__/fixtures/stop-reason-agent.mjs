// Minimal ACP agent peer: streams one text chunk, then ends the prompt with the
// stop reason given as the first CLI argument.
import { Readable, Writable } from 'node:stream';
import { AgentSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

const stopReason = process.argv[2] ?? 'end_turn';

new AgentSideConnection(
  connection => ({
    async initialize() {
      return { protocolVersion: PROTOCOL_VERSION, agentCapabilities: {} };
    },
    async newSession() {
      return { sessionId: 'stop-reason-session' };
    },
    async authenticate() {
      return {};
    },
    async prompt(params) {
      await connection.sessionUpdate({
        sessionId: params.sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'partial' } },
      });
      return { stopReason };
    },
    async cancel() {},
  }),
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
