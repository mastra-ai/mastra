import * as p from '@clack/prompts';
import pc from 'picocolors';
import { analytics, origin } from '../..';
import { emitLintJson, lint, printLintReport } from '../lint';

export const lintProject = async (args: {
  dir?: string;
  root?: string;
  tools?: string;
  preflight?: boolean;
  skipBuild?: boolean;
  envFile?: string;
  strict?: boolean;
  json?: boolean;
  debug?: boolean;
}) => {
  await analytics.trackCommandExecution({
    command: 'lint',
    args,
    execution: async () => {
      const json = args.json ?? false;
      if (!json) {
        p.intro(args.preflight ? 'mastra lint --preflight' : 'mastra lint');
      }

      const result = await lint({
        dir: args.dir,
        root: args.root,
        tools: args.tools ? args.tools.split(',') : [],
        preflight: args.preflight,
        skipBuild: args.skipBuild,
        envFile: args.envFile,
        strict: args.strict,
        json,
        debug: args.debug,
      });

      if (json) {
        emitLintJson(result, { strict: args.strict });
      } else {
        printLintReport(result, { strict: args.strict });
      }

      const blocked = result.error !== undefined || result.errorCount > 0 || (args.strict && result.warningCount > 0);
      if (blocked) {
        if (!json) {
          p.outro(pc.red('✖ Lint failed'));
        }
        process.exit(1);
      }

      if (!json) {
        if (result.warningCount > 0) {
          p.outro(pc.yellow(`✓ Lint passed with ${result.warningCount} warning(s)`));
        } else {
          p.outro(pc.green('✓ Lint passed'));
        }
      }
    },
    origin,
  });
};
