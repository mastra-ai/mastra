import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'callCenter',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  greeting: 'Thanks for calling BrightSmile Dental, this is Riley. How can I help you today?',
  toolFeedback: ({ toolName }) => {
    if (toolName === 'lookupCustomer') return 'Let me pull up your account.';
    if (toolName === 'checkAvailability') return 'One moment while I check the schedule.';
    if (toolName === 'bookAppointment') return 'Okay, booking that for you now.';
    if (toolName === 'rescheduleAppointment') return 'Let me move that appointment.';
    if (toolName === 'cancelAppointment') return 'One second while I cancel that.';
    return undefined;
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
