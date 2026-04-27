# Adding the Zapier MCP Server

In this step, you'll add the Zapier MCP server to your agent, giving it access to email, social media, and many other integrations available through Zapier.

## What is Zapier MCP?

Zapier MCP is a server that provides access to thousands of apps and services through the Zapier platform. This includes:

- Email services (Gmail, Outlook, etc.)
- Social media platforms (Twitter/X, LinkedIn, etc.)
- Project management tools (Trello, Asana, etc.)
- And many more

By integrating the Zapier MCP server with your Mastra agent, you can give it access to all these services without having to write custom tool functions for each one. This significantly expands your agent's capabilities and makes it more useful for a wide range of tasks.

## Authentication

Zapier MCP requires authentication to connect. You will need two things from Zapier:

1. **MCP Server URL**: The endpoint your agent connects to
2. **API Key**: A secret key sent with every request to prove your identity

The next step walks through getting both of these from the Zapier dashboard.
