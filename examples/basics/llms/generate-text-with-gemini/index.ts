import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';

dotenv.config();

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'GOOGLE',
  name: 'gemini-1.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
});

const response = await llm.generate('What is a wormhole?');

console.log(response.text);
