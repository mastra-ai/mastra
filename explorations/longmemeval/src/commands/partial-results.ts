import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

interface PartialResult {
  question_id: string;
  question_type: string;
  is_correct: boolean;
  improved_is_correct?: boolean;
}

interface TypeStats {
  correct: number;
  fixed: number;
  total: number;
}

export interface PartialResultsOptions {
  config?: string;
  runId?: string;
  outputDir: string;
}

export class PartialResultsCommand {
  async run(options: PartialResultsOptions): Promise<void> {
    const resultsDir = options.outputDir;

    // If no config specified, list all configs with partial results
    if (!options.config) {
      await this.listAllPartialResults(resultsDir);
      return;
    }

    const configDir = join(resultsDir, options.config);
    if (!existsSync(configDir)) {
      console.log(chalk.red(`No results found for config: ${options.config}`));
      return;
    }

    // Find the run to analyze
    let runDir: string;
    if (options.runId) {
      runDir = join(configDir, options.runId);
      if (!existsSync(runDir)) {
        console.log(chalk.red(`Run not found: ${options.runId}`));
        return;
      }
    } else {
      // Find the most recent run
      const runs = await readdir(configDir);
      const runDirs = runs.filter(r => r.startsWith('run_')).sort();
      if (runDirs.length === 0) {
        console.log(chalk.red(`No runs found for config: ${options.config}`));
        return;
      }
      runDir = join(configDir, runDirs[runDirs.length - 1]);
      console.log(chalk.gray(`Using most recent run: ${runDirs[runDirs.length - 1]}\n`));
    }

    // Check for results.jsonl
    const resultsFile = join(runDir, 'results.jsonl');
    if (!existsSync(resultsFile)) {
      console.log(chalk.red(`No results.jsonl found in ${runDir}`));
      return;
    }

    // Check if this is a completed run (has metrics.json)
    const metricsFile = join(runDir, 'metrics.json');
    const isComplete = existsSync(metricsFile);

    // Load and analyze results
    const results = await this.loadResults(resultsFile);
    this.displayResults(options.config, results, isComplete);
  }

  async loadResults(resultsFile: string): Promise<PartialResult[]> {
    const content = await readFile(resultsFile, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  displayResults(config: string, results: PartialResult[], isComplete: boolean): void {
    const total = results.length;
    const correct = results.filter(r => r.is_correct).length;
    const fixedCorrect = results.filter(r => r.is_correct || r.improved_is_correct).length;

    const status = isComplete ? chalk.green('(complete)') : chalk.yellow('(partial)');
    
    console.log(chalk.bold(`\n📊 Results for ${chalk.cyan(config)} ${status}\n`));
    console.log(`Progress: ${chalk.bold(total)}/500 questions (${(total / 5).toFixed(1)}%)`);
    console.log();
    console.log(`Overall Accuracy: ${correct}/${total} = ${chalk.bold((100 * correct / total).toFixed(2) + '%')}`);
    console.log(`Fixed Accuracy:   ${fixedCorrect}/${total} = ${chalk.bold((100 * fixedCorrect / total).toFixed(2) + '%')}`);
    console.log();

    // By type
    const byType: Record<string, TypeStats> = {};
    for (const r of results) {
      const t = r.question_type || 'unknown';
      if (!byType[t]) byType[t] = { correct: 0, fixed: 0, total: 0 };
      byType[t].total++;
      if (r.is_correct) byType[t].correct++;
      if (r.is_correct || r.improved_is_correct) byType[t].fixed++;
    }

    console.log(chalk.bold('By Question Type:'));
    console.log(chalk.gray('─'.repeat(70)));
    console.log(
      chalk.gray('Type'.padEnd(32)),
      chalk.gray('Count'.padEnd(8)),
      chalk.gray('Accuracy'.padEnd(12)),
      chalk.gray('Fixed')
    );
    console.log(chalk.gray('─'.repeat(70)));

    for (const [t, stats] of Object.entries(byType).sort((a, b) => a[0].localeCompare(b[0]))) {
      const acc = stats.total > 0 ? (100 * stats.correct / stats.total) : 0;
      const fix = stats.total > 0 ? (100 * stats.fixed / stats.total) : 0;
      console.log(
        t.padEnd(32),
        String(stats.total).padEnd(8),
        (acc.toFixed(1) + '%').padStart(6).padEnd(12),
        (fix.toFixed(1) + '%').padStart(6)
      );
    }
    console.log();
  }

  async listAllPartialResults(resultsDir: string): Promise<void> {
    if (!existsSync(resultsDir)) {
      console.log(chalk.red(`Results directory not found: ${resultsDir}`));
      return;
    }

    const configs = await readdir(resultsDir);
    const configsWithResults: Array<{ config: string; runId: string; count: number; isComplete: boolean }> = [];

    for (const config of configs) {
      const configDir = join(resultsDir, config);
      try {
        const runs = await readdir(configDir);
        const runDirs = runs.filter(r => r.startsWith('run_')).sort();
        if (runDirs.length > 0) {
          const latestRun = runDirs[runDirs.length - 1];
          const resultsFile = join(configDir, latestRun, 'results.jsonl');
          const metricsFile = join(configDir, latestRun, 'metrics.json');
          if (existsSync(resultsFile)) {
            const content = await readFile(resultsFile, 'utf-8');
            const count = content.trim().split('\n').filter(l => l.trim()).length;
            configsWithResults.push({
              config,
              runId: latestRun,
              count,
              isComplete: existsSync(metricsFile)
            });
          }
        }
      } catch {
        // Skip non-directories
      }
    }

    if (configsWithResults.length === 0) {
      console.log(chalk.yellow('No results found.'));
      return;
    }

    console.log(chalk.bold('\n📊 Available Results:\n'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(
      chalk.gray('Config'.padEnd(40)),
      chalk.gray('Run'.padEnd(24)),
      chalk.gray('Questions'.padEnd(12)),
      chalk.gray('Status')
    );
    console.log(chalk.gray('─'.repeat(80)));

    for (const { config, runId, count, isComplete } of configsWithResults.sort((a, b) => a.config.localeCompare(b.config))) {
      const status = isComplete ? chalk.green('complete') : chalk.yellow('partial');
      console.log(
        config.padEnd(40),
        runId.padEnd(24),
        String(count).padEnd(12),
        status
      );
    }

    console.log();
    console.log(chalk.gray('Usage: pnpm run partial <config> [--run-id <id>]'));
    console.log();
  }
}
