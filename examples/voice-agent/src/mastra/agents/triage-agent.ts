import { Agent } from '@mastra/core/agent';

/**
 * A small, tool-free classifier used by the phone-conversation workflow. It reads the call
 * transcript and returns the caller's current intent as structured output, which the workflow
 * uses to focus the reply-generating step.
 */
export const triageAgent = new Agent({
  id: 'triage',
  name: 'Call triage',
  description: 'Classifies the intent of an in-progress phone call from its transcript.',
  instructions: `Read the call transcript and classify the caller's current intent into exactly one category:
- new_lead: a new prospect asking about work, pricing, or availability for the first time.
- existing_job: the caller references an existing account, job, or booked site visit.
- scheduling: the caller wants to book, move, or cancel a site visit.
- general: anything else, including greetings and questions outside trades work.

Base the classification on the most recent caller message. Return only the classification.`,
  model: 'openai/gpt-5-mini',
});
