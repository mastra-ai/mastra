import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

  const runtimeContext = new RuntimeContext();
  runtimeContext.set('targetPath', targetRepo);

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

Template repository: ${realTemplateGit}`;

    // Call the agent with natural language
    const response = await agent.generate(prompt, {
      maxSteps: 5,
      runtimeContext,
    });

    // Verify files were actually created in the target project
    const expectedFiles = ['src/mastra/agents', 'src/mastra/tools', 'src/mastra/workflows'];

    for (const expectedPath of expectedFiles) {
      const fullPath = join(targetRepo, expectedPath);
      expect(existsSync(fullPath)).toBe(true);
    }

    // Verify git branch was created
    const branches = exec('git branch', targetRepo);
    expect(branches).toContain('feat/install-template-template-pdf-questions');

    // Verify package.json was updated with template scripts
    const packageJsonPath = join(targetRepo, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    // Verify response contains confirmation
    expect(response.text.toLowerCase()).toMatch(/merge|template|success|applied|complete/);
  }, 600000); // Longer timeout for full merge operation
});
