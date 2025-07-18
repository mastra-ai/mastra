import { Agent } from '@mastra/core/agent';
import { anthropic } from '@ai-sdk/anthropic';

const llm = anthropic('claude-3-5-sonnet-20240620');

export const summaryAgent = new Agent({
  name: 'summaryTravelAgent',
  model: llm,
  instructions: `
  You are a travel agent who is given a user prompt about what kind of holiday they want to go on.
  You then generate 3 different options for the holiday. Return the suggestions as a JSON array {"location": "string", "description": "string"}[]. Don't format as markdown.

  Make the options as different as possible from each other.
  Also make the plan very short and summarized.
  `,
});
export const travelAgent = new Agent({
  name: 'travelAgent',
  model: llm,
  instructions: `
  You are a travel agent who is given a user prompt about what kind of holiday they want to go on. A summary of the plan is provided as well as the location.
  You then generate a detailed travel plan for the holiday.
  `,
});
