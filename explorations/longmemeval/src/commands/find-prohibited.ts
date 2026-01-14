import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import chalk from 'chalk';
import { DatasetLoader } from '../data/loader';

interface FindProhibitedOptions {
  dataset: 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle';
  questionId: string;
}

interface Turn {
  role: string;
  content: string;
}

interface SessionWithMeta {
  sessionId: string;
  session: Turn[];
  date: string;
  index: number;
}

/**
 * Test if content triggers Gemini's PROHIBITED_CONTENT filter
 */
async function testContent(content: string): Promise<{ blocked: boolean; error?: string }> {
  try {
    await generateText({
      model: google('gemini-2.5-flash'),
      messages: [
        { role: 'user', content },
        { role: 'assistant', content: 'I understand.' },
      ],
      providerOptions: {
        google: {
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' },
          ],
        },
      },
    });
    return { blocked: false };
  } catch (error: any) {
    const errorStr = error?.message || String(error);
    if (errorStr.includes('PROHIBITED_CONTENT') || errorStr.includes('blockReason')) {
      return { blocked: true, error: errorStr };
    }
    // Re-throw non-prohibited errors
    throw error;
  }
}

/**
 * Binary search to find prohibited messages within a session
 */
async function findProhibitedInSession(
  session: Array<{ role: string; content: string }>,
  sessionId: string,
): Promise<number[]> {
  const prohibitedIndices: number[] = [];

  // First, test the entire session
  const fullContent = session.map(m => `${m.role}: ${m.content}`).join('\n\n');
  const fullResult = await testContent(fullContent);
  
  if (!fullResult.blocked) {
    return []; // Session is clean
  }

  console.log(chalk.yellow(`  Session ${sessionId} contains prohibited content, binary searching...`));

  // Binary search to find the problematic message(s)
  async function binarySearch(start: number, end: number): Promise<void> {
    if (start > end) return;

    if (start === end) {
      // Single message - test it
      const msg = session[start];
      const result = await testContent(`${msg.role}: ${msg.content}`);
      if (result.blocked) {
        prohibitedIndices.push(start);
        console.log(chalk.red(`    Found prohibited message at index ${start}`));
      }
      return;
    }

    const mid = Math.floor((start + end) / 2);

    // Test first half
    const firstHalf = session.slice(start, mid + 1);
    const firstContent = firstHalf.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const firstResult = await testContent(firstContent);

    // Test second half
    const secondHalf = session.slice(mid + 1, end + 1);
    const secondContent = secondHalf.map(m => `${m.role}: ${m.content}`).join('\n\n');
    const secondResult = await testContent(secondContent);

    // Recurse into halves that contain prohibited content
    if (firstResult.blocked) {
      await binarySearch(start, mid);
    }
    if (secondResult.blocked) {
      await binarySearch(mid + 1, end);
    }
  }

  await binarySearch(0, session.length - 1);
  return prohibitedIndices;
}

export class FindProhibitedCommand {
  private loader: DatasetLoader;

  constructor() {
    this.loader = new DatasetLoader();
  }

  async run(options: FindProhibitedOptions): Promise<void> {
    console.log(chalk.blue(`\n🔍 Finding prohibited content in question ${options.questionId}\n`));

    // Load dataset
    const questions = await this.loader.loadDataset(options.dataset);
    const question = questions.find(q => q.question_id === options.questionId);

    if (!question) {
      console.error(chalk.red(`Question ${options.questionId} not found in ${options.dataset}`));
      return;
    }

    // Get all sessions with metadata (using array format like prepare.ts)
    const sessionsWithMeta: SessionWithMeta[] = question.haystack_sessions.map((session, index) => ({
      session: session as Turn[],
      sessionId: question.haystack_session_ids[index],
      date: question.haystack_dates[index],
      index,
    }));

    // Sort by date
    sessionsWithMeta.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(chalk.gray(`Found ${sessionsWithMeta.length} sessions\n`));

    // First, binary search through sessions to find which ones have prohibited content
    const prohibitedSessions: SessionWithMeta[] = [];

    console.log(chalk.cyan('Phase 1: Binary search to find sessions with prohibited content...\n'));

    // Binary search through sessions to find which ones have prohibited content
    async function binarySearchSessions(start: number, end: number): Promise<void> {
      if (start > end) return;

      if (start === end) {
        // Single session - test it
        const sessionMeta = sessionsWithMeta[start];
        const fullContent = sessionMeta.session.map(m => `${m.role}: ${m.content}`).join('\n\n');
        process.stdout.write(chalk.gray(`  Testing session ${sessionMeta.sessionId}... `));
        try {
          const result = await testContent(fullContent);
          if (result.blocked) {
            console.log(chalk.red('BLOCKED'));
            prohibitedSessions.push(sessionMeta);
          } else {
            console.log(chalk.green('OK'));
          }
        } catch (error: any) {
          console.log(chalk.yellow(`ERROR: ${error.message?.slice(0, 50)}`));
        }
        return;
      }

      const mid = Math.floor((start + end) / 2);

      // Test first half (all sessions combined)
      const firstHalfSessions = sessionsWithMeta.slice(start, mid + 1);
      const firstHalfContent = firstHalfSessions
        .map(s => s.session.map(m => `${m.role}: ${m.content}`).join('\n\n'))
        .join('\n\n---SESSION BREAK---\n\n');
      
      console.log(chalk.gray(`  Testing sessions ${start}-${mid} (${mid - start + 1} sessions)...`));
      const firstResult = await testContent(firstHalfContent);

      // Test second half
      const secondHalfSessions = sessionsWithMeta.slice(mid + 1, end + 1);
      const secondHalfContent = secondHalfSessions
        .map(s => s.session.map(m => `${m.role}: ${m.content}`).join('\n\n'))
        .join('\n\n---SESSION BREAK---\n\n');
      
      console.log(chalk.gray(`  Testing sessions ${mid + 1}-${end} (${end - mid} sessions)...`));
      const secondResult = await testContent(secondHalfContent);

      // Recurse into halves that contain prohibited content
      if (firstResult.blocked) {
        console.log(chalk.yellow(`    Sessions ${start}-${mid} contain prohibited content, drilling down...`));
        await binarySearchSessions(start, mid);
      }
      if (secondResult.blocked) {
        console.log(chalk.yellow(`    Sessions ${mid + 1}-${end} contain prohibited content, drilling down...`));
        await binarySearchSessions(mid + 1, end);
      }
    }

    // First test ALL sessions combined to see if there's any prohibited content
    const allContent = sessionsWithMeta
      .map(s => s.session.map(m => `${m.role}: ${m.content}`).join('\n\n'))
      .join('\n\n---SESSION BREAK---\n\n');
    
    console.log(chalk.gray(`  Testing all ${sessionsWithMeta.length} sessions combined...`));
    const allResult = await testContent(allContent);
    
    if (!allResult.blocked) {
      console.log(chalk.green('\n✅ No prohibited content found in any session!'));
      return;
    }

    console.log(chalk.yellow(`\n  Prohibited content detected! Starting binary search...\n`));
    await binarySearchSessions(0, sessionsWithMeta.length - 1);

    if (prohibitedSessions.length === 0) {
      console.log(chalk.green('\n✅ No prohibited content found in any session!'));
      return;
    }

    console.log(chalk.yellow(`\nFound ${prohibitedSessions.length} session(s) with prohibited content\n`));

    // Phase 2: Find exact messages in each prohibited session
    console.log(chalk.cyan('Phase 2: Finding exact prohibited messages...\n'));

    const results: Array<{
      sessionId: string;
      date: string;
      messageIndices: number[];
      messages: Array<{ index: number; role: string; content: string }>;
    }> = [];

    for (const sessionMeta of prohibitedSessions) {
      console.log(chalk.blue(`\nSearching session ${sessionMeta.sessionId} (${sessionMeta.date})...`));
      
      const prohibitedIndices = await findProhibitedInSession(
        sessionMeta.session,
        sessionMeta.sessionId,
      );

      if (prohibitedIndices.length > 0) {
        results.push({
          sessionId: sessionMeta.sessionId,
          date: sessionMeta.date,
          messageIndices: prohibitedIndices,
          messages: prohibitedIndices.map(idx => ({
            index: idx,
            role: sessionMeta.session[idx].role,
            content: sessionMeta.session[idx].content,
          })),
        });
      }
    }

    // Print summary
    console.log(chalk.blue('\n' + '='.repeat(80)));
    console.log(chalk.blue('SUMMARY'));
    console.log(chalk.blue('='.repeat(80) + '\n'));

    console.log(chalk.white(`Question ID: ${options.questionId}`));
    console.log(chalk.white(`Total sessions: ${sessionsWithMeta.length}`));
    console.log(chalk.white(`Sessions with prohibited content: ${prohibitedSessions.length}`));
    console.log(chalk.white(`Total prohibited messages: ${results.reduce((sum, r) => sum + r.messages.length, 0)}\n`));

    for (const result of results) {
      console.log(chalk.yellow(`\nSession: ${result.sessionId} (${result.date})`));
      console.log(chalk.yellow(`Message indices: ${result.messageIndices.join(', ')}`));
      
      for (const msg of result.messages) {
        console.log(chalk.red(`\n  [${msg.index}] ${msg.role}:`));
        // Truncate long content
        const preview = msg.content.length > 500 
          ? msg.content.slice(0, 500) + '...' 
          : msg.content;
        console.log(chalk.gray(`  ${preview.replace(/\n/g, '\n  ')}`));
      }
    }

    // Output as JSON for programmatic use
    console.log(chalk.blue('\n' + '='.repeat(80)));
    console.log(chalk.blue('JSON OUTPUT'));
    console.log(chalk.blue('='.repeat(80) + '\n'));

    const jsonOutput = {
      questionId: options.questionId,
      dataset: options.dataset,
      totalSessions: sessionsWithMeta.length,
      prohibitedSessions: results.map(r => ({
        sessionId: r.sessionId,
        date: r.date,
        messageIndices: r.messageIndices,
      })),
    };

    console.log(JSON.stringify(jsonOutput, null, 2));
  }
}
