/**
 * Chrome browser automation prompt — provides guidelines for using the
 * claude-in-chrome MCP tools.
 */
export const chromePrompt = `
# Chrome Browser Automation

You have access to Chrome browser automation tools via the claude-in-chrome MCP server. These tools let you interact with the user's Chrome browser.

## Available Tools

- **claude-in-chrome_tabs_context_mcp** — Get the current page context (URL, title, selected text, page content)
- **claude-in-chrome_tabs_create_mcp** — Create a new tab and navigate to a URL
- **claude-in-chrome_javascript_tool** — Execute JavaScript in the active tab
- **claude-in-chrome_read_console_messages** — Read console messages from the active tab
- **claude-in-chrome_gif_creator** — Create a GIF recording of browser actions

## Guidelines

1. Always use \`claude-in-chrome_tabs_context_mcp\` first to understand the current page before taking actions.
2. Use \`claude-in-chrome_javascript_tool\` for DOM manipulation, form filling, clicking, and data extraction.
3. Use \`claude-in-chrome_read_console_messages\` to debug JavaScript errors or check application state.
4. Use \`claude-in-chrome_tabs_create_mcp\` when you need to open a new page (e.g., documentation, test URLs).
5. Use \`claude-in-chrome_gif_creator\` to record visual sequences for documentation or bug reports.

## Troubleshooting

If Chrome tools fail to connect:

1. **Claude Desktop conflict**: If the Claude Desktop app is running, its native messaging host may conflict. Quit Claude Desktop and try again.
2. **Extension not installed**: Make sure the Claude Chrome extension is installed and you are logged in. Run \`claude chrome install\` from the terminal if needed.
3. **Expired OAuth token**: If authentication fails, re-authenticate in the Chrome extension.
`.trim();
