import { Argument, Option, type CommandUnknownOpts } from 'commander';

export interface TraceImportCommandOptions {
  targetProject?: string;
  /** @deprecated Hidden alias of `targetProject`, kept for commands written before the rename. */
  project?: string;
  since?: string;
  until?: string;
  /** @deprecated Hidden alias of `since`, kept for commands written before the rename. */
  from?: string;
  /** @deprecated Hidden alias of `until`, kept for commands written before the rename. */
  to?: string;
  dryRun?: boolean;
  resume?: string;
  yes?: boolean;
}

export function configureTraceImportCommand(command: CommandUnknownOpts): void {
  command
    .description('Import traces from a source provider into a Mastra Platform project')
    .addArgument(new Argument('<provider>', 'source provider to read traces from').choices(['langfuse']))
    .option('--target-project <name|slug|id>', 'destination Mastra Platform project that receives the traces')
    .addOption(new Option('--project <name|slug|id>').hideHelp())
    .option('--since <date>', 'start of the import window (defaults to 30 days before --until)')
    .option('--until <date>', 'end of the import window (defaults to now)')
    .addOption(new Option('--from <date>').hideHelp())
    .addOption(new Option('--to <date>').hideHelp())
    .option('--dry-run', 'prepare and report traces without uploading them')
    .option('--resume <import-id>', 'resume a previously prepared import')
    .option('-y, --yes', 'upload without asking for confirmation');
}
