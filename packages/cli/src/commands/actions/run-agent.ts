import { analytics, origin } from '../..';
import { run } from '../run/run';

export const runAgent = async (args: {
  prompt?: string;
  agent: string;
  outputFormat?: string;
  jsonSchema?: string;
  strict?: boolean;
  dir?: string;
  root?: string;
  env?: string;
  debug?: boolean;
}) => {
  await analytics.trackCommandExecution({
    command: 'run',
    args: {
      outputFormat: args.outputFormat ?? 'text',
      strict: args.strict ?? false,
      debug: args.debug ?? false,
      hasPrompt: Boolean(args.prompt),
      hasJsonSchema: Boolean(args.jsonSchema),
      hasDirOverride: Boolean(args.dir),
      hasRootOverride: Boolean(args.root),
      hasEnvOverride: Boolean(args.env),
    },
    execution: async () => {
      await run({
        prompt: args.prompt,
        agent: args.agent,
        outputFormat: args.outputFormat ?? 'text',
        jsonSchema: args.jsonSchema,
        strict: args.strict ?? false,
        dir: args.dir,
        root: args.root,
        env: args.env,
        debug: args.debug ?? false,
      });
    },
    origin,
  });
};
