import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, beforeEach, afterEach } from 'vitest';
import { SkillsProcessor } from '../../../../processors/processors/skills';
import { LocalFilesystem } from '../../../../workspace/filesystem';
import { Workspace } from '../../../../workspace/workspace';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * `SkillsProcessor({ injectCatalog: false })` through the real loop: no catalog in
 * the prompt, the model discovers a skill by words from its description with
 * `skill_search` (real BM25 index), then loads it with `skill`.
 */

const skillMd = (name: string, description: string, body: string) => `---
name: ${name}
description: ${description}
---

${body}
`;

describeForAllEngines('AIMock scenario: search-first skills (no catalog)', engine => {
  const getMock = useLoopScenarioAimock();
  let tempDir: string;
  let workspace: Workspace;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aimock-skills-search-first-'));
    const skills = [
      skillMd('code-review', 'Reviews code for quality and style', '# Code Review\n\nCheck for bugs and edge cases.'),
      skillMd(
        'release-notes',
        'Drafts changelogs from merged pull requests',
        '# Release Notes\n\nGroup entries by package.',
      ),
      skillMd('incident-report', 'Writes postmortems after outages', '# Incident Report\n\nStart with the timeline.'),
    ];
    for (const [i, name] of ['code-review', 'release-notes', 'incident-report'].entries()) {
      const dir = path.join(tempDir, 'skills', name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'SKILL.md'), skills[i]!);
    }
    workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      skills: ['skills'],
      bm25: true,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('finds a skill by its description and loads it without a catalog', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Write the changelog for this release.',
      workspace,
      inputProcessors: [new SkillsProcessor({ injectCatalog: false })],
      stopWhen: stepCountIs(4),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_search', name: 'skill_search', arguments: { query: 'changelogs pull requests' } }],
          },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_search' },
          { toolCalls: [{ id: 'call_load', name: 'skill', arguments: { name: 'release-notes' } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_load' }, { content: 'Loaded release-notes.' });
      },
    });

    expect(requests.length).toBe(3);

    // Every step carries the hint exactly once: it's re-added per step, never accumulated
    for (const request of requests) {
      const messages = JSON.stringify(request?.body?.messages ?? []);
      expect(messages).not.toContain('<available_skills>');
      expect(messages.split('You have a library of skills that are not listed here')).toHaveLength(2);
    }
    expect(JSON.stringify(requests[0]?.body?.messages ?? [])).not.toContain('Drafts changelogs');

    const toolNames = (requests[0]?.body?.tools ?? []).map((t: any) => t.function?.name);
    expect(toolNames).toEqual(expect.arrayContaining(['skill', 'skill_search', 'skill_read']));

    const toolResults = await output.toolResults;
    const searchResult = toolResults.find(r => r.payload.toolName === 'skill_search');
    expect(String(searchResult?.payload.result)).toContain('[release-notes]');
    expect(String(searchResult?.payload.result)).not.toContain('[incident-report]');

    const loadResult = toolResults.find(r => r.payload.toolName === 'skill');
    expect(JSON.stringify(loadResult?.payload.result)).toContain('Group entries by package');
  });
});
