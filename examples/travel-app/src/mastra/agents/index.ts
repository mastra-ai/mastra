import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";

import {
  searchAirbnb,
  searchAirbnbLocation,
  searchAttractions,
  searchFlights,
  searchHotels,
} from "../tools";
import { storage } from "./storage";

const memory = new Memory({
  storage,
});

export const travelAgent = new Agent({
  id: "travel-agent",
  name: "Travel Agent",
  instructions: `You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some tools and you will need to find the best options for them. Be as concise as possible with your response.`,
  model: "openai/gpt-4.1",
  memory,
  tools: {
    searchFlights,
    searchHotels,
    searchAttractions,
    searchAirbnbLocation,
    searchAirbnb,
  },
});

export const travelAnalyzer = new Agent({
  id: "travel-analyzer",
  name: "Travel Analyzer",
  instructions:
    "You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some data to find the best options for them.",
  model: "openai/gpt-4.1",
  memory,
});
