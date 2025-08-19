#!/usr/bin/env tsx

import { downloadFile } from '@huggingface/hub';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { pipeline } from 'stream/promises';

const REPO_ID = 'xiaowu0162/longmemeval';
const DATA_DIR = join(process.cwd(), 'data');

const FILES = [
  { filename: 'longmemeval_oracle.json', repoPath: 'longmemeval_oracle' },
  { filename: 'longmemeval_s.json', repoPath: 'longmemeval_s' },
  { filename: 'longmemeval_m.json', repoPath: 'longmemeval_m' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(1) + ' GB';
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function downloadWithFetch(url: string, outputPath: string, token: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'longmemeval-downloader/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const { writeFile } = await import('fs/promises');
  await writeFile(outputPath, Buffer.from(buffer));
}

async function main() {
  console.log(chalk.blue('\n📥 LongMemEval Dataset Downloader\n'));

  // Create data directory if it doesn't exist
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if all files already exist
  let existingCount = 0;
  for (const fileInfo of FILES) {
    const outputPath = join(DATA_DIR, fileInfo.filename);
    const size = await getFileSize(outputPath);
    if (size > 1000000) {
      // > 1MB
      console.log(chalk.green(`✓ ${fileInfo.filename} already exists (${formatFileSize(size)})`));
      existingCount++;
    }
  }

  if (existingCount === FILES.length) {
    console.log(chalk.green('\n✅ All datasets already downloaded!\n'));
    console.log(chalk.gray('You can now run the benchmark:'));
    console.log(chalk.cyan('  pnpm cli run --dataset longmemeval_s --model gpt-4o'));
    return;
  }

  // Check for HuggingFace token
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;

  if (!token) {
    console.log(chalk.yellow('⚠️  No HuggingFace token found!\n'));
    console.log(chalk.blue('The LongMemEval datasets require authentication to download.\n'));

    console.log(chalk.gray('1. Get your token from:'));
    console.log(chalk.cyan('   https://huggingface.co/settings/tokens\n'));

    console.log(chalk.gray('2. Set it as an environment variable:'));
    console.log(chalk.cyan('   export HF_TOKEN=your_token_here\n'));

    console.log(chalk.gray('3. Run this script again:'));
    console.log(chalk.cyan('   pnpm download\n'));

    console.log(chalk.blue('Alternative: Download manually from Google Drive'));
    console.log(chalk.gray('See DOWNLOAD_GUIDE.md for instructions'));

    process.exit(1);
  }

  // Download missing files
  console.log(chalk.blue('Downloading missing datasets...\n'));
  let successCount = existingCount;

  for (const fileInfo of FILES) {
    const { filename, repoPath } = fileInfo;
    const outputPath = join(DATA_DIR, filename);

    // Skip if already exists
    const existingSize = await getFileSize(outputPath);
    if (existingSize > 1000000) {
      continue;
    }

    const spinner = ora(`Downloading ${filename}...`).start();

    try {
      // Try HuggingFace Hub API first
      try {
        const response = await downloadFile({
          repo: REPO_ID,
          path: repoPath,
          credentials: { accessToken: token },
        });

        if (response && response.body) {
          const fileStream = createWriteStream(outputPath);
          await pipeline(response.body as any, fileStream);
        } else {
          throw new Error('Empty response');
        }
      } catch (hubError: any) {
        // Fallback to direct HTTPS download
        const directUrl = `https://huggingface.co/datasets/${REPO_ID}/resolve/main/${repoPath}?download=true`;
        await downloadWithFetch(directUrl, outputPath, token);
      }

      // Verify file size
      const downloadedSize = await getFileSize(outputPath);
      if (downloadedSize > 1000000) {
        spinner.succeed(`Downloaded ${filename} (${formatFileSize(downloadedSize)})`);
        successCount++;
      } else {
        spinner.fail(`Downloaded ${filename} but file seems too small (${formatFileSize(downloadedSize)})`);
        // Remove invalid file
        const { unlink } = await import('fs/promises');
        await unlink(outputPath).catch(() => {});
      }
    } catch (error: any) {
      spinner.fail(`Failed to download ${filename}`);
      console.error(chalk.red(`  Error: ${error.message}`));

      if (error.message.includes('401') || error.message.includes('403')) {
        console.log(chalk.yellow('\n  Authentication issue. Please check:'));
        console.log(chalk.gray('  - Your token is valid'));
        console.log(chalk.gray('  - You have accepted the dataset terms of use'));
        console.log(chalk.cyan(`  - Visit: https://huggingface.co/datasets/${REPO_ID}`));
      }
    }
  }

  // Final summary
  console.log('');
  if (successCount === FILES.length) {
    console.log(chalk.green('✅ All datasets downloaded successfully!\n'));
    console.log(chalk.gray('You can now run the benchmark:'));
    console.log(chalk.cyan('  pnpm cli run --dataset longmemeval_s --model gpt-4o'));
  } else {
    console.log(chalk.yellow(`⚠️  Downloaded ${successCount}/${FILES.length} files\n`));
    console.log(chalk.blue('If downloads failed, please check:'));
    console.log(chalk.gray('- Your HuggingFace token is valid'));
    console.log(chalk.gray('- You have accepted the dataset terms (if any)'));
    console.log(chalk.gray('\nAlternatively, see DOWNLOAD_GUIDE.md for manual download instructions'));
  }
}

main().catch(console.error);
