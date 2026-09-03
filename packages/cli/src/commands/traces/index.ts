import type { Command } from 'commander';
import { wrapAction } from '../utils.js';
import { traceImportAction, type TraceImportCliOptions } from './import.js';

export function registerTracesCommand(program: Command): void {
  const traces = program.command('traces').description('Import and manage observability traces');
  traces
    .command('import')
    .description('Import the last 30 days of completed traces from an external provider')
    .requiredOption('--provider <provider>', 'Trace provider (V0 supports: langfuse)')
    .option('--project <id-or-slug>', 'Target Mastra Platform project ID or slug')
    .option('--platform-url <url>', 'Mastra collector origin or project-scoped spans endpoint')
    .option('--environment <name>', 'Override target environment attribution')
    .option('--dry-run', 'Read, validate, and stage traces without uploading')
    .option('--resume <import-id>', 'Resume a staged import')
    .option('--state-dir <path>', 'Directory under which import state is stored')
    .option('--batch-size <count>', 'Target records per batch (1-1000)', Number)
    .option('--max-staging-mb <megabytes>', 'Maximum local source staging size in MiB (default: 5120)', Number)
    .option('--json', 'Emit machine-readable output')
    .option('--yes', 'Upload without an interactive confirmation')
    .option('--keep-state', 'Keep sensitive staged trace data after a successful import')
    .action(wrapAction((options: TraceImportCliOptions) => traceImportAction(options)));
}
