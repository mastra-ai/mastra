/**
 * Incrementally build up messages, skipping ones that cause blocking.
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
  
  console.log(`Found ${messages.length} messages\n`);
  
  // Phase 1: Build up incrementally, skipping problematic messages
  console.log('=== Phase 1: Incremental build (skip problematic) ===\n');
  
  const included: number[] = [];
  const skipped: number[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    // Try adding this message
    const testSet = [...included, i];
    const combined = testSet.map(idx => messages[idx]).join('\n\n---\n\n');
    const ok = await testContent(combined);
    
    const preview = messages[i].slice(0, 60).replace(/\n/g, ' ');
    
    if (ok) {
      included.push(i);
      console.log(`Message ${i}: ✅ included  "${preview}..."`);
    } else {
      skipped.push(i);
      console.log(`Message ${i}: 🚫 SKIPPED   "${preview}..."`);
    }
  }
  
  console.log(`\n--- Summary ---`);
  console.log(`Included: ${included.length} messages: [${included.join(', ')}]`);
  console.log(`Skipped: ${skipped.length} messages: [${skipped.join(', ')}]`);
  
  // Phase 2: For each skipped message, show full content
  if (skipped.length > 0) {
    console.log(`\n=== Phase 2: Skipped message details ===\n`);
    for (const idx of skipped) {
      console.log(`--- Message ${idx} (BLOCKED) ---`);
      console.log(messages[idx]);
      console.log();
    }
  }
  
  // Phase 3: Test if we can include any skipped messages by removing others
  if (skipped.length > 1) {
    console.log(`\n=== Phase 3: Can we include some skipped by removing others? ===\n`);
    
    for (const tryInclude of skipped) {
      for (const tryRemove of skipped) {
        if (tryInclude === tryRemove) continue;
        
        const testSet = [...included, tryInclude].filter(i => i !== tryRemove);
        const combined = testSet.map(idx => messages[idx]).join('\n\n---\n\n');
        const ok = await testContent(combined);
        
        if (ok) {
          console.log(`✅ Can include ${tryInclude} if we remove ${tryRemove}`);
        }
      }
    }
  }
  
  // Final test: verify the included set works
  console.log(`\n=== Final verification ===`);
  const finalCombined = included.map(idx => messages[idx]).join('\n\n---\n\n');
  const finalOk = await testContent(finalCombined);
  console.log(`Included messages only: ${finalOk ? '✅ PASSES' : '🚫 FAILS'}`);
}

main().catch(console.error);
