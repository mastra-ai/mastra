/**
 * Agents Demo
 *
 * Demonstrates agents using the Workspace system:
 * - Agents with global workspace
 * - Agents with their own workspace (skill inheritance)
 * - Workspace tools available to agents
 *
 * Run with: pnpm demo:agents
 */

import { mastra } from '../mastra';
import { globalWorkspace, docsAgentWorkspace } from '../mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('AGENTS DEMO');
  console.log('='.repeat(70));
  console.log();

  // Initialize workspaces
  console.log('Initializing workspaces...');
  await globalWorkspace.init();
  await docsAgentWorkspace.init();
  console.log();

  // =========================================================================
  // PART 1: Workspace Inheritance Pattern
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: WORKSPACE INHERITANCE PATTERN');
  console.log('='.repeat(70));
  console.log();

  console.log('Agent workspace configuration:');
  console.log('  - supportAgent: Inherits globalWorkspace from Mastra');
  console.log('  - docsAgent: docsAgentWorkspace (global + agent-specific skills)');
  console.log('  - isolatedAgent: isolatedDocsWorkspace (agent-specific skills only)');
  console.log('  - readonlyAgent: readonlyWorkspace (readOnly: true)');
  console.log('  - safeWriteAgent: safeWriteWorkspace (requireReadBeforeWrite: true)');
  console.log('  - supervisedAgent: supervisedSandboxWorkspace (requireSandboxApproval: all)');
  console.log('  - commandApprovalAgent: commandApprovalWorkspace (requireSandboxApproval: commands)');
  console.log();

  // Show skills available to each workspace
  console.log('Global workspace skills:');
  if (globalWorkspace.skills) {
    const globalSkills = await globalWorkspace.skills.list();
    for (const skill of globalSkills) {
      console.log(`  - ${skill.name}`);
    }
  }
  console.log();

  console.log('Docs agent workspace skills (inherits + extends):');
  if (docsAgentWorkspace.skills) {
    const docsSkills = await docsAgentWorkspace.skills.list();
    for (const skill of docsSkills) {
      const isAgentSpecific = skill.name === 'brand-guidelines';
      console.log(`  - ${skill.name}${isAgentSpecific ? ' (agent-specific)' : ''}`);
    }
  }
  console.log();

  // =========================================================================
  // PART 2: Workspace Capabilities
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: WORKSPACE CAPABILITIES');
  console.log('='.repeat(70));
  console.log();

  console.log('Global workspace capabilities:');
  console.log(`  Filesystem: ${globalWorkspace.filesystem ? 'Yes' : 'No'}`);
  console.log(`  Sandbox: ${globalWorkspace.sandbox ? 'Yes' : 'No'}`);
  console.log(`  BM25 Search: ${globalWorkspace.canBM25 ? 'Yes' : 'No'}`);
  console.log(`  Vector Search: ${globalWorkspace.canVector ? 'Yes' : 'No'}`);
  console.log(`  Skills: ${globalWorkspace.skills ? 'Yes' : 'No'}`);
  console.log();

  console.log('Agent tools (auto-injected based on capabilities):');
  console.log('  Filesystem tools:');
  console.log('    - workspace_read_file');
  console.log('    - workspace_write_file');
  console.log('    - workspace_list_files');
  if (globalWorkspace.sandbox) {
    console.log('  Sandbox tools:');
    console.log('    - workspace_execute_code');
    console.log('    - workspace_execute_command');
    console.log('    - workspace_install_package');
  }
  if (globalWorkspace.canBM25 || globalWorkspace.canVector) {
    console.log('  Search tools:');
    console.log('    - workspace_search');
  }
  console.log();

  // =========================================================================
  // PART 3: Docs Agent (Own Workspace)
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: DOCS AGENT (OWN WORKSPACE)');
  console.log('='.repeat(70));
  console.log();

  console.log('The docs agent has its own workspace with brand-guidelines skill.');
  console.log('This skill provides writing guidelines for technical documentation.');
  console.log();

  const docsAgent = mastra.getAgent('docsAgent');
  const docsPrompt = 'Write a one-sentence technical description of what Mastra workflows do.';
  console.log(`Prompt: ${docsPrompt}`);
  console.log();

  try {
    console.log('Generating response...');
    const docsResponse = await docsAgent.generate(docsPrompt);
    console.log(`Response: ${docsResponse.text}`);
  } catch (error) {
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 4: Editor Agent (Code Editing)
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 4: EDITOR AGENT');
  console.log('='.repeat(70));
  console.log();

  console.log('The editor agent helps with editing code files.');
  console.log();

  const editorAgent = mastra.getAgent('editorAgent');
  const editorPrompt = 'What can you help me with?';
  console.log(`Prompt: ${editorPrompt}`);
  console.log();

  try {
    console.log('Generating response...');
    const editorResponse = await editorAgent.generate(editorPrompt);
    console.log(`Response: ${editorResponse.text}`);
  } catch (error) {
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // PART 5: Support Agent (Global Workspace + FAQ Search)
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 5: SUPPORT AGENT (GLOBAL WORKSPACE + FAQ)');
  console.log('='.repeat(70));
  console.log();

  console.log('The support agent uses the global workspace with customer-support');
  console.log('skill and can search indexed FAQ content.');
  console.log();

  const supportAgent = mastra.getAgent('supportAgent');
  const supportPrompt = 'How should I handle an angry customer who is frustrated with a billing issue?';
  console.log(`Prompt: ${supportPrompt}`);
  console.log();

  try {
    console.log('Generating response...');
    const supportResponse = await supportAgent.generate(supportPrompt);
    console.log(`Response: ${supportResponse.text}`);
  } catch (error) {
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Agent workspace patterns demonstrated:');
  console.log('  - Agent inheriting global workspace (supportAgent)');
  console.log('    → Uses shared skills from Mastra instance workspace');
  console.log('  - Agent with own workspace (docsAgent)');
  console.log('    → Has access to global + agent-specific skills');
  console.log('  - Agent with safety config (safeWriteAgent)');
  console.log('    → Must read files before writing');
  console.log();
  console.log('Workspace provides agents with:');
  console.log('  - Filesystem tools for reading/writing files');
  console.log('  - Sandbox tools for code execution (when configured)');
  console.log('  - Search tools for finding content');
  console.log('  - Skills discovery and activation');
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
