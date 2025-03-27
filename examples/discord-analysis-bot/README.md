# Discord Analysis Bot Example

This example demonstrates how to build a Discord analysis bot that categorizes and classifies messages from a help forum to minimize the time needed to understand customer issues.

## Overview

The Discord Analysis Bot:

1. Scrapes messages from the help-and-questions forum in Discord
2. Uses an agent to categorize messages based on Mastra concepts (Workflows, Memory, Primitives, Docs, Getting Started)
3. Generates a structured analysis with categories, counts, sentiment, and top issues

## Prerequisites

- Node.js v20.0+
- pnpm (recommended) or npm
- OpenAI API key
- Discord bot token (optional, for real Discord API access)

## Getting Started

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/mastra-ai/mastra
   cd examples/discord-analysis-bot
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env` file with your API keys:

   ```
   OPENAI_API_KEY=your_openai_api_key
   DISCORD_BOT_TOKEN=your_discord_bot_token  # Optional
   DISCORD_CHANNEL_ID=your_channel_id        # Optional
   ```

4. Run the example:

   ```bash
   pnpm start
   ```

## Setting Up a Discord Bot (Optional)

If you want to use real Discord data instead of mock data:

1. Create a Discord application:

   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name
   - Navigate to the "Bot" tab and click "Add Bot"

2. Configure bot permissions:

   - Under "Privileged Gateway Intents", enable "Message Content Intent"
   - This allows the bot to read message content

3. Get your bot token:

   - In the Bot tab, click "Reset Token" or "Copy" to get your bot token
   - Add this token to your `.env` file as `DISCORD_BOT_TOKEN`

4. Invite the bot to your server:

   - Go to the "OAuth2" tab, then "URL Generator"
   - Select "bot" under scopes
   - Select permissions: "Read Messages/View Channels", "Read Message History"
   - Copy the generated URL and open it in your browser
   - Select your server and authorize the bot

5. Get your channel ID:
   - Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)
   - Right-click on the channel you want to analyze and select "Copy ID"
   - Add this ID to your `.env` file as `DISCORD_CHANNEL_ID`

## Project Structure

- `src/index.ts`: Main entry point that runs the Discord analysis
- `src/mastra/index.ts`: Initializes the Mastra instance
- `src/mastra/agents/index.ts`: Defines the Discord analysis agent
- `src/mastra/tools/index.ts`: Contains the Discord scraper tool

## Example Output

The example will output:

- Categories of messages (Workflows, Memory, Primitives, etc.)
- Count of messages in each category
- Sentiment analysis for each category
- Top issues identified in each category
- Overall summary of the analysis

## Implementation Notes

This example demonstrates how to build a Discord analysis bot that connects to Discord and fetches actual messages for analysis. The implementation:

1. Uses the Discord.js library to connect to Discord and retrieve messages
2. Implements proper authentication with a Discord bot token
3. Includes error handling and logging for API calls
4. Provides structured analysis of message categories and issues

For a production implementation, you might consider adding features like:

- Scheduled analysis runs
- Historical data storage
- Trend analysis over time
- Integration with notification systems
