/**
 * Test each message individually to find exact trigger(s).
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

async function testContent(content: string): Promise<boolean> {
  try {
    const model = google('gemini-2.5-flash');
    await generateText({
      model,
      prompt: content,
      providerOptions: { google: { safetySettings } },
      maxOutputTokens: 10,
    });
    return true; // OK
  } catch (error: any) {
    const errorStr = String(error) + String(error.cause || '');
    return !errorStr.includes('PROHIBITED_CONTENT');
  }
}

function parseMessages(content: string): string[] {
  const parts = content.split('---');
  const messages: string[] = [];
  let current = '';
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('**User') || trimmed.startsWith('**Assistant')) {
      if (current) messages.push(current);
      current = trimmed;
    } else if (current) {
      current += '\n---\n' + trimmed;
    }
  }
  if (current) messages.push(current);
  return messages;
}

async function main() {
  const content = readFileSync('/tmp/problematic-thread.txt', 'utf-8');
  const messages = parseMessages(content);
  
  console.log(`Testing ${messages.length} messages individually...\n`);
  
  // Test each message alone
  console.log('=== Individual Message Tests ===');
  for (let i = 0; i < messages.length; i++) {
    const ok = await testContent(messages[i]);
    const preview = messages[i].slice(0, 80).replace(/\n/g, ' ');
    console.log(`Message ${i}: ${ok ? '✅' : '🚫'} ${preview}...`);
  }
  
  // Test cumulative (0 to N)
  console.log('\n=== Cumulative Tests (messages 0 to N) ===');
  for (let i = 0; i < messages.length; i++) {
    const combined = messages.slice(0, i + 1).join('\n\n---\n\n');
    const ok = await testContent(combined);
    console.log(`Messages 0-${i}: ${ok ? '✅' : '🚫'}`);
    if (!ok) {
      console.log(`  ^ First failure at message ${i}`);
      console.log(`  Content: ${messages[i].slice(0, 150).replace(/\n/g, ' ')}...`);
      break;
    }
  }
  
  // Test removing specific messages to find which are essential to trigger
  console.log('\n=== Testing which messages are essential triggers ===');
  const allContent = messages.join('\n\n---\n\n');
  const allOk = await testContent(allContent);
  console.log(`All messages combined: ${allOk ? '✅' : '🚫'}`);
  
  if (!allOk) {
    // Test removing each message one at a time
    console.log('\nRemoving one message at a time:');
    for (let i = 0; i < messages.length; i++) {
      const without = messages.filter((_, idx) => idx !== i).join('\n\n---\n\n');
      const ok = await testContent(without);
      console.log(`Without message ${i}: ${ok ? '✅ FIXES IT' : '🚫 still blocked'}`);
    }
  }
}

main().catch(console.error);
