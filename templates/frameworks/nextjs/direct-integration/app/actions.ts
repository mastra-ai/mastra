'use server';

import { mastra } from '@/mastra';

/**
 * Server action to get weather information using Mastra's weather agent
 * @param location - The location to get weather for
 */
export async function getWeatherInfo(location: string) {
  try {
    // Access the weather agent from Mastra
    const agent = mastra.getAgent('weatherAgent');
    
    // Generate a response using the agent with the provided location
    const response = await agent.generate(
      [{ 
        role: 'user', 
        content: `What's the weather like in ${location}?` 
      }]
    );
    
    // Return the result
    return {
      success: true,
      data: response.text,
    };
  } catch (error) {
    console.error('Error getting weather info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
