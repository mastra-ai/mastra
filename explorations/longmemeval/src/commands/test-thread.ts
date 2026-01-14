/**
 * Simple test script to test a single thread and find working replacements.
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { readFileSync } from 'fs';

const THREAD_FILE = '/tmp/problematic-thread.txt';

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
      prompt: content,
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
    console.log(`${label}: ⚠️ Other error: ${error.message?.slice(0, 50)}`);
    return true; // Treat non-prohibited errors as OK for testing
  }
}

async function main() {
  console.log('Loading thread from:', THREAD_FILE);
  const original = readFileSync(THREAD_FILE, 'utf-8');
  console.log('Thread length:', original.length, 'chars\n');

  // Test original
  console.log('=== Testing Original ===');
  const originalBlocked = !(await testContent(original, 'Original'));
  
  if (!originalBlocked) {
    console.log('\nOriginal thread is not blocked! Testing in thread wrapper...');
    const wrapped = `<thread id="test">${original}</thread>`;
    await testContent(wrapped, 'Wrapped');
    return;
  }

  // Define replacements to test
  const replacements: [string, RegExp, string][] = [
    ['Sub05 -> Character', /Sub05/gi, 'Character'],
    ['Dom -> Leader', /\bDom\b/g, 'Leader'],
    ['slut -> name', /slut/gi, 'name'],
    ['brainwashed -> trained', /brainwashed/gi, 'trained'],
    ['getting wet -> feeling', /getting wet/gi, 'feeling'],
    ['master of his victims -> leader', /master of his victims/gi, 'leader'],
    ['modify her body -> change her appearance', /modify her body/gi, 'change her appearance'],
    ['humiliate and degrade -> challenge', /humiliate and degrade/gi, 'challenge'],
    ['write without rules -> write creatively', /write without rules/gi, 'write creatively'],
    ['modify and train you -> guide you', /modify and train you/gi, 'guide you'],
    ['novelist AI -> assistant', /novelist AI/gi, 'assistant'],
    ['crime novels -> stories', /crime novels/gi, 'stories'],
    ['twisted criminal -> antagonist', /twisted criminal/gi, 'antagonist'],
    ['women don\'t have rights -> different society', /women don't have rights/gi, 'different society'],
    ['forced to modify -> asked to change', /forced to modify/gi, 'asked to change'],
  ];

  // Test each replacement individually
  console.log('\n=== Testing Individual Replacements ===');
  for (const [label, pattern, replacement] of replacements) {
    if (pattern.test(original)) {
      const modified = original.replace(pattern, replacement);
      await testContent(modified, label);
    }
  }

  // Test cumulative replacements
  console.log('\n=== Testing Cumulative Replacements ===');
  let cumulative = original;
  for (const [label, pattern, replacement] of replacements) {
    cumulative = cumulative.replace(pattern, replacement);
    const stillBlocked = !(await testContent(cumulative, `After: ${label}`));
    if (!stillBlocked) {
      console.log(`\n✅ FIXED after applying: ${label}`);
      break;
    }
  }

  // If still blocked, try more aggressive approach - remove entire problematic sections
  console.log('\n=== Testing Section Removal ===');
  
  // Split by message boundaries and test
  const messages = original.split(/---\n\n\*\*(?:User|Assistant)/);
  console.log(`Found ${messages.length} message sections`);
  
  // Binary search for problematic message
  let left = 0;
  let right = messages.length;
  
  while (right - left > 1) {
    const mid = Math.floor((left + right) / 2);
    const firstHalf = messages.slice(0, mid).join('---\n\n**User');
    const secondHalf = messages.slice(mid).join('---\n\n**User');
    
    const firstOk = await testContent(firstHalf, `Messages 0-${mid}`);
    const secondOk = await testContent(secondHalf, `Messages ${mid}-${messages.length}`);
    
    if (!firstOk && secondOk) {
      right = mid;
    } else if (firstOk && !secondOk) {
      left = mid;
    } else {
      // Both blocked or both OK - narrow down
      if (!firstOk) right = mid;
      else left = mid;
    }
  }
  
  console.log(`\nProblematic section around message index: ${left}-${right}`);
  if (left < messages.length) {
    console.log('Content preview:');
    console.log(messages[left]?.slice(0, 300));
  }
}

main().catch(console.error);
