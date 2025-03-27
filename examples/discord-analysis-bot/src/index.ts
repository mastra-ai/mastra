import { config } from 'dotenv';

import { mastra } from './mastra/index.js';
import { DiscordAnalysisSchema } from './mastra/agents/index.js';

// Load environment variables
config();

// Get the Discord analysis agent
const agent = mastra.getAgent('discordAnalysisAgent');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runAnalysis() {
  console.log('🤖 Discord Analysis Bot');
  console.log('------------------------');

  // Get channel ID from environment variables
  const mastraChannelId = process.env.MASTRA_CHANNEL;
  const helpChannelId = process.env.HELP_CHANNEL;

  if (!mastraChannelId || !helpChannelId) {
    throw new Error('Missing required channel IDs in environment variables');
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('Error: DISCORD_BOT_TOKEN is not set in environment variables');
    console.log('Please set DISCORD_BOT_TOKEN in your .env file');
    return;
  }

  console.log('Analyzing Discord channels...');

  try {
    // Calculate date range for the last 7 days
    const days = 7;
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const dailyAnalyses: { date: string; analysis: any }[] = [];

    console.log(`Using date range: ${startDateStr} to ${endDate}`);
    console.log(`Analyzing Discord channels: Mastra (${mastraChannelId}) and Help (${helpChannelId})`);

    // Analyze each day
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() - i);
      const dateStr = currentDate.toISOString().split('T')[0];

      console.log(`\nAnalyzing messages for ${dateStr}...`);
      const dailyAnalysis = await analyzeSingleDay(mastraChannelId, helpChannelId, dateStr);
      dailyAnalyses.push({
        date: dateStr,
        analysis: dailyAnalysis.object,
      });
      if (i < days - 1) {
        console.log('Waiting before next analysis...');
        await sleep(5000);
      }
    }

    // Combine all daily analyses
    console.log('\nCombining daily analyses...');
    const analysisResponse = await combineAnalyses(dailyAnalyses);

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

// Function to analyze a single day
async function analyzeSingleDay(mastraChannelId: string, helpChannelId: string, date: string) {
  const prompt = `Analyze the messages from our Discord channels for ${date}.
  Include messages from both:
  - Mastra channel (${mastraChannelId})
  - Help channel (${helpChannelId})
  
  Categorize messages from both channels to identify patterns and issues for this day.`;

  return agent.generate(prompt, {
    experimental_output: DiscordAnalysisSchema,
  });
}

// Function to combine daily analyses
async function combineAnalyses(dailyAnalyses: any[]) {
  const summaryPrompt = `Review and combine these daily analyses to provide an overall summary.
  Focus on:
  - Trends across days
  - Most common categories
  - Recurring issues
  - Changes in patterns over time
  
  Here are the daily analyses:
  ${dailyAnalyses.map(analysis => `Date: ${analysis.date}\n${analysis.analysis}`).join('\n\n')}`;

  return agent.generate(summaryPrompt, {
    experimental_output: DiscordAnalysisSchema,
  });
}
