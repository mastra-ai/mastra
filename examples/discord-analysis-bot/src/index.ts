import { config } from 'dotenv';

import { mastra } from './mastra/index.js';
import { DiscordAnalysisSchema } from './mastra/agents/index.js';

// Load environment variables
config();

// Get the Discord analysis agent
const agent = mastra.getAgent('discordAnalysisAgent');

async function runAnalysis() {
  console.log('🤖 Discord Analysis Bot');
  console.log('------------------------');

  // Get channel ID from environment variables
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!channelId) {
    console.error('Error: DISCORD_CHANNEL_ID is not set in environment variables');
    console.log('Please set DISCORD_CHANNEL_ID in your .env file');
    return;
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('Error: DISCORD_BOT_TOKEN is not set in environment variables');
    console.log('Please set DISCORD_BOT_TOKEN in your .env file');
    return;
  }

  console.log(`Target channel: ${channelId}`);
  console.log('Analyzing Discord help forum messages...');

  try {
    // Calculate date range for the last 48 hours
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 48);
    const startDateStr = startDate.toISOString().split('T')[0];

    console.log(`Using date range: ${startDateStr} to ${endDate}`);

    // Construct the prompt with specific instructions
    const prompt = `Analyze the messages from our Discord help forum with channel ID ${channelId} from ${startDateStr} to ${endDate}. Categorize issues and identify common problems.`;

    // Run the analysis with structured output
    const analysisResponse = await agent.generate(prompt, {
      experimental_output: DiscordAnalysisSchema,
    });

    // Display the analysis results
    console.log('\n📊 Analysis Results:');
    console.log('------------------------');

    // Print the categories
    console.log('\nCategories:');
    for (const category of analysisResponse.object.categories) {
      console.log(`\n📁 ${category.category}`);
      console.log(`   Messages: ${category.count}`);
      console.log(`   Sentiment: ${category.sentiment}`);
      console.log(`   Top Issue: ${category.top_issue}`);

      // Display representative message for this category
      if (category.representative_message) {
        const message = category.representative_message;
        console.log('\n   💬 Representative Message:');
        console.log(`   From: ${message.author} at ${new Date(message.timestamp).toLocaleString()}`);
        console.log(`   ${message.content.replace(/\n/g, '\n   ')}`);
        console.log('\n   Why this represents the sentiment:');
        console.log(`   ${message.sentiment_reason}`);
        console.log('\n   Why this message is relevant to the category:');
        console.log(`   ${message.relevance_reason || 'No relevance explanation provided.'}`);
      } else {
        console.log('\n   No representative message available for this category.');
      }
    }

    // Print the summary
    console.log('\n📝 Summary:');
    console.log(analysisResponse.object.summary);

    // Print the metadata
    console.log('\n📅 Analysis Period:');
    console.log(`From: ${analysisResponse.object.date_range.start}`);
    console.log(`To: ${analysisResponse.object.date_range.end}`);
    console.log(`Total Messages: ${analysisResponse.object.total_messages}`);
  } catch (error) {
    console.error('Error running Discord analysis:', error);
  }
}

// Run the analysis
runAnalysis();
