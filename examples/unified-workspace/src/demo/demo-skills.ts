/**
 * Skills Demo
 *
 * Demonstrates the Skills API within Workspace:
 * - Skills discovery and listing
 * - Skills search (BM25)
 * - Skill CRUD operations
 * - Skill assets (references, scripts, assets)
 * - Agent workspace inheritance
 *
 * Run with: pnpm demo:skills
 */

import { globalWorkspace, docsAgentWorkspace } from '../mastra/workspaces';

async function main() {
  console.log('='.repeat(70));
  console.log('SKILLS DEMO');
  console.log('='.repeat(70));
  console.log();

  // Initialize workspaces
  console.log('Initializing workspaces...');
  await globalWorkspace.init();
  await docsAgentWorkspace.init();
  console.log();

  // =========================================================================
  // PART 1: Skills Discovery
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 1: SKILLS DISCOVERY');
  console.log('='.repeat(70));
  console.log();

  // Global workspace skills
  console.log('Global Workspace Skills (skillsPaths: ["/skills"]):');
  if (globalWorkspace.skills) {
    const globalSkills = await globalWorkspace.skills.list();
    for (const skill of globalSkills) {
      console.log(`  - ${skill.name}`);
    }
    console.log(`  Total: ${globalSkills.length} skills`);
  }
  console.log();

  // Agent-specific workspace skills (inherits global + adds own)
  console.log('Docs Agent Workspace Skills (skillsPaths: ["/skills", "/docs-skills"]):');
  if (docsAgentWorkspace.skills) {
    const agentSkills = await docsAgentWorkspace.skills.list();
    for (const skill of agentSkills) {
      const isAgentSpecific = skill.name === 'brand-guidelines';
      console.log(`  - ${skill.name}${isAgentSpecific ? ' (agent-specific)' : ' (inherited)'}`);
    }
    console.log(`  Total: ${agentSkills.length} skills`);
  }
  console.log();

  // =========================================================================
  // PART 2: Get Skill Details
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 2: GET SKILL DETAILS');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.skills) {
    const skills = await globalWorkspace.skills.list();
    if (skills.length > 0) {
      const skillName = skills[0].name;
      console.log(`Getting details for "${skillName}":`);
      const skill = await globalWorkspace.skills.get(skillName);
      if (skill) {
        console.log(`  Name: ${skill.name}`);
        console.log(`  Description: ${skill.description?.slice(0, 60) || 'N/A'}...`);
        console.log(`  Instructions: ${skill.instructions.length} characters`);
        console.log(`  Allowed tools: ${skill.allowedTools?.join(', ') || 'None'}`);
        console.log(`  Disallowed tools: ${skill.disallowedTools?.join(', ') || 'None'}`);
      }
    }
  }
  console.log();

  // =========================================================================
  // PART 3: Skills Search
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 3: SKILLS SEARCH');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.skills) {
    console.log('Searching global workspace for "code review":');
    const codeReviewResults = await globalWorkspace.skills.search('code review', { topK: 3 });
    for (const result of codeReviewResults) {
      console.log(`  - [${result.skillName}] score: ${result.score.toFixed(3)}`);
    }
    console.log();

    console.log('Searching global workspace for "api design":');
    const apiResults = await globalWorkspace.skills.search('api design', { topK: 3 });
    for (const result of apiResults) {
      console.log(`  - [${result.skillName}] score: ${result.score.toFixed(3)}`);
    }
    console.log();
  }

  if (docsAgentWorkspace.skills) {
    console.log('Searching docs agent workspace for "brand":');
    const brandResults = await docsAgentWorkspace.skills.search('brand', { topK: 3 });
    for (const result of brandResults) {
      console.log(`  - [${result.skillName}] score: ${result.score.toFixed(3)}`);
    }
    console.log();
  }

  // =========================================================================
  // PART 4: Skill Assets (References, Scripts, Assets)
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 4: SKILL ASSETS');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.skills) {
    const skills = await globalWorkspace.skills.list();
    for (const skillMeta of skills) {
      console.log(`Skill: ${skillMeta.name}`);

      // List references
      const references = await globalWorkspace.skills.listReferences(skillMeta.name);
      if (references.length > 0) {
        console.log(`  References (${references.length}):`);
        for (const ref of references) {
          console.log(`    - ${ref}`);
        }
      }

      // List scripts
      const scripts = await globalWorkspace.skills.listScripts(skillMeta.name);
      if (scripts.length > 0) {
        console.log(`  Scripts (${scripts.length}):`);
        for (const script of scripts) {
          console.log(`    - ${script}`);
        }
      }

      // List assets
      const assets = await globalWorkspace.skills.listAssets(skillMeta.name);
      if (assets.length > 0) {
        console.log(`  Assets (${assets.length}):`);
        for (const asset of assets) {
          console.log(`    - ${asset}`);
        }
      }

      if (references.length === 0 && scripts.length === 0 && assets.length === 0) {
        console.log('  (no assets)');
      }

      // Demonstrate getReference/getScript/getAsset (returns content or null)
      if (references.length > 0) {
        const refContent = await globalWorkspace.skills.getReference(skillMeta.name, references[0]);
        console.log(`  getReference("${references[0]}"): ${refContent ? `${refContent.length} chars` : 'null'}`);
      }
      if (scripts.length > 0) {
        const scriptContent = await globalWorkspace.skills.getScript(skillMeta.name, scripts[0]);
        console.log(`  getScript("${scripts[0]}"): ${scriptContent ? `${scriptContent.length} chars` : 'null'}`);
      }
      if (assets.length > 0) {
        const assetContent = await globalWorkspace.skills.getAsset(skillMeta.name, assets[0]);
        console.log(`  getAsset("${assets[0]}"): ${assetContent ? `${assetContent.length} bytes` : 'null'}`);
      }
      console.log();
    }

    // Demonstrate getReference for non-existent path
    console.log('Getting non-existent reference:');
    const noRef = await globalWorkspace.skills.getReference('code-review', 'nonexistent.md');
    console.log(`  getReference("nonexistent.md"): ${noRef === null ? 'null (expected)' : 'unexpected value'}`);
    console.log();
  }

  // =========================================================================
  // PART 5: Refresh Skills
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 5: REFRESH SKILLS');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.skills) {
    console.log('Refreshing skills cache...');
    await globalWorkspace.skills.refresh();
    const skillsAfterRefresh = await globalWorkspace.skills.list();
    console.log(`  Skills after refresh: ${skillsAfterRefresh.length}`);
    console.log('  refresh() re-scans skillsPaths for new/changed SKILL.md files');
  }
  console.log();

  // =========================================================================
  // PART 6: Skill CRUD Operations
  // =========================================================================
  console.log('='.repeat(70));
  console.log('PART 6: SKILL CRUD OPERATIONS');
  console.log('='.repeat(70));
  console.log();

  if (globalWorkspace.skills) {
    const testSkillName = 'test-skill';

    // Create
    console.log('Creating a new skill...');
    try {
      const newSkill = await globalWorkspace.skills.create({
        metadata: {
          name: testSkillName,
          description: 'A test skill created by the demo',
          allowedTools: ['workspace_read_file', 'workspace_list_files'],
        },
        instructions: 'This is a test skill. Follow these instructions when activated.',
      });
      console.log(`  Created: ${newSkill.name}`);
      console.log(`  Description: ${newSkill.description}`);
      console.log();

      // Verify it exists
      const hasSkill = await globalWorkspace.skills.has(testSkillName);
      console.log(`  Skill exists: ${hasSkill}`);
      console.log();

      // Update
      console.log('Updating the skill...');
      const updatedSkill = await globalWorkspace.skills.update(testSkillName, {
        description: 'An updated test skill description',
        instructions: 'Updated instructions for the test skill.',
      });
      console.log(`  Updated description: ${updatedSkill.description}`);
      console.log();

      // Delete
      console.log('Deleting the skill...');
      await globalWorkspace.skills.delete(testSkillName);
      const stillExists = await globalWorkspace.skills.has(testSkillName);
      console.log(`  Skill exists after delete: ${stillExists}`);
      console.log();
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('Skills API features demonstrated:');
  console.log('  - list(): Discover skills from skillsPaths');
  console.log('  - get(): Get full skill details');
  console.log('  - search(): BM25 search across skill content');
  console.log('  - has(): Check if skill exists');
  console.log('  - refresh(): Re-scan skillsPaths for changes');
  console.log('  - create(): Create new SKILL.md file');
  console.log('  - update(): Update existing skill');
  console.log('  - delete(): Remove skill');
  console.log('  - listReferences/Scripts/Assets(): List skill assets');
  console.log('  - getReference/Script/Asset(): Get individual asset content');
  console.log();
  console.log('Workspace inheritance pattern:');
  console.log('  - Global workspace: /skills');
  console.log('  - Agent workspace: /skills + /docs-skills (inherits + extends)');
  console.log();
  console.log('='.repeat(70));
  console.log('Demo complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);
