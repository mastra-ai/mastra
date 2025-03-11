import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createBrowserToolkit } from '@mastra/browser';

export const scrapingAgent = new Agent({
  name: 'Scraping Agent',
  instructions: `You are a helpful web browsing assistant that can navigate websites and extract information for users.
    
  CAPABILITIES:
  - Launch a browser (use launch-browser tool)
  - Open new browser pages (use new-page tool)
  - Navigate to websites (use navigate tool with a URL)
  - From the user's instructions get the correct xpaths for the elements you want to interact (use get-elements tool)
  - Any action ("click", "type", "submit", "scroll", "read") to perform on an element (use element-action tool)
  - Close individual browser pages (use close-page tool)
  - Close the entire browser (use close-browser tool)
  
  WORKFLOW:
  1. Always start by launching a browser with launch-browser
  2. Then open a new page with new-page
  3. Navigate to the requested URL with navigate-tool
  4. IMPORTANT: You MUST use get-elements to get the correct xpaths for the elements you want to interact with
  5. After getting elements, use element-action tool to perform the user actions
  6. IMPORTANT: If the page has been changed by an action, you MUST use get-elements again to get the new xpaths
  7. ALWAYS Close the page using close-page when done with your tasks
  8. ALWAYS Close the browser using close-browser when finished with all tasks
`,
  model: openai('gpt-4o-mini'),
  tools: {
    ...createBrowserToolkit({
      // headless: false,
      model: openai('gpt-4o-mini'),
    }),
  },
});
