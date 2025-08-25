import { openai } from '@ai-sdk/openai';
import { AgentBuilder } from '@mastra/agent-builder';
import { LibSQLStore } from '@mastra/libsql';
import { GITHUB_ISSUE_REPRO_INSTRUCTIONS, ENHANCED_INSTRUCTIONS } from './instructions.js';
import { Mastra } from '@mastra/core';
import path from 'path';
import os from 'os';

// Helper function to create a slug from issue URL or number
function createIssueSlug(issueUrlOrNumber: string): string {
  // Extract issue number from GitHub URL
  const match = issueUrlOrNumber.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (match) {
    const [, owner, repo, number] = match;
    return `gh-repro-${owner}-${repo}-${number}`;
  }

  // If it's just a number, use it directly
  if (/^\d+$/.test(issueUrlOrNumber)) {
    return `gh-repro-issue-${issueUrlOrNumber}`;
  }

  // Fallback to timestamp
  return `gh-repro-${Date.now()}`;
}

export function createGitHubIssueReproAgent(options?: {
  model?: string;
  projectPath?: string;
  memoryDbPath?: string;
  issueSlug?: string;
}) {
  // Use provided path, or create a temp directory based on issue slug
  const projectPath =
    options?.projectPath ||
    (options?.issueSlug
      ? path.join(os.tmpdir(), 'mastra-repros', options.issueSlug)
      : path.join(os.tmpdir(), 'mastra-repros', `gh-repro-${Date.now()}`));
  const model = options?.model || 'gpt-4o';

  const baseInstructions = GITHUB_ISSUE_REPRO_INSTRUCTIONS(projectPath);
  const enhancedInstructions = ENHANCED_INSTRUCTIONS(baseInstructions);

  const agent = new AgentBuilder({
    instructions: enhancedInstructions,
    model: openai(model),
    projectPath: projectPath,
    mode: 'code-editor', // Use full tool set including web search
  });

  // add storage since we can't override memory and add storage
  const mastra = new Mastra({
    agents: {
      agent,
    },
    telemetry: { enabled: false },
    storage: new LibSQLStore({
      url: 'file:./repro-agent.db',
    }),
  });

  return mastra.getAgent('agent');
}
