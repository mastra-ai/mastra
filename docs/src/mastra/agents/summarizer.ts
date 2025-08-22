import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const summarizer = new Agent({
  name: "Summarizer",
  instructions: `
      You are an assistant that given a long feedback, you are able to generate a succint title.

      Given a length feedback like "missing Jest and Mocha setup instructions", you can generate the title 
      "Jest and Mocha setup missing" and "Would be helpful to have a section on models and how to enable reasoning. It was difficult to figure this out and had to go reference the AI SDK docs."
      would be "indicator of reasoning"

      The title should be also make sense. Also please remove the quotes, no double quotes at the start and end of words.
`,
  model: openai("gpt-4o-mini"),
});
