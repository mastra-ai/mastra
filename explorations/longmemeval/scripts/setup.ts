#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

const DATA_DIR = join(process.cwd(), 'data');
const EXPECTED_FILES = ['longmemeval_s.json', 'longmemeval_m.json', 'longmemeval_oracle.json'];

async function setup() {
  console.log(chalk.blue('\n🚀 LongMemEval Setup\n'));

  // Check if already set up
  const hasAllFiles = EXPECTED_FILES.every(file => existsSync(join(DATA_DIR, file)));

  if (hasAllFiles) {
    console.log(chalk.green('✓ All datasets are already downloaded'));
    console.log(chalk.gray('\nYou can run the benchmark with:'));
    console.log(chalk.cyan('  pnpm cli run --dataset longmemeval_s --model gpt-4o\n'));
    return;
  }

  // Install dependencies
  const spinner = ora('Installing dependencies...').start();
  try {
    execSync('pnpm install', { stdio: 'ignore' });
    spinner.succeed('Dependencies installed');
  } catch (error) {
    spinner.fail('Failed to install dependencies');
    throw error;
  }

  // Download datasets
  console.log(chalk.blue('\n📥 Downloading datasets...\n'));

  try {
    execSync('pnpm download', { stdio: 'inherit' });
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Automatic download failed.'));
    console.log(chalk.yellow('Please check the DOWNLOAD_GUIDE.md for manual download instructions.\n'));
  }

  // Verify setup
  const filesAfterDownload = EXPECTED_FILES.filter(file => existsSync(join(DATA_DIR, file)));

  if (filesAfterDownload.length === EXPECTED_FILES.length) {
    console.log(chalk.green('\n✅ Setup complete!'));
    console.log(chalk.gray('\nYou can now run the benchmark:'));
    console.log(chalk.cyan('  pnpm cli run --dataset longmemeval_s --model gpt-4o'));
    console.log(chalk.gray('\nOr view available commands:'));
    console.log(chalk.cyan('  pnpm cli --help\n'));
  } else {
    console.log(chalk.yellow('\n⚠️  Setup incomplete. Please download the datasets manually.'));
  }
}

// Run setup
setup().catch(console.error);
