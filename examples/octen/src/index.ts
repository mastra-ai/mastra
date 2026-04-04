import { Agent } from '@mastra/core/agent';
import { octenWebSearchTool } from '@mastra/octen';
import { performance } from 'node:perf_hooks';
import 'dotenv/config';

// Ensure the environment is properly configured
if (!process.env.OCTEN_API_KEY) {
  console.warn('⚠️ OCTEN_API_KEY is not set. Please set it in your .env file.');
  process.exit(1);
}

// 1. Native Octen Gateway Agent (no tools required, RAG is native)
const octenChatAgent = new Agent({
  name: 'Native Octen Assistant',
  instructions: 'You are an intelligent assistant. You have access to the web natively.',
  model: 'octen/anthropic/claude-sonnet-4.6',
});

// 2. Pure OpenAI Agent (no tools)
const baselineAgent = new Agent({
  name: 'Pure OpenAI Baseline',
  instructions: 'You are an intelligent assistant.',
  model: 'openai/gpt-4o-mini',
});

// 3. OpenAI agent using Octen Web Search Tool
const toolAgent = new Agent({
  name: 'OpenAI + Octen Tool',
  instructions: 'You are a meticulous researcher. Always use the web search tool to find the most up-to-date and reliable information.',
  model: 'openai/gpt-4o-mini',
  tools: { octenWebSearchTool },
});

async function main() {
  console.log('# Mastra agentic search benchmarking: Octen vs OpenAI');
  console.log('');

  const queries = [
    'What record did Kendrick Lamar break at the 2026 Grammy Awards?',
    'Who won the latest super bowl? Be specific and concise.'
  ];

  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`## Demonstration ${i + 1}: Query Comparison`);
    console.log(`**Query:** "${query}"`);
    console.log('');

    const results: Array<{ label: string; latency: number; usage: any; text: string; error?: string }> = [];

    // 1. Native Octen
    try {
      const start = performance.now();
      const response = await octenChatAgent.generate(query);
      const latency = performance.now() - start;
      results.push({ label: 'Native Octen API', latency, usage: response.usage, text: response.text });
    } catch (e: any) {
      results.push({ label: 'Native Octen API', latency: 0, usage: null, text: '', error: e.message });
    }

    if (!hasOpenAI) {
      console.log('⚠️ OPENAI_API_KEY is not configured. Skipping OpenAI comparisons.');
      console.log('');
    } else {
      // 2. OpenAI Baseline (No Tools)
      try {
        const start = performance.now();
        const response = await baselineAgent.generate(query);
        const latency = performance.now() - start;
        results.push({ label: 'Pure OpenAI (No Tools)', latency, usage: response.usage, text: response.text });
      } catch (e: any) {
        results.push({ label: 'Pure OpenAI (No Tools)', latency: 0, usage: null, text: '', error: e.message });
      }

      // 3. OpenAI + Tool
      try {
        const start = performance.now();
        const response = await toolAgent.generate(query);
        const latency = performance.now() - start;
        results.push({ label: 'OpenAI + Octen Search Tool', latency, usage: response.usage, text: response.text });
      } catch (e: any) {
        results.push({ label: 'OpenAI + Octen Search Tool', latency: 0, usage: null, text: '', error: e.message });
      }
    }

    // Print Responses & Metrics
    results.forEach(res => {
      console.log(`### ${res.label}`);
      if (res.error) {
        console.log(`**Error:** ${res.error}`);
      } else {
        console.log(`**Response:**\\n${res.text.trim()}`);
      }
      console.log('');

      const usage = res.usage || {};
      const latency = res.latency ? res.latency.toFixed(2) : 'N/A';
      const input = usage.promptTokens ?? usage.inputTokens ?? '0';
      const output = usage.completionTokens ?? usage.outputTokens ?? '0';
      const total = usage.totalTokens ?? '0';

      console.log('> **Metrics:**');
      console.log(`> - **Latency:** ${latency} ms`);
      console.log(`> - **Input Tokens:** ${input}`);
      console.log(`> - **Output Tokens:** ${output}`);
      console.log(`> - **Total Tokens:** ${total}`);
      console.log('');
    });

    console.log('---');
    console.log('');
  }
}

main().catch(console.error);
