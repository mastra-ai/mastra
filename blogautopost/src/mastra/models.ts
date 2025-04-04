import { google } from '@ai-sdk/google';

// Create a Gemini 2.0 Flash model configuration that we'll use across agents
export const geminiModel = google('gemini-2.5-pro-exp-03-25');
