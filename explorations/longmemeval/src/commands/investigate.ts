import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { DatasetLoader } from '../data/loader';
import { PersistableInMemoryMemory } from '../storage';
import type { LongMemEvalQuestion } from '../data/types';

// ============================================================================
// Types
// ============================================================================

export type FailureCategory =
  | 'observer-miss'
  | 'reflector-loss'
  | 'agent-reasoning'
  | 'ambiguous-question'
  | 'dataset-error'
  | 'rag-miss'
  | 'other';

export interface QuestionProgress {
  status: 'pending' | 'investigated' | 'fix-implemented' | 'synced';
  category?: FailureCategory;
  investigatedAt?: string;
}

export interface InvestigationProgress {
  runId: string;
  config: string;
  dataset: string;
  createdAt: string;
  totalFailed: number;
  investigated: number;
  questions: Record<string, QuestionProgress>;
}

export interface InvestigateOptions {
  runId?: string;
  list?: boolean;
  config?: string;
  status?: boolean;
  next?: boolean;
  done?: string;
  sync?: boolean;
  fixed?: string;      // Mark a question as fix-implemented
  outputDir?: string;
  resultsDir?: string;
  preparedDataDir?: string;
  datasetDir?: string;
  editor?: string;
  // Investigation utilities
  search?: string;        // Search observations for keywords
  trace?: string;         // Trace information flow for a keyword
  questionId?: string;    // Question ID for search/trace/date/session
  inspect?: string;       // Inspect a specific question's data
  date?: string;          // View observations around a specific date (e.g., "2023/05/29" or "May 29")
  context?: number;       // Number of days of context around the date (default: 1)
  session?: number;       // View a specific session from original dataset
  listSessions?: boolean; // List all sessions with dates for a question
  // Data freshness detection
  checkStale?: boolean;   // Check if prepared data is stale (pre-cursor-fix)
  staleOnly?: boolean;    // Only list stale questions from failures
  // Original dataset search
  searchOriginal?: string; // Search original dataset for a keyword
  // Improve question/answer in dataset
  improve?: string;        // Question ID to add improvements for
  improveQuestion?: string; // Improved question text
  improveAnswer?: string;   // Improved answer text
  improveNote?: string;     // Improvement note
}

interface FailuresFile {
  questionIds: string[];
  runId: string;
  config: string;
  dataset: string;
  timestamp: string;
  totalFailed: number;
  totalQuestions: number;
}

interface EvaluationResult {
  question_id: string;
  question: string;
  expected_answer: string;
  hypothesis: string;  // The agent's answer
  is_correct: boolean;
  question_type: string;
  improved_question?: string;
  improved_answer?: string;
  improved_is_correct?: boolean;
  has_improvement_info?: boolean;
  improved_regression?: boolean;
}

// ============================================================================
// Analysis Template
// ============================================================================

function generateAnalysisTemplate(
  questionId: string,
  question: string,
  expectedAnswer: string,
  actualAnswer: string,
  questionType: string,
  improvedQuestion?: string,
  improvedAnswer?: string,
): string {
  return `# Investigation: ${questionId}

## Question Type
${questionType}

## Question
${question}

## Expected Answer
${expectedAnswer}

## Agent Answer
${actualAnswer}

${improvedQuestion ? `## Improved Question (existing)\n${improvedQuestion}\n` : ''}
${improvedAnswer ? `## Improved Answer (existing)\n${improvedAnswer}\n` : ''}

---

## Failure Category
- [ ] Observer missed critical information
- [ ] Reflector lost/merged information incorrectly
- [ ] Agent reasoning error (had info, wrong conclusion)
- [ ] Ambiguous/poorly-worded question
- [ ] Dataset inconsistency/error
- [ ] RAG retrieval miss (if applicable)
- [ ] Other: ___

## Root Cause Analysis
<!-- What specifically went wrong? -->


## Evidence
<!-- Quote relevant parts of om.md, original data, etc. -->


---

## Potential Improvements

### Observer/Reflector Changes
- **Likelihood**: Low / Medium / High
- **Reasoning**: 
- **Suggested prompt change**:

### Fixed Question/Answer
- **Likelihood**: Low / Medium / High
- **improved_question**: 
- **improved_answer**: 
- **improvement_note**: 

### Other Improvements
<!-- Prompt changes, architectural changes, etc. -->


---

## Status
- [ ] Investigated
- [ ] Fix implemented
- [ ] Synced to longmemeval_s.json
`;
}

// ============================================================================
// Investigation Command
// ============================================================================

export class InvestigateCommand {
  private investigationsDir: string;
  private resultsDir: string;
  private preparedDataDir: string;
  private datasetDir: string;
  private editor: string;

  constructor(options: InvestigateOptions = {}) {
    this.investigationsDir = options.outputDir || './investigations';
    this.resultsDir = options.resultsDir || './results';
    this.preparedDataDir = options.preparedDataDir || './prepared-data';
    this.datasetDir = options.datasetDir || './data';
    this.editor = options.editor || process.env.EDITOR || 'code';
  }

  async run(options: InvestigateOptions): Promise<void> {
    // Handle different modes
    if (options.list) {
      await this.listFailures(options.config);
      return;
    }

    if (options.status) {
      await this.showStatus();
      return;
    }

    if (options.next) {
      await this.openNext();
      return;
    }

    if (options.done) {
      await this.markDone(options.done);
      return;
    }

    if (options.fixed) {
      await this.markFixed(options.fixed);
      return;
    }

    if (options.sync) {
      await this.syncToDataset();
      return;
    }

    // Investigation utilities
    if (options.inspect) {
      await this.inspectQuestion(options.inspect);
      return;
    }

    if (options.search && options.questionId) {
      await this.searchObservations(options.questionId, options.search);
      return;
    }

    if (options.trace && options.questionId) {
      await this.traceInformation(options.questionId, options.trace);
      return;
    }

    // Date-based observation viewer
    if (options.date && options.questionId) {
      await this.viewObservationsAroundDate(options.questionId, options.date, options.context ?? 1);
      return;
    }

    // Session viewer
    if (options.listSessions && options.questionId) {
      await this.listSessions(options.questionId);
      return;
    }

    if (options.session !== undefined && options.questionId) {
      await this.viewSession(options.questionId, options.session);
      return;
    }

    // Data freshness detection
    if (options.checkStale) {
      await this.checkStaleData(options.questionId, options.staleOnly);
      return;
    }

    // Original dataset search
    if (options.searchOriginal && options.questionId) {
      await this.searchOriginalDataset(options.questionId, options.searchOriginal);
      return;
    }

    // Improve question/answer in dataset
    if (options.improve) {
      await this.addImprovement(options.improve, options.improveQuestion, options.improveAnswer, options.improveNote);
      return;
    }

    // Default: setup investigation from run
    if (options.runId) {
      await this.setupInvestigation(options.runId);
      return;
    }

    // No args: show help
    this.showHelp();
  }

  // --------------------------------------------------------------------------
  // List Failures
  // --------------------------------------------------------------------------

  private async listFailures(configFilter?: string): Promise<void> {
    console.log('\n🔍 Scanning for benchmark runs with failures...\n');

    interface RunInfo {
      runId: string;
      config: string;
      dataset: string;
      timestamp: string;
      totalFailed: number;
      totalQuestions: number;
      failuresPath: string;
    }

    const runs: RunInfo[] = [];

    // Scan results directory for all configs
    if (!existsSync(this.resultsDir)) {
      console.log('No results directory found.');
      return;
    }

    const configs = await readdir(this.resultsDir);
    
    for (const config of configs) {
      // Skip if filtering by config and doesn't match
      if (configFilter && !config.includes(configFilter)) {
        continue;
      }

      const configDir = join(this.resultsDir, config);
      const stat = await import('fs/promises').then(fs => fs.stat(configDir));
      if (!stat.isDirectory()) continue;

      const runDirs = await readdir(configDir);
      
      for (const runDir of runDirs) {
        if (!runDir.startsWith('run_')) continue;
        
        const failuresPath = join(configDir, runDir, 'failures.json');
        if (!existsSync(failuresPath)) continue;

        try {
          const failures = JSON.parse(await readFile(failuresPath, 'utf-8')) as FailuresFile;
          runs.push({
            runId: failures.runId,
            config: failures.config,
            dataset: failures.dataset,
            timestamp: failures.timestamp,
            totalFailed: failures.totalFailed,
            totalQuestions: failures.totalQuestions,
            failuresPath,
          });
        } catch {
          // Skip invalid files
        }
      }
    }

    if (runs.length === 0) {
      console.log('No runs with failures found.');
      return;
    }

    // Sort by timestamp (newest first)
    runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Group by config
    const byConfig = new Map<string, RunInfo[]>();
    for (const run of runs) {
      const key = `${run.dataset}/${run.config}`;
      if (!byConfig.has(key)) {
        byConfig.set(key, []);
      }
      byConfig.get(key)!.push(run);
    }

    // Display
    console.log(`Found ${runs.length} runs with failures across ${byConfig.size} configs:\n`);

    for (const [configKey, configRuns] of byConfig) {
      console.log(`📁 ${configKey}`);
      
      // Show latest run prominently
      const latest = configRuns[0];
      const failRate = ((latest.totalFailed / latest.totalQuestions) * 100).toFixed(1);
      console.log(`   Latest: ${latest.runId}`);
      console.log(`   Failed: ${latest.totalFailed}/${latest.totalQuestions} (${failRate}%)`);
      console.log(`   Date:   ${new Date(latest.timestamp).toLocaleString()}`);
      
      if (configRuns.length > 1) {
        console.log(`   (${configRuns.length - 1} older runs)`);
      }
      console.log();
    }

    // Show usage hint
    console.log('To investigate a run:');
    console.log(`  pnpm investigate <run-id>`);
    console.log(`  pnpm investigate ${runs[0].runId}`);
  }

  // --------------------------------------------------------------------------
  // Setup Investigation
  // --------------------------------------------------------------------------

  private async setupInvestigation(runIdOrPath: string): Promise<void> {
    console.log(`\n🔍 Setting up investigation for: ${runIdOrPath}\n`);

    // Find the failures.json file
    const { failuresPath, failures } = await this.findFailures(runIdOrPath);
    console.log(`📁 Found failures file: ${failuresPath}`);
    console.log(`   Config: ${failures.config}`);
    console.log(`   Dataset: ${failures.dataset}`);
    console.log(`   Failed: ${failures.totalFailed}/${failures.totalQuestions}`);

    // Create investigation directory
    const investigationDir = join(this.investigationsDir, failures.runId);
    await mkdir(investigationDir, { recursive: true });

    // Load existing progress or create new
    const progressPath = join(investigationDir, 'progress.json');
    let progress: InvestigationProgress;

    if (existsSync(progressPath)) {
      progress = JSON.parse(await readFile(progressPath, 'utf-8'));
      console.log(`\n📊 Resuming existing investigation (${progress.investigated}/${progress.totalFailed} done)`);
    } else {
      progress = {
        runId: failures.runId,
        config: failures.config,
        dataset: failures.dataset,
        createdAt: new Date().toISOString(),
        totalFailed: failures.totalFailed,
        investigated: 0,
        questions: {},
      };

      for (const qid of failures.questionIds) {
        progress.questions[qid] = { status: 'pending' };
      }
    }

    // Load results.jsonl to get actual answers
    const resultsDir = dirname(failuresPath);
    const resultsPath = join(resultsDir, 'results.jsonl');
    const resultsMap = new Map<string, EvaluationResult>();

    if (existsSync(resultsPath)) {
      const resultsContent = await readFile(resultsPath, 'utf-8');
      for (const line of resultsContent.split('\n').filter(l => l.trim())) {
        try {
          const result = JSON.parse(line) as EvaluationResult;
          resultsMap.set(result.question_id, result);
        } catch {
          // Skip invalid lines
        }
      }
    }

    // Load dataset for original questions
    const loader = new DatasetLoader(this.datasetDir);
    const dataset = await loader.loadDataset(failures.dataset as 'longmemeval_s' | 'longmemeval_m');
    const questionMap = new Map<string, LongMemEvalQuestion>();
    for (const q of dataset) {
      questionMap.set(q.question_id, q);
    }

    // Setup each failed question
    let created = 0;
    let skipped = 0;

    for (const questionId of failures.questionIds) {
      const questionDir = join(investigationDir, questionId);
      const dataDir = join(questionDir, 'data');
      const analysisPath = join(questionDir, 'analysis.md');

      // Skip if already exists
      if (existsSync(analysisPath)) {
        skipped++;
        continue;
      }

      await mkdir(dataDir, { recursive: true });

      // Get question data
      const question = questionMap.get(questionId);
      const result = resultsMap.get(questionId);

      if (!question) {
        console.warn(`  ⚠️  Question ${questionId} not found in dataset`);
        continue;
      }

      // Copy original question data
      await writeFile(
        join(dataDir, 'original.json'),
        JSON.stringify(question, null, 2),
      );

      // Copy result if available
      if (result) {
        await writeFile(
          join(dataDir, 'result.json'),
          JSON.stringify(result, null, 2),
        );
      }

      // Copy prepared data files
      const preparedDir = join(
        this.preparedDataDir,
        failures.dataset,
        failures.config,
        questionId,
      );

      const filesToCopy = ['om.md', 'om.json', 'meta.json'];
      for (const file of filesToCopy) {
        const srcPath = join(preparedDir, file);
        if (existsSync(srcPath)) {
          const content = await readFile(srcPath, 'utf-8');
          await writeFile(join(dataDir, file), content);
        }
      }

      // Generate analysis template
      const template = generateAnalysisTemplate(
        questionId,
        question.question,
        question.answer,
        result?.hypothesis || '(not available)',
        question.question_type,
        question.improved_question,
        question.improved_answer,
      );

      await writeFile(analysisPath, template);
      created++;
    }

    // Save progress
    await writeFile(progressPath, JSON.stringify(progress, null, 2));

    console.log(`\n✅ Investigation setup complete!`);
    console.log(`   Created: ${created} new question directories`);
    console.log(`   Skipped: ${skipped} existing directories`);
    console.log(`   Location: ${investigationDir}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   pnpm investigate --status              # Check progress`);
    console.log(`   pnpm investigate --next                # Open next question`);
    console.log(`   pnpm investigate --done <question-id>  # Mark as investigated`);
  }

  // --------------------------------------------------------------------------
  // Status
  // --------------------------------------------------------------------------

  private async showStatus(): Promise<void> {
    const investigations = await this.listInvestigations();

    if (investigations.length === 0) {
      console.log('\n📭 No investigations found.');
      console.log('   Run: pnpm investigate <run-id> to start one.\n');
      return;
    }

    console.log('\n📊 Investigation Status\n');

    for (const inv of investigations) {
      const progress = await this.loadProgress(inv);
      if (!progress) continue;

      const pending = Object.values(progress.questions).filter(q => q.status === 'pending').length;
      const investigated = Object.values(progress.questions).filter(q => q.status === 'investigated').length;
      const fixImplemented = Object.values(progress.questions).filter(q => q.status === 'fix-implemented').length;
      const synced = Object.values(progress.questions).filter(q => q.status === 'synced').length;

      const pct = ((progress.totalFailed - pending) / progress.totalFailed * 100).toFixed(1);

      console.log(`📁 ${inv}`);
      console.log(`   Config: ${progress.config}`);
      console.log(`   Progress: ${progress.totalFailed - pending}/${progress.totalFailed} (${pct}%)`);
      console.log(`   ├─ Pending: ${pending}`);
      console.log(`   ├─ Investigated: ${investigated}`);
      console.log(`   ├─ Fix Implemented: ${fixImplemented}`);
      console.log(`   └─ Synced: ${synced}`);

      // Show category breakdown if any investigated
      if (investigated + fixImplemented + synced > 0) {
        const categories = new Map<string, number>();
        for (const q of Object.values(progress.questions)) {
          if (q.category) {
            categories.set(q.category, (categories.get(q.category) || 0) + 1);
          }
        }

        if (categories.size > 0) {
          console.log(`   Categories:`);
          for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
            console.log(`     ${cat}: ${count}`);
          }
        }
      }

      console.log('');
    }
  }

  // --------------------------------------------------------------------------
  // Open Next
  // --------------------------------------------------------------------------

  private async openNext(): Promise<void> {
    const investigations = await this.listInvestigations();

    if (investigations.length === 0) {
      console.log('\n📭 No investigations found.\n');
      return;
    }

    // Use most recent investigation
    const latestInv = investigations[investigations.length - 1];
    const progress = await this.loadProgress(latestInv);

    if (!progress) {
      console.log('\n❌ Could not load progress.\n');
      return;
    }

    // Find next pending question
    const pendingId = Object.entries(progress.questions)
      .find(([_, q]) => q.status === 'pending')?.[0];

    if (!pendingId) {
      console.log('\n🎉 All questions investigated!\n');
      return;
    }

    const analysisPath = join(this.investigationsDir, latestInv, pendingId, 'analysis.md');

    if (!existsSync(analysisPath)) {
      console.log(`\n❌ Analysis file not found: ${analysisPath}\n`);
      return;
    }

    console.log(`\n📝 Opening: ${pendingId}`);
    console.log(`   File: ${analysisPath}`);
    console.log(`   Editor: ${this.editor}\n`);

    // Open in editor
    const { spawn } = await import('child_process');
    spawn(this.editor, [analysisPath], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    // Also print some context
    const dataDir = join(this.investigationsDir, latestInv, pendingId, 'data');
    const resultPath = join(dataDir, 'result.json');

    if (existsSync(resultPath)) {
      const result = JSON.parse(await readFile(resultPath, 'utf-8')) as EvaluationResult;
      console.log(`📋 Quick Context:`);
      console.log(`   Type: ${result.question_type}`);
      console.log(`   Q: ${result.question.substring(0, 100)}...`);
      console.log(`   Expected: ${result.expected_answer.substring(0, 100)}...`);
      console.log(`   Got: ${result.hypothesis.substring(0, 100)}...`);
      console.log('');
    }

    console.log(`When done, run: pnpm investigate --done ${pendingId}\n`);
  }

  // --------------------------------------------------------------------------
  // Mark Done
  // --------------------------------------------------------------------------

  private async markDone(questionId: string): Promise<void> {
    const investigations = await this.listInvestigations();

    if (investigations.length === 0) {
      console.log('\n📭 No investigations found.\n');
      return;
    }

    // Find investigation containing this question
    let foundInv: string | null = null;
    let progress: InvestigationProgress | null = null;

    for (const inv of investigations) {
      const p = await this.loadProgress(inv);
      if (p && questionId in p.questions) {
        foundInv = inv;
        progress = p;
        break;
      }
    }

    if (!foundInv || !progress) {
      console.log(`\n❌ Question ${questionId} not found in any investigation.\n`);
      return;
    }

    // Parse analysis.md to extract category
    const analysisPath = join(this.investigationsDir, foundInv, questionId, 'analysis.md');
    let category: FailureCategory | undefined;

    if (existsSync(analysisPath)) {
      const content = await readFile(analysisPath, 'utf-8');
      category = this.extractCategory(content);
    }

    // Update progress
    progress.questions[questionId] = {
      status: 'investigated',
      category,
      investigatedAt: new Date().toISOString(),
    };

    progress.investigated = Object.values(progress.questions)
      .filter(q => q.status !== 'pending').length;

    // Save progress
    const progressPath = join(this.investigationsDir, foundInv, 'progress.json');
    await writeFile(progressPath, JSON.stringify(progress, null, 2));

    const remaining = progress.totalFailed - progress.investigated;
    console.log(`\n✅ Marked ${questionId} as investigated`);
    if (category) {
      console.log(`   Category: ${category}`);
    }
    console.log(`   Progress: ${progress.investigated}/${progress.totalFailed}`);
    console.log(`   Remaining: ${remaining}`);

    if (remaining > 0) {
      console.log(`\n   Run: pnpm investigate --next\n`);
    } else {
      console.log(`\n🎉 All questions investigated!`);
      console.log(`   Run: pnpm investigate --sync to sync fixes to dataset\n`);
    }
  }

  private async markFixed(questionId: string): Promise<void> {
    const investigations = await this.listInvestigations();

    if (investigations.length === 0) {
      console.log('\n📭 No investigations found.\n');
      return;
    }

    // Find investigation containing this question
    let foundInv: string | null = null;
    let progress: InvestigationProgress | null = null;

    for (const inv of investigations) {
      const p = await this.loadProgress(inv);
      if (p && questionId in p.questions) {
        foundInv = inv;
        progress = p;
        break;
      }
    }

    if (!foundInv || !progress) {
      console.log(`\n❌ Question ${questionId} not found in any investigation.\n`);
      return;
    }

    const currentStatus = progress.questions[questionId]?.status;
    if (currentStatus === 'pending') {
      console.log(`\n⚠️  Question ${questionId} hasn't been investigated yet.`);
      console.log(`   Run: pnpm investigate --done ${questionId} first\n`);
      return;
    }

    // Update status to fix-implemented
    progress.questions[questionId] = {
      ...progress.questions[questionId],
      status: 'fix-implemented',
    };

    // Save progress
    const progressPath = join(this.investigationsDir, foundInv, 'progress.json');
    await writeFile(progressPath, JSON.stringify(progress, null, 2));

    const fixedCount = Object.values(progress.questions)
      .filter(q => q.status === 'fix-implemented' || q.status === 'synced').length;

    console.log(`\n✅ Marked ${questionId} as fix-implemented`);
    console.log(`   Fixed: ${fixedCount}/${progress.totalFailed}`);
    console.log(`\n   When ready, run: pnpm investigate --sync\n`);
  }

  // --------------------------------------------------------------------------
  // Sync to Dataset
  // --------------------------------------------------------------------------

  private async syncToDataset(): Promise<void> {
    const investigations = await this.listInvestigations();

    if (investigations.length === 0) {
      console.log('\n📭 No investigations found.\n');
      return;
    }

    // Use most recent investigation
    const latestInv = investigations[investigations.length - 1];
    const progress = await this.loadProgress(latestInv);

    if (!progress) {
      console.log('\n❌ Could not load progress.\n');
      return;
    }

    // Load dataset
    const datasetPath = join(this.datasetDir, `${progress.dataset}.json`);
    if (!existsSync(datasetPath)) {
      console.log(`\n❌ Dataset not found: ${datasetPath}\n`);
      return;
    }

    const dataset = JSON.parse(await readFile(datasetPath, 'utf-8')) as LongMemEvalQuestion[];
    const datasetMap = new Map<string, LongMemEvalQuestion>();
    for (const q of dataset) {
      datasetMap.set(q.question_id, q);
    }

    let synced = 0;
    let skipped = 0;

    console.log(`\n🔄 Syncing fixes to ${progress.dataset}.json...\n`);

    for (const [questionId, qProgress] of Object.entries(progress.questions)) {
      if (qProgress.status === 'pending') {
        continue;
      }

      const analysisPath = join(this.investigationsDir, latestInv, questionId, 'analysis.md');
      if (!existsSync(analysisPath)) {
        continue;
      }

      const content = await readFile(analysisPath, 'utf-8');
      const fixes = this.extractFixes(content);

      if (!fixes.improved_question && !fixes.improved_answer && !fixes.improvement_note) {
        skipped++;
        continue;
      }

      const question = datasetMap.get(questionId);
      if (!question) {
        console.warn(`  ⚠️  Question ${questionId} not found in dataset`);
        continue;
      }

      // Update question
      let updated = false;
      if (fixes.improved_question && fixes.improved_question !== question.improved_question) {
        question.improved_question = fixes.improved_question;
        updated = true;
      }
      if (fixes.improved_answer && fixes.improved_answer !== question.improved_answer) {
        question.improved_answer = fixes.improved_answer;
        updated = true;
      }
      if (fixes.improvement_note && fixes.improvement_note !== question.improvement_note) {
        question.improvement_note = fixes.improvement_note;
        updated = true;
      }

      if (updated) {
        console.log(`  ✓ ${questionId}`);
        synced++;

        // Update progress status
        progress.questions[questionId].status = 'synced';
      } else {
        skipped++;
      }
    }

    // Save dataset
    await writeFile(datasetPath, JSON.stringify(dataset, null, 2));

    // Save progress
    const progressPath = join(this.investigationsDir, latestInv, 'progress.json');
    await writeFile(progressPath, JSON.stringify(progress, null, 2));

    console.log(`\n✅ Sync complete!`);
    console.log(`   Synced: ${synced}`);
    console.log(`   Skipped: ${skipped} (no changes or pending)`);
    console.log(`\n💡 Don't forget to run: pnpm run sync-improved-om-qa\n`);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async findFailures(runIdOrPath: string): Promise<{ failuresPath: string; failures: FailuresFile }> {
    // Check if it's a direct path
    if (existsSync(runIdOrPath)) {
      const content = await readFile(runIdOrPath, 'utf-8');
      return { failuresPath: runIdOrPath, failures: JSON.parse(content) };
    }

    // Search in results directory
    const configs = await readdir(this.resultsDir).catch(() => []);

    for (const config of configs) {
      const configDir = join(this.resultsDir, config);
      const runs = await readdir(configDir).catch(() => []);

      for (const run of runs) {
        if (run === runIdOrPath || run.includes(runIdOrPath)) {
          const failuresPath = join(configDir, run, 'failures.json');
          if (existsSync(failuresPath)) {
            const content = await readFile(failuresPath, 'utf-8');
            return { failuresPath, failures: JSON.parse(content) };
          }
        }
      }
    }

    throw new Error(`Could not find failures.json for: ${runIdOrPath}`);
  }

  private async listInvestigations(): Promise<string[]> {
    if (!existsSync(this.investigationsDir)) {
      return [];
    }

    const entries = await readdir(this.investigationsDir);
    const investigations: string[] = [];

    for (const entry of entries) {
      const progressPath = join(this.investigationsDir, entry, 'progress.json');
      if (existsSync(progressPath)) {
        investigations.push(entry);
      }
    }

    return investigations.sort();
  }

  private async loadProgress(investigation: string): Promise<InvestigationProgress | null> {
    const progressPath = join(this.investigationsDir, investigation, 'progress.json');
    if (!existsSync(progressPath)) {
      return null;
    }

    return JSON.parse(await readFile(progressPath, 'utf-8'));
  }

  private extractCategory(content: string): FailureCategory | undefined {
    const categoryMap: Record<string, FailureCategory> = {
      'Observer missed critical information': 'observer-miss',
      'Reflector lost/merged information incorrectly': 'reflector-loss',
      'Agent reasoning error': 'agent-reasoning',
      'Ambiguous/poorly-worded question': 'ambiguous-question',
      'Dataset inconsistency/error': 'dataset-error',
      'RAG retrieval miss': 'rag-miss',
    };

    for (const [text, category] of Object.entries(categoryMap)) {
      // Look for checked checkbox
      const pattern = new RegExp(`\\[x\\]\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (pattern.test(content)) {
        return category;
      }
    }

    // Check for "Other"
    if (/\[x\]\s*Other:/i.test(content)) {
      return 'other';
    }

    return undefined;
  }

  private extractFixes(content: string): {
    improved_question?: string;
    improved_answer?: string;
    improvement_note?: string;
  } {
    const fixes: {
      improved_question?: string;
      improved_answer?: string;
      improvement_note?: string;
    } = {};

    // Extract improved_question
    const iqMatch = content.match(/\*\*improved_question\*\*:\s*(.+?)(?:\n|$)/);
    if (iqMatch && iqMatch[1].trim() && !iqMatch[1].trim().startsWith('<!--')) {
      fixes.improved_question = iqMatch[1].trim();
    }

    // Extract improved_answer
    const iaMatch = content.match(/\*\*improved_answer\*\*:\s*(.+?)(?:\n|$)/);
    if (iaMatch && iaMatch[1].trim() && !iaMatch[1].trim().startsWith('<!--')) {
      fixes.improved_answer = iaMatch[1].trim();
    }

    // Extract improvement_note
    const inMatch = content.match(/\*\*improvement_note\*\*:\s*(.+?)(?:\n|$)/);
    if (inMatch && inMatch[1].trim() && !inMatch[1].trim().startsWith('<!--')) {
      fixes.improvement_note = inMatch[1].trim();
    }

    return fixes;
  }

  // --------------------------------------------------------------------------
  // Investigation Utilities
  // --------------------------------------------------------------------------

  /**
   * Inspect a question's data - shows observations, messages, and metadata
   */
  private async inspectQuestion(questionId: string): Promise<void> {
    console.log(`\n🔍 Inspecting question: ${questionId}\n`);

    // Find the question in prepared data
    const { omPath, config, dataset } = await this.findPreparedData(questionId);
    
    if (!omPath) {
      console.log(`❌ No prepared data found for question ${questionId}`);
      return;
    }

    console.log(`📁 Found in: ${dataset}/${config}`);

    // Load using storage adapter
    const storage = new PersistableInMemoryMemory({ readOnly: true });
    await storage.hydrate(omPath);
    const stats = storage.getStats();

    console.log(`\n📊 Storage Stats:`);
    console.log(`   Threads: ${stats.threads}`);
    console.log(`   Messages: ${stats.messages}`);
    console.log(`   OM Records: ${stats.observationalMemoryRecords}`);

    // Get OM records - use resource scope (null threadId)
    // Note: resourceId in storage is prefixed with "resource_"
    const resourceId = `resource_${questionId}`;
    const omRecords = await storage.getObservationalMemoryHistory(null, resourceId);
    
    if (omRecords.length === 0) {
      console.log(`\n⚠️  No observational memory records found`);
      return;
    }

    const latestRecord = omRecords[0]; // Most recent is first
    
    console.log(`\n📝 Latest OM Record:`);
    console.log(`   Created: ${latestRecord.createdAt}`);
    console.log(`   Last Observed: ${latestRecord.lastObservedAt}`);
    console.log(`   Patterns: ${latestRecord.patterns?.length || 0}`);

    // Show observation stats
    const observations = latestRecord.activeObservations || '';
    const lines = observations.split('\n').filter((l: string) => l.trim());
    const dateHeaders = lines.filter((l: string) => /^Date:/i.test(l.trim()));
    const threadHeaders = lines.filter((l: string) => /<thread\s+id=/i.test(l));

    console.log(`\n📋 Observations:`);
    console.log(`   Total lines: ${lines.length}`);
    console.log(`   Date groups: ${dateHeaders.length}`);
    console.log(`   Thread sections: ${threadHeaders.length}`);

    // Show first few and last few lines
    console.log(`\n   First 5 lines:`);
    lines.slice(0, 5).forEach((l: string) => console.log(`     ${l.substring(0, 100)}${l.length > 100 ? '...' : ''}`));
    
    if (lines.length > 10) {
      console.log(`\n   Last 5 lines:`);
      lines.slice(-5).forEach((l: string) => console.log(`     ${l.substring(0, 100)}${l.length > 100 ? '...' : ''}`));
    }

    console.log(`\n💡 Use --search to find specific content:`);
    console.log(`   pnpm investigate --search "sneaker" -q ${questionId}`);
  }

  /**
   * Search observations for keywords
   */
  private async searchObservations(questionId: string, keyword: string): Promise<void> {
    console.log(`\n🔍 Searching for "${keyword}" in question ${questionId}\n`);

    const { omPath } = await this.findPreparedData(questionId);
    
    if (!omPath) {
      console.log(`❌ No prepared data found for question ${questionId}`);
      return;
    }

    // Load using storage adapter
    const storage = new PersistableInMemoryMemory({ readOnly: true });
    await storage.hydrate(omPath);

    // Note: resourceId in storage is prefixed with "resource_"
    const resourceId = `resource_${questionId}`;

    // Search in observations
    const omRecords = await storage.getObservationalMemoryHistory(null, resourceId);
    const latestRecord = omRecords[0];
    const observations = latestRecord?.activeObservations || '';

    const keywordLower = keyword.toLowerCase();
    const obsLines = observations.split('\n');
    const obsMatches = obsLines
      .map((line: string, idx: number) => ({ line, idx }))
      .filter(({ line }: { line: string }) => line.toLowerCase().includes(keywordLower));

    console.log(`📋 Observations (${obsMatches.length} matches):`);
    if (obsMatches.length === 0) {
      console.log(`   No matches found in observations`);
    } else {
      for (const { line, idx } of obsMatches) {
        // Highlight the keyword
        const highlighted = line.replace(
          new RegExp(`(${keyword})`, 'gi'),
          '\x1b[33m$1\x1b[0m'
        );
        console.log(`   [${idx}] ${highlighted.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
      }
    }

    // Search in raw messages
    const messagesResult = await storage.listMessages({ resourceId, perPage: false });
    const messages = messagesResult.messages;
    const msgMatches = messages.filter((m: any) => {
      const content = typeof m.content === 'string' 
        ? m.content 
        : JSON.stringify(m.content);
      return content.toLowerCase().includes(keywordLower);
    });

    console.log(`\n💬 Raw Messages (${msgMatches.length} matches):`);
    if (msgMatches.length === 0) {
      console.log(`   No matches found in raw messages`);
    } else {
      for (const msg of msgMatches.slice(0, 10)) {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        const highlighted = content.replace(
          new RegExp(`(${keyword})`, 'gi'),
          '\x1b[33m$1\x1b[0m'
        );
        const date = msg.createdAt ? new Date(msg.createdAt).toISOString().split('T')[0] : 'unknown';
        console.log(`   [${date}] ${msg.role}: ${highlighted.substring(0, 120)}${content.length > 120 ? '...' : ''}`);
      }
      if (msgMatches.length > 10) {
        console.log(`   ... and ${msgMatches.length - 10} more`);
      }
    }

    // Summary
    const inObs = obsMatches.length > 0;
    const inRaw = msgMatches.length > 0;
    
    console.log(`\n📊 Summary:`);
    if (inRaw && !inObs) {
      console.log(`   ⚠️  Found in raw messages but NOT in observations`);
      console.log(`   → Likely an Observer miss`);
    } else if (inObs && inRaw) {
      console.log(`   ✓ Found in both raw messages and observations`);
    } else if (!inRaw && !inObs) {
      console.log(`   ❌ Not found in raw data or observations`);
    }
  }

  /**
   * Search original dataset for a keyword and show full context
   */
  private async searchOriginalDataset(questionId: string, keyword: string): Promise<void> {
    console.log(`\n🔍 Searching original dataset for "${keyword}" in question ${questionId}\n`);

    const loader = new DatasetLoader(this.datasetDir);
    const dataset = await loader.loadDataset('longmemeval_s');
    const question = dataset.find(q => q.question_id === questionId);

    if (!question?.haystack_sessions || !question?.haystack_dates) {
      console.log(`❌ Question not found or has no sessions`);
      return;
    }

    const keywordLower = keyword.toLowerCase();
    let totalMatches = 0;

    for (let sessionIdx = 0; sessionIdx < question.haystack_sessions.length; sessionIdx++) {
      const session = question.haystack_sessions[sessionIdx];
      const date = question.haystack_dates[sessionIdx] || 'unknown';

      for (let turnIdx = 0; turnIdx < session.length; turnIdx++) {
        const turn = session[turnIdx];
        const content = turn.content || '';
        
        if (content.toLowerCase().includes(keywordLower)) {
          totalMatches++;
          const roleColor = turn.role === 'user' ? '\x1b[36m' : '\x1b[90m';
          const reset = '\x1b[0m';
          const yellow = '\x1b[33m';
          
          // Highlight the keyword
          const highlighted = content.replace(
            new RegExp(`(${keyword})`, 'gi'),
            `${yellow}$1${reset}`
          );
          
          console.log(`${'─'.repeat(70)}`);
          console.log(`📅 Session ${sessionIdx}, Turn ${turnIdx} | ${date}`);
          console.log(`${roleColor}[${turn.role.toUpperCase()}]:${reset}`);
          console.log(highlighted);
          console.log();
        }
      }
    }

    if (totalMatches === 0) {
      console.log(`❌ No matches found for "${keyword}" in original dataset`);
    } else {
      console.log(`${'─'.repeat(70)}`);
      console.log(`\n📊 Total: ${totalMatches} matches across ${question.haystack_sessions.length} sessions`);
    }
  }

  /**
   * Trace information flow for a keyword through the pipeline
   */
  private async traceInformation(questionId: string, keyword: string): Promise<void> {
    console.log(`\n🔍 Tracing "${keyword}" through pipeline for ${questionId}\n`);

    const { omPath, config, dataset, questionDir } = await this.findPreparedData(questionId);
    
    if (!omPath) {
      console.log(`❌ No prepared data found for question ${questionId}`);
      return;
    }

    const keywordLower = keyword.toLowerCase();

    // 1. Check original dataset
    console.log(`\n1️⃣  Original Dataset:`);
    const loader = new DatasetLoader(this.datasetDir);
    const datasetName = dataset as 'longmemeval_s' | 'longmemeval_m';
    const questions = await loader.loadDataset(datasetName);
    const question = questions.find(q => q.question_id === questionId);
    
    if (question) {
      // Search in haystack sessions
      let sessionMatches = 0;
      const matchingSessions: { idx: number; turnIdx: number; role: string; preview: string }[] = [];
      
      if (question.haystack_sessions) {
        for (let sIdx = 0; sIdx < question.haystack_sessions.length; sIdx++) {
          const session = question.haystack_sessions[sIdx];
          for (let tIdx = 0; tIdx < session.length; tIdx++) {
            const turn = session[tIdx];
            if (turn.content.toLowerCase().includes(keywordLower)) {
              sessionMatches++;
              if (matchingSessions.length < 5) {
                matchingSessions.push({
                  idx: sIdx,
                  turnIdx: tIdx,
                  role: turn.role,
                  preview: turn.content.substring(0, 100),
                });
              }
            }
          }
        }
      }

      console.log(`   Found in ${sessionMatches} session turns`);
      for (const m of matchingSessions) {
        const highlighted = m.preview.replace(
          new RegExp(`(${keyword})`, 'gi'),
          '\x1b[33m$1\x1b[0m'
        );
        console.log(`   Session ${m.idx}, Turn ${m.turnIdx} (${m.role}): ${highlighted}...`);
      }
      if (sessionMatches > 5) {
        console.log(`   ... and ${sessionMatches - 5} more`);
      }
    }

    // 2. Check stored messages
    console.log(`\n2️⃣  Stored Messages (om.json):`);
    const storage = new PersistableInMemoryMemory({ readOnly: true });
    await storage.hydrate(omPath);
    
    // Note: resourceId in storage is prefixed with "resource_"
    const resourceId = `resource_${questionId}`;
    
    const messagesResult = await storage.listMessages({ resourceId, perPage: false });
    const allMessages = messagesResult.messages;
    const msgMatches = allMessages.filter((m: any) => {
      const content = typeof m.content === 'string' 
        ? m.content 
        : JSON.stringify(m.content);
      return content.toLowerCase().includes(keywordLower);
    });
    
    console.log(`   Found in ${msgMatches.length} messages`);
    for (const msg of msgMatches.slice(0, 3)) {
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : JSON.stringify(msg.content);
      const date = msg.createdAt ? new Date(msg.createdAt).toISOString() : 'unknown';
      console.log(`   [${date}] ${msg.role}: ${content.substring(0, 80)}...`);
    }

    // 3. Check observations
    console.log(`\n3️⃣  Observations (activeObservations):`);
    const omRecords = await storage.getObservationalMemoryHistory(null, resourceId);
    const latestRecord = omRecords[0]; // Most recent is first
    const observations = latestRecord?.activeObservations || '';
    
    const obsLines = observations.split('\n');
    const obsMatches = obsLines.filter((l: string) => l.toLowerCase().includes(keywordLower));
    
    console.log(`   Found in ${obsMatches.length} observation lines`);
    for (const line of obsMatches.slice(0, 5)) {
      const highlighted = line.replace(
        new RegExp(`(${keyword})`, 'gi'),
        '\x1b[33m$1\x1b[0m'
      );
      console.log(`   ${highlighted.substring(0, 100)}...`);
    }

    // 4. Check agent context (om.md)
    console.log(`\n4️⃣  Agent Context (om.md):`);
    const omMdPath = join(questionDir, 'om.md');
    if (existsSync(omMdPath)) {
      const omMd = await readFile(omMdPath, 'utf-8');
      const mdLines = omMd.split('\n');
      const mdMatches = mdLines.filter(l => l.toLowerCase().includes(keywordLower));
      
      console.log(`   Found in ${mdMatches.length} lines`);
      for (const line of mdMatches.slice(0, 5)) {
        const highlighted = line.replace(
          new RegExp(`(${keyword})`, 'gi'),
          '\x1b[33m$1\x1b[0m'
        );
        console.log(`   ${highlighted.substring(0, 100)}...`);
      }
    } else {
      console.log(`   om.md not found (run benchmark first)`);
    }

    // 5. Diagnosis
    console.log(`\n📊 Diagnosis:`);
    const inDataset = question && question.haystack_sessions?.some(s => 
      s.some(t => t.content.toLowerCase().includes(keywordLower))
    );
    const inMessages = msgMatches.length > 0;
    const inObservations = obsMatches.length > 0;
    
    if (inDataset && !inMessages) {
      console.log(`   ❌ Lost during message storage - check prepare.ts`);
    } else if (inMessages && !inObservations) {
      console.log(`   ❌ Observer missed this information`);
      console.log(`   → Check Observer prompts or message batching`);
    } else if (inObservations) {
      console.log(`   ✓ Information preserved through pipeline`);
      console.log(`   → If agent still failed, it's a reasoning error`);
    } else if (!inDataset) {
      console.log(`   ⚠️  Not found in original dataset`);
    }
  }

  // --------------------------------------------------------------------------
  // Date-Based Observation Viewer
  // --------------------------------------------------------------------------

  /**
   * View observations and raw messages around a specific date
   */
  private async viewObservationsAroundDate(
    questionId: string,
    dateStr: string,
    contextDays: number = 1
  ): Promise<void> {
    console.log(`\n🗓️  Viewing data around "${dateStr}" for question ${questionId}\n`);

    // Parse the target date
    const targetDate = this.parseFlexibleDate(dateStr);
    if (!targetDate) {
      console.log(`❌ Could not parse date: "${dateStr}"`);
      console.log(`   Try formats like: "2023/05/29", "May 29, 2023", "05-29"`);
      return;
    }

    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - contextDays);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + contextDays);

    console.log(`📅 Target: ${targetDate.toDateString()}`);
    console.log(`📅 Range: ${startDate.toDateString()} to ${endDate.toDateString()}\n`);

    // Find prepared data
    const { omPath, questionDir } = await this.findPreparedData(questionId);
    if (!omPath) {
      console.log(`❌ No prepared data found for question ${questionId}`);
      return;
    }

    // Load storage
    const storage = new PersistableInMemoryMemory({ readOnly: true });
    await storage.hydrate(omPath);
    const resourceId = `resource_${questionId}`;

    // 1. Show raw messages in date range
    console.log(`1️⃣  Raw Messages in Range:`);
    console.log(`${'─'.repeat(60)}`);
    
    const messagesResult = await storage.listMessages({ resourceId, perPage: false });
    const allMessages = messagesResult.messages;
    
    const messagesInRange = allMessages.filter((m: any) => {
      if (!m.createdAt) return false;
      const msgDate = new Date(m.createdAt);
      return msgDate >= startDate && msgDate <= endDate;
    }).sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (messagesInRange.length === 0) {
      console.log(`   No messages found in this date range`);
    } else {
      console.log(`   Found ${messagesInRange.length} messages\n`);
      for (const msg of messagesInRange) {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        const date = new Date(msg.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const isTargetDay = date.toDateString() === targetDate.toDateString();
        const prefix = isTargetDay ? '→ ' : '  ';
        const highlight = isTargetDay ? '\x1b[33m' : '\x1b[90m';
        const reset = '\x1b[0m';
        
        console.log(`${prefix}${highlight}[${dateStr}] ${msg.role}:${reset}`);
        console.log(`${prefix}${highlight}${content.substring(0, 200)}${content.length > 200 ? '...' : ''}${reset}\n`);
      }
    }

    // 2. Show observations for dates in range
    console.log(`\n2️⃣  Observations in Range:`);
    console.log(`${'─'.repeat(60)}`);
    
    const omRecords = await storage.getObservationalMemoryHistory(null, resourceId);
    const latestRecord = omRecords[0];
    const observations = latestRecord?.activeObservations || '';
    
    if (!observations) {
      console.log(`   No observations found`);
    } else {
      // Parse observations by date
      const lines = observations.split('\n');
      let currentDateGroup = '';
      let inRange = false;
      let observationsInRange: { date: string; lines: string[] }[] = [];
      let currentGroup: { date: string; lines: string[] } | null = null;

      for (const line of lines) {
        // Check for date headers like "Date: May 29, 2023" or "Date: Monday, May 29, 2023"
        const dateMatch = line.match(/^Date:\s*(.+)$/i);
        if (dateMatch) {
          // Save previous group if in range
          if (currentGroup && currentGroup.lines.length > 0) {
            observationsInRange.push(currentGroup);
          }
          
          currentDateGroup = dateMatch[1].trim();
          const parsedDate = this.parseFlexibleDate(currentDateGroup);
          inRange = parsedDate ? (parsedDate >= startDate && parsedDate <= endDate) : false;
          
          if (inRange) {
            currentGroup = { date: currentDateGroup, lines: [] };
          } else {
            currentGroup = null;
          }
        } else if (inRange && currentGroup && line.trim()) {
          // Skip thread tags but include observation content
          if (!line.match(/^<\/?thread/)) {
            currentGroup.lines.push(line);
          }
        }
      }
      
      // Don't forget the last group
      if (currentGroup && currentGroup.lines.length > 0) {
        observationsInRange.push(currentGroup);
      }

      if (observationsInRange.length === 0) {
        console.log(`   No observations found for dates in range`);
      } else {
        for (const group of observationsInRange) {
          const parsedDate = this.parseFlexibleDate(group.date);
          const isTargetDay = parsedDate && parsedDate.toDateString() === targetDate.toDateString();
          const highlight = isTargetDay ? '\x1b[33m' : '\x1b[0m';
          const reset = '\x1b[0m';
          
          console.log(`\n${highlight}📅 ${group.date}${reset}`);
          for (const line of group.lines) {
            console.log(`   ${highlight}${line}${reset}`);
          }
        }
      }
    }

    // 3. Show original dataset sessions for this date
    console.log(`\n\n3️⃣  Original Dataset Sessions:`);
    console.log(`${'─'.repeat(60)}`);
    
    const loader = new DatasetLoader(this.datasetDir);
    const dataset = await loader.loadDataset('longmemeval_s');
    const question = dataset.find(q => q.question_id === questionId);
    
    if (question?.haystack_sessions && question?.haystack_dates) {
      const sessionsInRange: { idx: number; date: string; turns: any[] }[] = [];
      
      for (let i = 0; i < question.haystack_dates.length; i++) {
        const sessionDateStr = question.haystack_dates[i];
        const sessionDate = this.parseFlexibleDate(sessionDateStr);
        
        if (sessionDate && sessionDate >= startDate && sessionDate <= endDate) {
          sessionsInRange.push({
            idx: i,
            date: sessionDateStr,
            turns: question.haystack_sessions[i] || []
          });
        }
      }

      if (sessionsInRange.length === 0) {
        console.log(`   No sessions found in date range`);
      } else {
        console.log(`   Found ${sessionsInRange.length} sessions\n`);
        for (const session of sessionsInRange) {
          const sessionDate = this.parseFlexibleDate(session.date);
          const isTargetDay = sessionDate && sessionDate.toDateString() === targetDate.toDateString();
          const highlight = isTargetDay ? '\x1b[33m' : '\x1b[90m';
          const reset = '\x1b[0m';
          
          console.log(`${highlight}━━━ Session ${session.idx}: ${session.date} ━━━${reset}`);
          for (let t = 0; t < session.turns.length; t++) {
            const turn = session.turns[t];
            console.log(`${highlight}[Turn ${t}] ${turn.role}:${reset}`);
            console.log(`${highlight}${turn.content.substring(0, 300)}${turn.content.length > 300 ? '...' : ''}${reset}\n`);
          }
        }
      }
    } else {
      console.log(`   Question not found in dataset`);
    }
  }

  // --------------------------------------------------------------------------
  // Session Viewer
  // --------------------------------------------------------------------------

  /**
   * List all sessions with their dates for a question
   */
  private async listSessions(questionId: string): Promise<void> {
    console.log(`\n📋 Sessions for question ${questionId}\n`);

    const loader = new DatasetLoader(this.datasetDir);
    const dataset = await loader.loadDataset('longmemeval_s');
    const question = dataset.find(q => q.question_id === questionId);

    if (!question?.haystack_sessions || !question?.haystack_dates) {
      console.log(`❌ Question not found or has no sessions`);
      return;
    }

    console.log(`Total sessions: ${question.haystack_sessions.length}\n`);
    console.log(`${'Idx'.padStart(4)} | ${'Date'.padEnd(25)} | Turns | Preview`);
    console.log(`${'─'.repeat(80)}`);

    for (let i = 0; i < question.haystack_sessions.length; i++) {
      const session = question.haystack_sessions[i];
      const date = question.haystack_dates[i] || 'unknown';
      const turns = session.length;
      const firstUserTurn = session.find(t => t.role === 'user');
      const preview = firstUserTurn?.content.substring(0, 40) || '';
      
      console.log(`${String(i).padStart(4)} | ${date.padEnd(25)} | ${String(turns).padStart(5)} | ${preview}...`);
    }

    console.log(`\nUse --session <idx> -q ${questionId} to view a specific session`);
  }

  /**
   * View a specific session from the original dataset
   */
  private async viewSession(questionId: string, sessionIdx: number): Promise<void> {
    console.log(`\n📄 Session ${sessionIdx} for question ${questionId}\n`);

    const loader = new DatasetLoader(this.datasetDir);
    const dataset = await loader.loadDataset('longmemeval_s');
    const question = dataset.find(q => q.question_id === questionId);

    if (!question?.haystack_sessions || !question?.haystack_dates) {
      console.log(`❌ Question not found or has no sessions`);
      return;
    }

    if (sessionIdx < 0 || sessionIdx >= question.haystack_sessions.length) {
      console.log(`❌ Invalid session index. Valid range: 0-${question.haystack_sessions.length - 1}`);
      return;
    }

    const session = question.haystack_sessions[sessionIdx];
    const date = question.haystack_dates[sessionIdx] || 'unknown';

    console.log(`📅 Date: ${date}`);
    console.log(`💬 Turns: ${session.length}`);
    console.log(`${'─'.repeat(60)}\n`);

    for (let t = 0; t < session.length; t++) {
      const turn = session[t];
      const roleColor = turn.role === 'user' ? '\x1b[36m' : '\x1b[90m';
      const reset = '\x1b[0m';
      
      console.log(`${roleColor}[Turn ${t}] ${turn.role.toUpperCase()}:${reset}`);
      console.log(`${turn.content}\n`);
    }

    // Also show what was observed for this date
    const { omPath } = await this.findPreparedData(questionId);
    if (omPath) {
      const storage = new PersistableInMemoryMemory({ readOnly: true });
      await storage.hydrate(omPath);
      const resourceId = `resource_${questionId}`;
      
      const omRecords = await storage.getObservationalMemoryHistory(null, resourceId);
      const latestRecord = omRecords[0];
      const observations = latestRecord?.activeObservations || '';
      
      if (observations) {
        // Find observations for this date
        const sessionDate = this.parseFlexibleDate(date);
        if (sessionDate) {
          const dateStr = sessionDate.toLocaleDateString('en-US', { 
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
          });
          
          console.log(`\n${'─'.repeat(60)}`);
          console.log(`\n🔍 Observations extracted for ${dateStr}:\n`);
          
          const lines = observations.split('\n');
          let inTargetDate = false;
          let foundAny = false;
          
          for (const line of lines) {
            const dateMatch = line.match(/^Date:\s*(.+)$/i);
            if (dateMatch) {
              const lineDate = this.parseFlexibleDate(dateMatch[1].trim());
              inTargetDate = lineDate?.toDateString() === sessionDate.toDateString();
            } else if (inTargetDate && line.trim() && !line.match(/^<\/?thread/)) {
              console.log(`   ${line}`);
              foundAny = true;
            }
          }
          
          if (!foundAny) {
            console.log(`   ⚠️  No observations found for this date`);
          }
        }
      }
    }
  }

  /**
   * Parse various date formats flexibly
   */
  private parseFlexibleDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Try various formats
    const formats = [
      // "2023/05/29 (Mon) 15:01" - LongMemEval format
      /^(\d{4})\/(\d{2})\/(\d{2})/,
      // "May 29, 2023" or "Monday, May 29, 2023"
      /(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*)?(\w+)\s+(\d{1,2}),?\s*(\d{4})/i,
      // "05-29-2023" or "05/29/2023"
      /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/,
      // "2023-05-29"
      /^(\d{4})-(\d{2})-(\d{2})/,
    ];

    // Try LongMemEval format first: "2023/05/29 (Mon) 15:01"
    const longMemMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
    if (longMemMatch) {
      return new Date(parseInt(longMemMatch[1]), parseInt(longMemMatch[2]) - 1, parseInt(longMemMatch[3]));
    }

    // Try "May 29, 2023" format
    const monthNameMatch = dateStr.match(/(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*)?(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
    if (monthNameMatch) {
      const months: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const monthNum = months[monthNameMatch[1].toLowerCase()];
      if (monthNum !== undefined) {
        return new Date(parseInt(monthNameMatch[3]), monthNum, parseInt(monthNameMatch[2]));
      }
    }

    // Try ISO format: "2023-05-29"
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    // Fallback to native Date parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // --------------------------------------------------------------------------
  // Stale Data Detection
  // --------------------------------------------------------------------------

  /**
   * Check if prepared data is stale (missing per-thread cursors).
   * Data prepared before the per-thread cursor fix will be missing
   * lastObservedAt on thread metadata, which can cause observation gaps.
   */
  private async checkStaleData(questionId?: string, staleOnly?: boolean): Promise<void> {
    console.log('\n🔍 Checking for stale prepared data (pre-cursor-fix)...\n');

    interface StaleCheckResult {
      questionId: string;
      config: string;
      dataset: string;
      isStale: boolean;
      threadCount: number;
      threadsWithCursor: number;
      reason?: string;
    }

    const results: StaleCheckResult[] = [];

    // If specific question, just check that one
    if (questionId) {
      const { omPath, config, dataset } = await this.findPreparedData(questionId);
      if (!omPath) {
        console.log(`❌ No prepared data found for question ${questionId}`);
        return;
      }

      const result = await this.checkSingleQuestion(questionId, omPath, config, dataset);
      results.push(result);
    } else {
      // Check all questions in all configs
      const datasets = ['longmemeval_s', 'longmemeval_m'];
      
      for (const dataset of datasets) {
        const datasetDir = join(this.preparedDataDir, dataset);
        if (!existsSync(datasetDir)) continue;

        const configs = await readdir(datasetDir).catch(() => []);
        
        for (const config of configs) {
          // Only check OM configs
          if (!config.includes('observational-memory') && !config.startsWith('om-')) continue;
          
          const configDir = join(datasetDir, config);
          const questions = await readdir(configDir).catch(() => []);
          
          for (const qId of questions) {
            const omPath = join(configDir, qId, 'om.json');
            if (!existsSync(omPath)) continue;
            
            const result = await this.checkSingleQuestion(qId, omPath, config, dataset);
            results.push(result);
          }
        }
      }
    }

    // Display results
    const staleResults = results.filter(r => r.isStale);
    const freshResults = results.filter(r => !r.isStale);

    if (staleOnly) {
      // Only show stale questions
      if (staleResults.length === 0) {
        console.log('✅ No stale data found!');
        return;
      }

      console.log(`Found ${staleResults.length} stale question(s):\n`);
      
      // Group by config
      const byConfig: Record<string, StaleCheckResult[]> = {};
      for (const r of staleResults) {
        const key = `${r.dataset}/${r.config}`;
        if (!byConfig[key]) byConfig[key] = [];
        byConfig[key].push(r);
      }

      for (const [configKey, questions] of Object.entries(byConfig)) {
        console.log(`📁 ${configKey} (${questions.length} stale):`);
        for (const q of questions.slice(0, 20)) {
          console.log(`   ${q.questionId} - ${q.reason}`);
        }
        if (questions.length > 20) {
          console.log(`   ... and ${questions.length - 20} more`);
        }
        console.log();
      }

      // Output question IDs for re-preparation
      console.log('\n📋 Stale question IDs (for re-preparation):');
      console.log(staleResults.map(r => r.questionId).join('\n'));
      
    } else {
      // Show summary
      console.log(`📊 Summary:`);
      console.log(`   Total checked: ${results.length}`);
      console.log(`   ✅ Fresh (has per-thread cursors): ${freshResults.length}`);
      console.log(`   ⚠️  Stale (missing cursors): ${staleResults.length}`);
      
      if (staleResults.length > 0) {
        console.log(`\n⚠️  Stale questions may have observation gaps!`);
        console.log(`   Run with --stale-only to list them for re-preparation.`);
      }
    }
  }

  private async checkSingleQuestion(
    questionId: string,
    omPath: string,
    config: string,
    dataset: string
  ): Promise<{
    questionId: string;
    config: string;
    dataset: string;
    isStale: boolean;
    threadCount: number;
    threadsWithCursor: number;
    reason?: string;
  }> {
    try {
      const data = JSON.parse(await readFile(omPath, 'utf-8'));
      const threads = data.threads || [];
      
      let threadCount = 0;
      let threadsWithCursor = 0;
      
      for (const threadPair of threads) {
        // Structure is [threadId, threadObject]
        if (!Array.isArray(threadPair) || threadPair.length < 2) continue;
        
        const threadObj = threadPair[1];
        if (typeof threadObj !== 'object') continue;
        
        threadCount++;
        const metadata = threadObj.metadata || {};
        
        // Check both old location (metadata.lastObservedAt) and new location (metadata.mastra.om.lastObservedAt)
        const hasOldCursor = !!metadata.lastObservedAt;
        const hasNewCursor = !!metadata?.mastra?.om?.lastObservedAt;
        
        if (hasOldCursor || hasNewCursor) {
          threadsWithCursor++;
        }
      }
      
      const isStale = threadCount > 0 && threadsWithCursor === 0;
      const reason = isStale 
        ? `0/${threadCount} threads have lastObservedAt`
        : threadsWithCursor < threadCount
          ? `${threadsWithCursor}/${threadCount} threads have lastObservedAt`
          : undefined;
      
      return {
        questionId,
        config,
        dataset,
        isStale,
        threadCount,
        threadsWithCursor,
        reason,
      };
    } catch (error) {
      return {
        questionId,
        config,
        dataset,
        isStale: true,
        threadCount: 0,
        threadsWithCursor: 0,
        reason: `Error reading om.json: ${error}`,
      };
    }
  }

  /**
   * Find prepared data for a question across all configs
   */
  private async findPreparedData(questionId: string): Promise<{
    omPath: string | null;
    config: string;
    dataset: string;
    questionDir: string;
  }> {
    const datasets = ['longmemeval_s', 'longmemeval_m'];
    
    for (const dataset of datasets) {
      const datasetDir = join(this.preparedDataDir, dataset);
      if (!existsSync(datasetDir)) continue;

      const configs = await readdir(datasetDir).catch(() => []);
      
      for (const config of configs) {
        const questionDir = join(datasetDir, config, questionId);
        const omPath = join(questionDir, 'om.json');
        
        if (existsSync(omPath)) {
          return { omPath, config, dataset, questionDir };
        }
      }
    }

    return { omPath: null, config: '', dataset: '', questionDir: '' };
  }

  // --------------------------------------------------------------------------
  // Add Improvement to Dataset
  // --------------------------------------------------------------------------

  private async addImprovement(
    questionId: string,
    improvedQuestion?: string,
    improvedAnswer?: string,
    improvementNote?: string,
  ): Promise<void> {
    if (!improvedQuestion && !improvedAnswer && !improvementNote) {
      console.log('❌ At least one of --improve-question, --improve-answer, or --improve-note is required');
      return;
    }

    const datasetPath = join(this.datasetDir, 'longmemeval_s.json');
    
    if (!existsSync(datasetPath)) {
      console.log(`❌ Dataset not found: ${datasetPath}`);
      return;
    }

    // Load dataset
    const datasetContent = await readFile(datasetPath, 'utf-8');
    const dataset: LongMemEvalQuestion[] = JSON.parse(datasetContent);

    // Find the question
    const questionIndex = dataset.findIndex(q => q.question_id === questionId);
    if (questionIndex === -1) {
      console.log(`❌ Question not found: ${questionId}`);
      return;
    }

    const question = dataset[questionIndex];
    
    // Show current state
    console.log(`\n📝 Updating question: ${questionId}`);
    console.log(`   Type: ${question.question_type}`);
    console.log(`   Question: ${question.question.substring(0, 80)}...`);
    console.log(`   Expected: ${String(question.answer).substring(0, 80)}`);
    
    // Show what's being updated
    console.log('\n📋 Changes:');
    
    if (improvedQuestion) {
      console.log(`   improved_question: ${question.improved_question || '(not set)'} → ${improvedQuestion}`);
      question.improved_question = improvedQuestion;
    }
    
    if (improvedAnswer) {
      console.log(`   improved_answer: ${question.improved_answer || '(not set)'} → ${improvedAnswer}`);
      question.improved_answer = improvedAnswer;
    }
    
    if (improvementNote) {
      console.log(`   improvement_note: ${question.improvement_note || '(not set)'} → ${improvementNote}`);
      question.improvement_note = improvementNote;
    }

    // Save dataset
    await writeFile(datasetPath, JSON.stringify(dataset, null, 2));
    
    console.log('\n✅ Dataset updated!');
    console.log('   Run `pnpm run sync-improved-om-qa` to sync to prepared data');
  }

  private showHelp(): void {
    console.log(`
📋 Investigation Workflow

Usage:
  pnpm investigate <run-id>              Setup investigation from a benchmark run
  pnpm investigate --status              Show progress across all investigations
  pnpm investigate --next                Open next uninvestigated question
  pnpm investigate --done <question-id>  Mark a question as investigated
  pnpm investigate --sync                Sync fixes to dataset

Investigation Utilities:
  pnpm investigate --inspect <question-id>           Inspect question data
  pnpm investigate --search <keyword> -q <id>        Search observations
  pnpm investigate --trace <keyword> -q <id>         Trace info through pipeline

Data Freshness:
  pnpm investigate --check-stale                     Check all data for staleness
  pnpm investigate --check-stale -q <id>             Check specific question
  pnpm investigate --check-stale --stale-only        List only stale questions

Dataset Improvements:
  pnpm investigate --improve <id> --improve-question "..." --improve-answer "..." --improve-note "..."

Examples:
  pnpm investigate run_1234567890
  pnpm investigate --inspect 07741c45
  pnpm investigate --search "sneaker" -q 07741c45
  pnpm investigate --trace "shoe rack" -q 07741c45
  pnpm investigate --check-stale --stale-only        Find questions to re-prepare

Options:
  --output <dir>         Investigation output directory (default: ./investigations)
  --results <dir>        Results directory (default: ./results)
  --prepared-data <dir>  Prepared data directory (default: ./prepared-data)
  --dataset <dir>        Dataset directory (default: ./data)
  --editor <cmd>         Editor command (default: $EDITOR or 'code')
`);
  }
}
