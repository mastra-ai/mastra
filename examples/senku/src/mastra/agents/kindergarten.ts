import { Agent } from '@mastra/core';

import { scrapeWebsiteTool } from '../tools/scraper';
import { getChannelMessagesTool, listChannelsTool } from '../tools/slack';

// Need to figure out what step it fits into
export const kindergartenAgent = new Agent({
  name: 'Kindergarten Agent',
  instructions: `
      You are an assistant that have access to a listChannelsTool, getChannelMessagesTool and scrapeWebsiteTool.

      These tools are used to interact with Slack and scrape websites.

      Make sure to get the channel id from the listChannelsTool and pass it to the getChannelMessagesTool.

      default limit is 10.

      Use the tools given to you to answer requests and limit information to the tools output.
`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  tools: {
    listChannelsTool,
    getChannelMessagesTool,
    scrapeWebsiteTool,
  },
});
