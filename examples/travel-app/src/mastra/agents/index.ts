import { Agent } from '@mastra/core';

export const travelAgent = new Agent({
  name: 'travel-agent',
  instructions:
    'You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some tools and you will need to find the best options for them.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20240620',
    toolChoice: 'auto',
  },
  enabledTools: {
    searchFlights: true,
    searchHotels: true,
    searchAttractions: true,
  },
});

export const travelAgent2 = new Agent({
  name: 'travel-agent-2',
  instructions:
    'You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some tools and you will need to find the best options for them.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  enabledTools: {
    searchFlights: true,
    searchHotels: true,
    searchAttractions: true,
  },
});
