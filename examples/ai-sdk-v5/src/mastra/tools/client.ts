import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Client-side tool — no `execute` function.
// The tool call is sent to the client, which executes it and sends the result back via addToolOutput.
export const getCurrentTimeTool = createTool({
  id: "get-current-time",
  description: "Get the user's current local date and time from their browser",
  inputSchema: z.object({}),
  outputSchema: z.object({
    iso: z.string(),
    formatted: z.string(),
    timezone: z.string(),
  }),
});
