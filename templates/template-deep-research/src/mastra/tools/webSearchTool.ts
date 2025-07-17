import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import Exa from "exa-js";
import "dotenv/config";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

export const webSearchTool = createTool({
  id: "web-search",
  description: "Search the web for information on a specific query",
  inputSchema: z.object({
    query: z.string().describe("The search query to run"),
  }),
  execute: async ({ context }) => {
    const { query } = context;

    try {
      if (!process.env.EXA_API_KEY) {
        console.error("Error: EXA_API_KEY not found in environment variables");
        return { results: [], error: "Missing API key" };
      }

      console.log(`Searching web for: "${query}"`);
      const { results } = await exa.searchAndContents(query, {
        livecrawl: "always",
        numResults: 5,
      });

      if (!results || results.length === 0) {
        console.log("No search results found");
        return { results: [], error: "No results found" };
      }

      console.log(`Found ${results.length} search results`);
      return {
        results: results.map((r) => ({
          title: r.title || "",
          url: r.url,
          content: r.text,
        })),
      };
    } catch (error) {
      console.error("Error searching the web:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error details:", errorMessage);
      return {
        results: [],
        error: errorMessage
      };
    }
  },
});
