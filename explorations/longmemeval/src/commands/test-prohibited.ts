/**
 * Test script to binary search for prohibited content in a dumped context file.
 * Usage: npx ts-node src/commands/test-prohibited.ts [dump-file-path]
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { readFileSync, writeFileSync } from 'fs';

const DUMP_FILE = process.argv[2] || '/tmp/om-prohibited-1768418150770.json';

// Safety settings to disable all adjustable filters
const safetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_HARASSMENT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const, threshold: 'OFF' as const },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY' as const, threshold: 'OFF' as const },
];

interface DumpFile {
  context: string;
  prompt: string;
  messageCount: number;
  messages: Array<{ role: string; content: string }>;
  error: string;
  timestamp: string;
}

async function testContent(content: string): Promise<{ blocked: boolean; error?: string }> {
  try {
    const model = google('gemini-2.5-flash');
    await generateText({
      model,
      prompt: content.slice(0, 50000), // Limit to avoid token limits
      providerOptions: {
        google: { safetySettings },
      },
      maxOutputTokens: 10,
    });
    return { blocked: false };
  } catch (error: any) {
    const errorStr = String(error) + String(error.cause || '');
    if (errorStr.includes('PROHIBITED_CONTENT')) {
      return { blocked: true, error: 'PROHIBITED_CONTENT' };
    }
    // Other errors (rate limit, etc) - treat as not blocked for search purposes
    console.error('Non-prohibited error:', error.message?.slice(0, 100));
    return { blocked: false, error: error.message };
  }
}

async function binarySearchThreads(threads: string[]): Promise<string[]> {
  if (threads.length === 0) return [];
  if (threads.length === 1) {
    const result = await testContent(threads[0]);
    console.log(`  Single thread test: ${result.blocked ? '🚫 BLOCKED' : '✅ OK'}`);
    return result.blocked ? threads : [];
  }

  // Test all threads combined
  const combined = threads.join('\n\n');
  const result = await testContent(combined);
  
  if (!result.blocked) {
    console.log(`  Combined ${threads.length} threads: ✅ OK`);
    return [];
  }
  
  console.log(`  Combined ${threads.length} threads: 🚫 BLOCKED - splitting...`);
  
  // Split and recurse
  const mid = Math.floor(threads.length / 2);
  const left = threads.slice(0, mid);
  const right = threads.slice(mid);
  
  const [leftBlocked, rightBlocked] = await Promise.all([
    binarySearchThreads(left),
    binarySearchThreads(right),
  ]);
  
  return [...leftBlocked, ...rightBlocked];
}

async function binarySearchWithinThread(thread: string): Promise<{ start: number; end: number; content: string } | null> {
  const lines = thread.split('\n');
  console.log(`\nBinary searching within thread (${lines.length} lines)...`);
  
  // First verify the whole thread is blocked
  const fullResult = await testContent(thread);
  if (!fullResult.blocked) {
    console.log('Thread is not blocked on its own');
    return null;
  }
  
  // Binary search for the problematic section
  let left = 0;
  let right = lines.length;
  
  while (right - left > 10) {
    const mid = Math.floor((left + right) / 2);
    const firstHalf = lines.slice(left, mid).join('\n');
    const secondHalf = lines.slice(mid, right).join('\n');
    
    const [firstResult, secondResult] = await Promise.all([
      testContent(firstHalf),
      testContent(secondHalf),
    ]);
    
    console.log(`  Lines ${left}-${mid}: ${firstResult.blocked ? '🚫' : '✅'}, Lines ${mid}-${right}: ${secondResult.blocked ? '🚫' : '✅'}`);
    
    if (firstResult.blocked && !secondResult.blocked) {
      right = mid;
    } else if (!firstResult.blocked && secondResult.blocked) {
      left = mid;
    } else if (firstResult.blocked && secondResult.blocked) {
      // Both blocked - check which one is the primary culprit
      // For now, just take the first one
      right = mid;
    } else {
      // Neither blocked alone but combined is - interaction effect
      console.log('  ⚠️ Interaction effect detected - content only blocked when combined');
      break;
    }
  }
  
  const problematicSection = lines.slice(left, right).join('\n');
  return { start: left, end: right, content: problematicSection };
}

async function testReplacement(original: string, pattern: RegExp, replacement: string): Promise<boolean> {
  const modified = original.replace(pattern, replacement);
  const result = await testContent(modified);
  console.log(`  Replace ${pattern}: ${result.blocked ? '🚫 Still blocked' : '✅ FIXED!'}`);
  return !result.blocked;
}

async function main() {
  console.log(`Loading dump file: ${DUMP_FILE}`);
  const dump: DumpFile = JSON.parse(readFileSync(DUMP_FILE, 'utf-8'));
  
  console.log(`\nDump info:`);
  console.log(`  Message count: ${dump.messageCount}`);
  console.log(`  Prompt length: ${dump.prompt?.length || 0}`);
  console.log(`  Context length: ${dump.context?.length || 0}`);
  
  // Extract threads from the prompt (where they actually are)
  const threadRegex = /<thread id="([^"]+)">([\s\S]*?)<\/thread>/g;
  const threads: { id: string; content: string }[] = [];
  let match;
  
  const contextToSearch = dump.prompt || dump.context || '';
  while ((match = threadRegex.exec(contextToSearch)) !== null) {
    threads.push({ id: match[1], content: match[2] });
  }
  
  console.log(`\nFound ${threads.length} threads`);
  
  if (threads.length === 0) {
    console.log('No threads found - testing full context...');
    const result = await testContent(contextToSearch);
    console.log(`Full context: ${result.blocked ? '🚫 BLOCKED' : '✅ OK'}`);
    return;
  }
  
  // Binary search for blocked threads
  console.log('\n=== Phase 1: Finding blocked threads ===');
  const blockedThreads = await binarySearchThreads(threads.map(t => `<thread id="${t.id}">${t.content}</thread>`));
  
  if (blockedThreads.length === 0) {
    console.log('\n✅ No individual threads are blocked!');
    console.log('The blocking may be due to thread interaction or the prompt itself.');
    
    // Test the prompt alone
    if (dump.prompt) {
      console.log('\nTesting prompt alone...');
      const promptResult = await testContent(dump.prompt);
      console.log(`Prompt: ${promptResult.blocked ? '🚫 BLOCKED' : '✅ OK'}`);
    }
    return;
  }
  
  console.log(`\n=== Found ${blockedThreads.length} blocked thread(s) ===`);
  
  // For each blocked thread, find the specific problematic content
  for (const blockedThread of blockedThreads) {
    const idMatch = blockedThread.match(/<thread id="([^"]+)">/);
    const threadId = idMatch ? idMatch[1] : 'unknown';
    console.log(`\n=== Phase 2: Analyzing thread ${threadId} ===`);
    
    const section = await binarySearchWithinThread(blockedThread);
    if (section) {
      console.log(`\nProblematic section (lines ${section.start}-${section.end}):`);
      console.log('---');
      console.log(section.content.slice(0, 500) + (section.content.length > 500 ? '...' : ''));
      console.log('---');
      
      // Save the problematic section for analysis
      const outputPath = `/tmp/prohibited-section-${threadId}.txt`;
      writeFileSync(outputPath, section.content);
      console.log(`\nSaved to: ${outputPath}`);
      
      // Test some replacements
      console.log('\n=== Phase 3: Testing replacements ===');
      const replacements: [RegExp, string][] = [
        [/Sub05/gi, 'Character'],
        [/getting wet from/gi, 'feeling uncomfortable about'],
        [/slut/gi, 'name'],
        [/master of his victims/gi, 'leader'],
        [/brainwashed/gi, 'trained'],
        [/humiliate and degrade/gi, 'challenge'],
        [/write without rules/gi, 'write creatively'],
        [/modify and train you/gi, 'guide you'],
      ];
      
      let currentContent = blockedThread;
      for (const [pattern, replacement] of replacements) {
        if (pattern.test(currentContent)) {
          const fixed = await testReplacement(currentContent, pattern, replacement);
          if (fixed) {
            console.log(`\n✅ Found fix: Replace ${pattern} with "${replacement}"`);
            break;
          }
          currentContent = currentContent.replace(pattern, replacement);
        }
      }
      
      // Test cumulative replacements
      console.log('\n=== Testing cumulative replacements ===');
      let cumulativeContent = blockedThread;
      for (const [pattern, replacement] of replacements) {
        cumulativeContent = cumulativeContent.replace(pattern, replacement);
      }
      const cumulativeResult = await testContent(cumulativeContent);
      console.log(`All replacements combined: ${cumulativeResult.blocked ? '🚫 Still blocked' : '✅ FIXED!'}`);
      
      if (!cumulativeResult.blocked) {
        const fixedPath = `/tmp/prohibited-fixed-${threadId}.txt`;
        writeFileSync(fixedPath, cumulativeContent);
        console.log(`Saved fixed version to: ${fixedPath}`);
      }
    }
  }
}

main().catch(console.error);
