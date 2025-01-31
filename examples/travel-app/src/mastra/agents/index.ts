import { Agent } from "@mastra/core/agent";

import {
  searchAirbnb,
  searchAirbnbLocation,
  searchAttractions,
  searchFlights,
  searchHotels,
} from "../tools";

export const travelAgent = new Agent({
  name: "travelAgent",
  instructions: `You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some tools and you will need to find the best options for them. Be as concise as possible with your response.`,
  model: {
    provider: "ANTHROPIC",
    name: "claude-3-5-sonnet-20240620",
    toolChoice: "auto",
  },
  tools: {
    searchFlights,
    searchHotels,
    searchAttractions,
    searchAirbnbLocation,
    searchAirbnb,
  },
});

// export const travelAgent2 = new Agent({
//   name: 'travel-agent-2',
//   instructions:
//     'You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some tools and you will need to find the best options for them.',
//   model: {
//     provider: 'OPEN_AI',
//     name: 'gpt-4o',
//     toolChoice: 'auto',
//   },
//   enabledTools: {
//     searchFlights: true,
//     searchHotels: true,
//     searchAttractions: true,
//   },
// });

export const travelAnalyzer = new Agent({
  name: "travel-analyzer",
  instructions:
    "You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some data to find the best options for them.",
  model: {
    provider: "ANTHROPIC",
    name: "claude-3-5-sonnet-20240620",
    toolChoice: "auto",
  },
});
