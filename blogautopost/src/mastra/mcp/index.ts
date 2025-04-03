import { MCPConfiguration } from '@mastra/mcp';

export const mcpConfiguration = new MCPConfiguration({
  servers: {
    playwright: {
      command: 'npx',
      args: ['-y', '@playwright/mcp'],
      env: {
        // Add any environment variables needed for Playwright
        PLAYWRIGHT_HEADLESS: 'false', // Set to true for headless mode
      },
    },
  },
});

export default mcpConfiguration; 