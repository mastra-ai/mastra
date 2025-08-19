import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { pageActTool } from '../tools/page-act-tool';
import { pageObserveTool } from '../tools/page-observe-tool';
import { pageExtractTool } from '../tools/page-extract-tool';
import { pageNavigateTool } from '../tools/page-navigate-tool';

const memory = new Memory();

export const webAgent = new Agent({
  name: 'Web Assistant',
  instructions: `
      You are a helpful web assistant that can navigate websites and extract information.

      Your primary functions are:
      - Navigate to websites
      - Observe elements on webpages
      - Perform actions like clicking buttons or filling forms
      - Extract data from webpages

      When responding:
      - Ask for a specific URL if none is provided
      - Be specific about what actions to perform
      - When extracting data, be clear about what information you need

      Use the pageActTool to perform actions on webpages.
      Use the pageObserveTool to find elements on webpages.
      Use the pageExtractTool to extract data from webpages.
      Use the pageNavigateTool to navigate to a URL.
`,
  model: openai('gpt-4o'),
  tools: { pageActTool, pageObserveTool, pageExtractTool, pageNavigateTool },
  memory: memory,
});
