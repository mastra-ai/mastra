import chalk from 'chalk';
import { DatasetLoader } from '../data/loader.js';
import { LongMemEvalQuestion } from '../data/types.js';

type DatasetType = 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle' | 'sample_data';

interface SessionsOptions {
  dataset: DatasetType;
  questionId: string;
  showAll?: boolean;
}

interface Message {
  role: string;
  content: string;
  session_id?: string;
  date?: string;
}

export class SessionsCommand {
  async run(options: SessionsOptions): Promise<void> {
    const { dataset: datasetName, questionId, showAll } = options;

    // Load dataset
    const loader = new DatasetLoader();
    const dataset = await loader.loadDataset(datasetName);

    // Find the question
    const question = dataset.find((q: LongMemEvalQuestion) => q.question_id === questionId);
    if (!question) {
      console.error(chalk.red(`Question ${questionId} not found in dataset ${datasetName}`));
      console.log(chalk.gray('Available question IDs (first 20):'));
      dataset.slice(0, 20).forEach((q: LongMemEvalQuestion) => {
        console.log(chalk.gray(`  ${q.question_id}`));
      });
      return;
    }

    // Display question info
    console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.white(`Question: ${questionId}`));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.yellow('Q:'), question.question);
    console.log(chalk.green('A:'), question.answer);
    console.log(chalk.gray('Type:'), question.question_type);
    console.log(chalk.gray('Date:'), question.question_date);

    if (question.improved_question) {
      console.log(chalk.magenta('Improved Q:'), question.improved_question);
    }
    if (question.improved_answer) {
      console.log(chalk.magenta('Improved A:'), question.improved_answer);
    }
    if (question.improvement_note) {
      console.log(chalk.gray('Note:'), question.improvement_note);
    }

    // Get answer session IDs (those starting with "answer_")
    const answerSessionIds = (question.haystack_session_ids || []).filter((id: string) => id.startsWith('answer_'));

    const sessionIdsToShow = showAll ? question.haystack_session_ids || [] : answerSessionIds;

    if (sessionIdsToShow.length === 0) {
      console.log(chalk.yellow('\nNo sessions found for this question.'));
      return;
    }

    console.log(chalk.bold.cyan(`\n─── ${showAll ? 'All' : 'Answer'} Sessions (${sessionIdsToShow.length}) ───\n`));

    // Get sessions from haystack_sessions
    const haystackSessions = question.haystack_sessions || [];

    for (const sessionId of sessionIdsToShow) {
      // haystack_sessions is parallel to haystack_session_ids - find by index
      const allSessionIds = question.haystack_session_ids || [];
      const sessionIndex = allSessionIds.indexOf(sessionId);
      const session = sessionIndex >= 0 ? haystackSessions[sessionIndex] : null;

      if (!session || !Array.isArray(session)) {
        console.log(chalk.gray(`Session ${sessionId}: (not found in haystack_sessions)`));
        continue;
      }

      // Get date from parallel haystack_dates array
      const haystackDates = question.haystack_dates || [];
      const sessionDate = haystackDates[sessionIndex] || 'Unknown date';

      console.log(chalk.bold.white(`\n┌─ Session: ${sessionId}`));
      console.log(chalk.gray(`│  Date: ${sessionDate}`));
      console.log(chalk.gray('│'));

      for (const msg of session as Message[]) {
        const role = msg.role;
        const content = msg.content || '';
        const roleColor = role === 'user' ? chalk.cyan : chalk.green;
        const roleLabel = role === 'user' ? '👤 User' : '🤖 Assistant';

        // Truncate long messages for readability
        const maxLen = 500;
        const displayContent =
          content.length > maxLen ? content.substring(0, maxLen) + chalk.gray('... (truncated)') : content;

        console.log(chalk.gray('│'));
        console.log(roleColor(`│ ${roleLabel}:`));

        // Indent message content
        const lines = displayContent.split('\n');
        for (const line of lines) {
          console.log(chalk.gray('│   ') + line);
        }
      }

      console.log(chalk.gray('│'));
      console.log(chalk.gray('└─────────────────────────────────────────'));
    }

    // Show summary of other sessions if not showing all
    if (!showAll && question.haystack_session_ids) {
      const otherCount = question.haystack_session_ids.length - answerSessionIds.length;
      if (otherCount > 0) {
        console.log(chalk.gray(`\n(${otherCount} other haystack sessions not shown. Use --all to see all sessions)`));
      }
    }
  }
}
