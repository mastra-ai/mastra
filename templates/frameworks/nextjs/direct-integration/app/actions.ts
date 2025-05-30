'use server';

import { mastra } from '@/mastra';

export async function getWeatherInfo(location: string) {
  try {
    const agent = mastra.getAgent('weatherAgent');
    const response = await agent.generate([
      { 
        role: 'user', 
        content: `What's the weather like in ${location}?` 
      }
    ]);
    
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
