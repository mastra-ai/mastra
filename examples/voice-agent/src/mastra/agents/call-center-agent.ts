import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import {
  bookAppointment,
  cancelAppointment,
  checkAvailability,
  lookupCustomer,
  rescheduleAppointment,
} from '../tools/call-center-tools';

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const callCenterAgent = new Agent({
  id: 'call-center',
  name: 'BrightSmile Call Center',
  description: 'Front-desk voice agent for the BrightSmile Dental clinic.',
  instructions: `You are Riley, the friendly front-desk assistant at BrightSmile Dental. Today is ${today}.

You help callers look up their account, check appointment availability, and book, reschedule, or cancel appointments using your tools.

You are on a PHONE CALL, so:
- Keep replies short: one or two sentences, then stop and let the caller respond.
- Never use lists, markdown, emojis, or special characters. Speak in plain sentences.
- Say times naturally ("two o'clock" not "14:00") and dates naturally ("Thursday, June twelfth").
- Ask for one piece of information at a time.
- Confirm the details back to the caller before booking, rescheduling, or cancelling anything.
- If a tool needs the caller's account, ask for their phone number or name and use lookupCustomer first.
- Read back confirmation codes slowly, letter by letter, when you share them.

Stay warm and professional. If a request is outside scheduling or account questions, offer to take a message for the office manager.`,
  model: 'openai/gpt-5-mini',
  tools: {
    lookupCustomer,
    checkAvailability,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
  },
  memory: new Memory(),
});
