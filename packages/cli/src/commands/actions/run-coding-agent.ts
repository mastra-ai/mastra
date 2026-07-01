import { execSync } from 'node:child_process';
import { basename } from 'node:path';

import { config } from 'dotenv';
import pc from 'picocolors';

import { analytics, origin } from '../..';
import { shouldSkipDotenvLoading } from '../utils';

export interface RunCodingAgentArgs {
  prompt: string;
  model: string;
  basePath?: string;
}

export const runCodingAgent = async (args: RunCodingAgentArgs) => {
  await analytics.trackCommandExecution({
    command: 'mastra -p',
    args: { prompt: args.prompt, model: args.model, basePath: args.basePath },
    execution: async () => {
      // Load environment variables from .env files (for model API keys)
      if (!shouldSkipDotenvLoading()) {
        config({ path: ['.env', '.env.local'], quiet: true });
      }

      const { createCodingAgent, buildBasePrompt } = await import('@mastra/core/coding-agent');

      const projectPath = args.basePath || process.cwd();
      const projectName = basename(projectPath);
      const date = new Date().toISOString().slice(0, 10);

      let gitBranch: string | undefined;
      try {
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
      } catch {
        // Not a git repository — gitBranch stays undefined
      }

      const instructions = buildBasePrompt({
        projectPath,
        projectName,
        gitBranch,
        platform: process.platform,
        date,
        mode: 'build',
        modelId: args.model,
        toolGuidance: '',
      });

      const agent = createCodingAgent({
        id: 'cli-coding-agent',
        name: 'CLI Coding Agent',
        model: args.model,
        instructions,
        basePath: projectPath,
        tools: {},
      });

      const stream = await agent.stream(args.prompt);

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') {
          process.stdout.write(chunk.payload?.text || '');
        } else if (chunk.type === 'tool-call') {
          process.stderr.write(`${pc.dim(`⋅ ${chunk.payload?.toolName}`)}\n`);
        }
      }
    },
    origin,
  });
};
