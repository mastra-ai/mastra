import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { AgentBuilder } from '../../src/index';

// Import openai dynamically to handle cases where it might not be available
const openai = (() => {
  try {
    return require('@ai-sdk/openai').openai;
  } catch {
    return null;
  }
})();

function exec(cmd: string, cwd?: string) {
  return execSync(cmd, { stdio: 'pipe', cwd }).toString();
}

function initGitRepo(repoDir: string) {
  exec('git init -q', repoDir);
  exec('git config user.email "test@example.com"', repoDir);
  exec('git config user.name "Test User"', repoDir);
}

function commitAll(repoDir: string, message: string) {
  exec('git add .', repoDir);
  exec(`git commit -m "${message}" -q`, repoDir);
}

describe('agent-builder merge template via agent prompt (real template)', () => {
  const integrationProjectsDir = resolve(__dirname, '../integration-projects');
  mkdirSync(integrationProjectsDir, { recursive: true });
  const tempRoot = mkdtempSync(join(integrationProjectsDir, 'agent-builder-it-'));
  const fixtureProjectPath = resolve(__dirname, 'fixtures/minimal-mastra-project');
  const targetRepo = join(tempRoot, 'project-under-test');
  const realTemplateGit = 'https://github.com/mastra-ai/template-pdf-questions';

  beforeAll(() => {
    // Copy the fixture mastra project into temp directory
    mkdirSync(targetRepo, { recursive: true });
    cpSync(fixtureProjectPath, targetRepo, { recursive: true });

    // Initialize git in target
    initGitRepo(targetRepo);
    commitAll(targetRepo, 'chore: initial mastra project');
  });

  afterAll(() => {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  });

  it('uses AgentBuilder with natural language to merge pdf-questions template', async () => {
    // Skip test if no OPENAI_API_KEY available or openai not available
    if (!process.env.OPENAI_API_KEY || !openai) {
      console.log('Skipping test: OPENAI_API_KEY not set or @ai-sdk/openai not available');
      return;
    }

    // Create AgentBuilder with real OpenAI model
    const agent = new AgentBuilder({
      instructions:
        'You are an expert at merging Mastra templates into projects. Always use the merge-template tool for template operations.',
      model: openai('gpt-4o-mini'),
      projectPath: targetRepo,
    });

    const prompt = `I want to merge the PDF Questions template into this Mastra project. 

Template repository: ${realTemplateGit}

Please do a dry-run first to show me what would be merged. Use the merge-template tool with apply=false.`;

    // Call the agent with natural language
    const response = await agent.generate(prompt, {
      maxSteps: 5,
    });

    // Verify the agent used the merge-template tool
    expect(response.toolResults).toBeDefined();
    expect(response.toolResults.length).toBeGreaterThan(0);

    const mergeToolResult = response.toolResults.find(result => result.toolName === 'mergeTemplate');

    expect(mergeToolResult).toBeDefined();
    expect(mergeToolResult?.result?.success).toBe(true);
    expect(mergeToolResult?.result?.plan?.slug).toBe('pdf-questions');
    expect(mergeToolResult?.result?.applied).toBe(false); // dry-run

    // Verify the response contains meaningful information about the merge
    expect(response.text).toContain('pdf-questions');
  }, 60000); // Longer timeout for API calls

  it('uses AgentBuilder to actually apply template merge and validate results', async () => {
    // Skip test if no OPENAI_API_KEY available or openai not available
    if (!process.env.OPENAI_API_KEY || !openai) {
      console.log('Skipping test: OPENAI_API_KEY not set or @ai-sdk/openai not available');
      return;
    }

    // Create AgentBuilder with real OpenAI model
    const agent = new AgentBuilder({
      instructions:
        'You are an expert at merging Mastra templates into projects. Always use the merge-template tool for template operations.',
      model: openai('gpt-4o-mini'),
      projectPath: targetRepo,
    });

    const prompt = `Now please actually merge the PDF Questions template into this project.

Template repository: ${realTemplateGit}

Set apply=true to actually perform the merge. Create the branch and merge the files.`;

    // Call the agent to apply the merge
    const response = await agent.generate(prompt, {
      maxSteps: 5,
    });

    // Verify the agent used the merge-template tool
    expect(response.toolResults).toBeDefined();
    expect(response.toolResults.length).toBeGreaterThan(0);

    const mergeToolResult = response.toolResults.find(result => result.toolName === 'mergeTemplate');

    expect(mergeToolResult).toBeDefined();
    expect(mergeToolResult?.result?.success).toBe(true);
    expect(mergeToolResult?.result?.applied).toBe(true);
    expect(mergeToolResult?.result?.branchName).toBe('feat/install-template-pdf-questions');

    // Verify files were actually created in the target project
    const expectedFiles = ['src/agents', 'src/tools', 'src/workflows'];

    for (const expectedPath of expectedFiles) {
      const fullPath = join(targetRepo, expectedPath);
      expect(existsSync(fullPath)).toBe(true);
    }

    // Verify git branch was created
    const branches = exec('git branch', targetRepo);
    expect(branches).toContain('feat/install-template-pdf-questions');

    // Verify package.json was updated with template scripts
    const packageJsonPath = join(targetRepo, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    // Verify response contains confirmation
    expect(response.text.toLowerCase()).toMatch(/merge|template|success|applied|complete/);
  }, 120000); // Longer timeout for full merge operation
});
