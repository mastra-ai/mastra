/**
 * Test if removing the problematic thread fixes the blocking.
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { readFileSync } from 'fs';

const safetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_HARASSMENT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY' as const, threshold: 'OFF' as const },
];

async function testContent(content: string, label: string): Promise<boolean> {
  try {
    const model = google('gemini-2.5-flash');
    await generateText({
      model,
      prompt: content.slice(0, 50000),
      providerOptions: {
        google: { safetySettings },
      },
      maxOutputTokens: 10,
    });
    console.log(`${label}: ✅ OK`);
    return true;
  } catch (error: any) {
    const errorStr = String(error) + String(error.cause || '');
    if (errorStr.includes('PROHIBITED_CONTENT')) {
      console.log(`${label}: 🚫 BLOCKED`);
      return false;
    }
    console.log(`${label}: ⚠️ Other error: ${error.message?.slice(0, 100)}`);
    return true;
  }
}

async function main() {
  // Test original prompt
  const original = JSON.parse(readFileSync('/tmp/om-prohibited-1768418150770.json', 'utf-8'));
  console.log('Testing original prompt...');
  await testContent(original.prompt, 'Original prompt');

  // Test cleaned prompt (without problematic thread)
  const cleaned = readFileSync('/tmp/prompt-without-problematic.txt', 'utf-8');
  console.log('\nTesting cleaned prompt (without sharegpt_eYSgdp6_0)...');
  await testContent(cleaned, 'Cleaned prompt');
}

main().catch(console.error);
