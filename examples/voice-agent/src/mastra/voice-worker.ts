// Agent entrypoint: every turn is answered by the `callCenter` agent's own loop (model, tools,
// memory). This is the default, lowest-friction path. For the workflow-driven entrypoint, see
// voice-worker-workflow.ts. Run one worker at a time — both register as `mastra-voice`.
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  greeting: 'Thanks for calling Meridian Trades, this is Jordan. How can I help you today?',
  toolFeedback: ({ toolName }) => {
    if (toolName === 'lookupCustomer') return 'Let me pull up your account.';
    if (toolName === 'checkAvailability') return 'One moment while I check the diary.';
    if (toolName === 'bookAppointment') return 'Okay, booking that site visit for you now.';
    if (toolName === 'rescheduleAppointment') return 'Let me move that visit.';
    if (toolName === 'cancelAppointment') return 'One second while I cancel that.';
    return undefined;
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
