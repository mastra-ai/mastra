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
- lead: a new prospect asking about work, pricing, or availability for a trade (plumbing, electrical, carpentry, painting, general roofing work).
- inspection: the caller specifically wants a roof looked at or inspected — this path needs a service-area (zip) check.
- callback: the caller just wants someone to call them back, or has a request outside trades work, scheduling, and accounts.
- existing_job: the caller references an existing account or booked visit, or wants to book, move, or cancel a site visit.
- general: greetings and anything that does not yet fit a category.

Base the classification on the most recent caller message. Return only the classification.`,
  // Fast, non-reasoning classifier — this step is on the workflow's critical path before the
  // reply, so it must not "think". Classification is easy; mini handles it in well under a second.
  model: 'openai/gpt-4.1-mini',
});
