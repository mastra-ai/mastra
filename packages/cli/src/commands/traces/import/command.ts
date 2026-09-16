import { Argument, type CommandUnknownOpts } from 'commander';

export interface TraceImportCommandOptions {
  project?: string;
  from?: string;
  to?: string;
  dryRun?: boolean;
  resume?: string;
  yes?: boolean;
}

export function configureTraceImportCommand(command: CommandUnknownOpts): void {
  command
    .description('Import traces into Mastra Platform')
    .addArgument(new Argument('[provider]', 'trace source provider').choices(['langfuse']).default('langfuse'))
    .option('--project <name|slug|id>', 'target Mastra Platform project')
    .option('--from <date>', 'start of the import window (defaults to 30 days before --to)')
    .option('--to <date>', 'end of the import window (defaults to now)')
    .option('--dry-run', 'prepare and report traces without uploading them')
    .option('--resume <import-id>', 'resume a previously prepared import')
    .option('-y, --yes', 'upload without asking for confirmation');
}
