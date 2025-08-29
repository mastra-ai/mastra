#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runGitHubIssueReproWorkflow } from './workflow';

const program = new Command();

program
  .name('gh-repro')
  .description('Reproduce GitHub issues using AgentBuilder')
  .version('0.1.0')
  .argument('<issue>', 'GitHub issue URL or issue number')
  .action(async (issue, options) => {
    console.log(chalk.blue.bold('\n🔧 GitHub Issue Reproduction Agent\n'));

    const spinner = ora({
      text: 'Initializing agent...',
      spinner: 'dots',
    });

    try {
      spinner.start('Checking gh CLI installation...');
      const { execSync } = await import('child_process');
      try {
        execSync('gh --version', { stdio: 'pipe' });
        spinner.succeed('initialized');
      } catch {
        spinner.fail('GitHub CLI (gh) is not installed');
        console.log(chalk.yellow('\nPlease install the GitHub CLI:'));
        console.log(chalk.gray('  brew install gh'));
        console.log(chalk.gray('  or visit: https://cli.github.com/\n'));
        process.exit(1);
      }

      spinner.stop();
      await runGitHubIssueReproWorkflow({ issueUrl: issue });
    } catch (error) {
      spinner.fail('Failed to reproduce issue');
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    }
  });

program.parse();
