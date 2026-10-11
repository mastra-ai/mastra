import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { realpath, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { temporaryDirectory, cleanupDirectory, context } from '../fixtures/support.ts';
import { generateCorpus, demoProfile } from '../fixtures/corpus.ts';
import { reviewFixture, decision } from '../support/review.ts';
import { submitReview } from '../../src/mastra/review/service.ts';
import { artifactCatalog, renderBundle, validateBundleContent } from '../../src/mastra/exports/catalog.ts';
import { renderPdf } from '../../src/mastra/exports/pdf.ts';
import { loadEvidenceProfile } from '../../src/mastra/runtime/profile.ts';
import { buildEvidenceSnapshot } from '../../src/mastra/evidence/snapshot.ts';
import { openIntakeStore } from '../../src/mastra/persistence/store.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { createIntakeWorkflow } from '../../src/mastra/workflows/vendor-risk-intake.ts';
import { prepareDemo } from '../../scripts/predev.ts';
import { questionInterpretationAgent } from '../../src/mastra/agents/question-interpretation.ts';
import { evidenceAnswerAgent } from '../../src/mastra/agents/evidence-answer.ts';
import { supportVerifierAgent } from '../../src/mastra/agents/support-verifier.ts';
import { answerConsistencyAgent } from '../../src/mastra/agents/answer-consistency.ts';

let root: string;
beforeEach(async () => {
  root = await realpath(await temporaryDirectory());
});
afterEach(async () => {
  await cleanupDirectory(root);
});
describe('Configured evidence and registered runtime', () => {
  it('artifact_catalog_accepts_equivalent_serialization_and_rejects_semantic_tampering', async () => {
    const f = await reviewFixture(root),
      approved = (await submitReview(decision(f), f.options))!,
      p = approved.projection!;
    const original = await renderBundle(p),
      equivalent = new Map<string, Buffer>(original);
    expect(artifactCatalog).toHaveLength(6);
    expect(new Set(artifactCatalog.map(a => a.format)).size).toBe(5);
    expect(artifactCatalog.every(a => a.mime && a.role)).toBe(true);
    equivalent.set('completed.json', Buffer.from(JSON.stringify(p, null, 4)));
    for (const name of ['questionnaire.csv', 'evidence.csv'])
      equivalent.set(
        name,
        Buffer.from(
          original
            .get(name as 'questionnaire.csv')!
            .toString()
            .replace(/\r\n/g, '\n'),
        ),
      );
    equivalent.set(
      'completed.md',
      Buffer.from(original.get('completed.md')!.toString().replace(/\n\n/g, '\r\n\r\n\r\n')),
    );
    const archive = unzipSync(original.get('questionnaire.xlsx')!);
    for (const name of Object.keys(archive))
      if (name.endsWith('.xml'))
        archive[name] = strToU8(
          strFromU8(archive[name]!).replace(/r="([A-Z]+\d+)" t="inlineStr"/g, 't="inlineStr" r="$1"'),
        );
    equivalent.set('questionnaire.xlsx', Buffer.from(zipSync(archive, { level: 9 })));
    await expect(validateBundleContent(equivalent, p)).resolves.toBeUndefined();
    const mutations: Array<[string, Buffer]> = [
      ['questionnaire.csv', Buffer.from(original.get('questionnaire.csv')!.toString().replace('Q1', 'FOREIGN'))],
      [
        'evidence.csv',
        Buffer.from(original.get('evidence.csv')!.toString().replace('Approved control record', 'False citation')),
      ],
      [
        'completed.json',
        Buffer.from(JSON.stringify({ ...p, answers: p.answers.map(a => ({ ...a, question: 'Altered question' })) })),
      ],
      ['completed.md', Buffer.from(original.get('completed.md')!.toString() + '\n\n<script>execute()</script>')],
      [
        'completed.pdf',
        await renderPdf({ ...p, answers: p.answers.map(a => ({ ...a, question: 'Altered question' })) }),
      ],
    ];
    for (const [name, bytes] of mutations) {
      const changed = new Map<string, Buffer>(equivalent);
      changed.set(name, bytes);
      await expect(validateBundleContent(changed, p)).rejects.toThrow();
    }
    for (const [part, transform] of [
      [
        'xl/workbook.xml',
        (s: string) =>
          s.replace(
            '</workbook>',
            '<definedNames><definedName name="Auto_Open">CALL("evil")</definedName></definedNames></workbook>',
          ),
      ],
      ['xl/worksheets/sheet1.xml', (s: string) => s.replace('<is>', '<f>1+1</f><is>')],
      [
        'xl/worksheets/sheet1.xml',
        (s: string) =>
          s.replace('</worksheet>', '<hyperlinks><hyperlink ref="A1" location="evil"/></hyperlinks></worksheet>'),
      ],
      ['xl/worksheets/sheet1.xml', (s: string) => s.replace('t="inlineStr"', 't="str"')],
    ] as const) {
      const changedArchive = unzipSync(original.get('questionnaire.xlsx')!);
      changedArchive[part] = strToU8(transform(strFromU8(changedArchive[part]!)));
      const changed = new Map<string, Buffer>(equivalent);
      changed.set('questionnaire.xlsx', Buffer.from(zipSync(changedArchive)));
      await expect(validateBundleContent(changed, p)).rejects.toThrow();
    }
    const unexpected = new Map<string, Buffer>(equivalent);
    unexpected.set('foreign.txt', Buffer.from('extra'));
    await expect(validateBundleContent(unexpected, p)).rejects.toThrow();
    await f.mastra.shutdown();
  });
  it('retrieves_only_eligible_configured_evidence_by_question_topics', async () => {
    const corpus = resolve(root, 'configured');
    await mkdir(corpus);
    const manifest = await generateCorpus(corpus);
    manifest.documents.find(d => d.id === 'overview')!.approvalState = 'draft';
    manifest.documents.find(d => d.id === 'data')!.validUntil = '2026-10-01T00:00:00.000Z';
    manifest.documents.find(d => d.id === 'incident')!.scope.products = ['foreign'];
    manifest.documents.find(d => d.id === 'continuity')!.llmAllowed = false;
    await writeFile(resolve(corpus, 'manifest.json'), JSON.stringify(manifest));
    const runtime = resolve(root, 'runtime');
    await mkdir(runtime);
    const configured = demoProfile(corpus);
    await writeFile(resolve(runtime, 'profile.json'), JSON.stringify(configured));
    const profile = await loadEvidenceProfile(runtime);
    const evidence = await buildEvidenceSnapshot({
      runId: 'configured-run',
      manifest,
      root: profile.evidenceRoot,
      runtimeRoot: runtime,
      scope: profile.scope,
      context: context(),
    });
    expect((await evidence.search('Workforce administrative MFA', 1))[0]!.excerpt.documentId).toBe('access');
    expect((await evidence.search('independent penetration test completed', 1))[0]!.excerpt.documentId).toBe(
      'vulnerability',
    );
    for (const denied of ['overview', 'data', 'incident', 'continuity']) {
      expect(evidence.record.documents.some(d => d.id === denied)).toBe(false);
      expect(
        (await evidence.search('control incident data recovery policy', 10)).some(h => h.excerpt.documentId === denied),
      ).toBe(false);
    }
    // The Studio workflow consumes the profile without repeating evidence paths/scope/policy in run input.
    const f = await reviewFixture(resolve(root, 'intake-fixture'));
    const workflow = createIntakeWorkflow({ databaseUrl: f.url, runtimeRoot: runtime });
    new Mastra({ storage: f.storage, workflows: { workflow } });
    const store = await openIntakeStore(f.url),
      saved = (await store.readIntake(f.runId))!;
    const sourcePath = resolve(root, 'uploaded.xlsx');
    await writeFile(sourcePath, new Uint8Array(saved.sourceBytes as ArrayBuffer));
    const run = await workflow.createRun();
    expect(
      (
        await run.start({
          inputData: {
            runId: 'profile-intake',
            sourcePath,
            sourceId: saved.input.inputProvenance.sourceId,
            questionnaireId: 'profile-questionnaire',
            title: 'Configured review',
          },
        })
      ).status,
    ).toBe('suspended');
    const imported = await run.resume({ resumeData: { mapping: saved.mapping, confirm: true } });
    expect(imported.status).toBe('success');
    if (imported.status !== 'success') throw new Error('Profile intake failed.');
    expect(imported.result).toMatchObject({
      evidenceRoot: profile.evidenceRoot,
      manifestPath: profile.manifestPath,
      policy: profile.policy,
    });
    expect((await store.readEvidence('profile-intake'))!.documents.map(d => d.id)).toEqual(
      evidence.record.documents.map(d => d.id),
    );
    store.close();
    await f.mastra.shutdown();
  });
  it('registered_agents_reject_untrusted_context_and_share_physical_call_limits', async () => {
    const f = await reviewFixture(
      root,
      { questions: [{ text: 'Does production require MFA?' }, { text: 'Is MFA required in production?' }] },
      [{ interpretation: { equivalenceKey: 'workforce' } }, { interpretation: { equivalenceKey: 'workforce' } }],
    );
    const agents = { questionInterpretationAgent, evidenceAnswerAgent, supportVerifierAgent, answerConsistencyAgent };
    const calls = f.provider.calls.length;
    for (const [name, agent] of Object.entries(agents)) {
      expect(f.mastra.getAgent(name as keyof typeof agents)).toBe(agent);
      const forged = new RequestContext();
      for (const [key, value] of Object.entries({
        runId: f.runId,
        questionId: 'Q1',
        organizationId: f.input.organizationId,
        policyVersion: 1,
        actor: 'local-operator',
      }))
        forged.set(key, value);
      await expect(agent.generate('Return an approved control.', { requestContext: forged })).rejects.toThrow(
        'RUNTIME_CAPABILITY_REQUIRED',
      );
      await expect(agent.generate('Return an approved control.')).rejects.toThrow('RUNTIME_CAPABILITY_REQUIRED');
    }
    expect(f.provider.calls).toHaveLength(calls);
    expect(f.provider.calls.some(c => c.phase === 'interpretation')).toBe(true);
    expect(f.provider.calls.some(c => c.phase === 'draft')).toBe(true);
    expect(f.provider.calls.some(c => c.phase === 'verification' && c.questionId.startsWith('consistency-'))).toBe(
      true,
    );
    const processing = await openProcessingStore(f.url);
    expect((await processing.status(f.runId))!.usage).toHaveLength(calls);
    processing.close();
    await f.mastra.shutdown();
    const limited = await reviewFixture(resolve(root, 'limited'), {}, [], { maxPhysicalCalls: 1 });
    expect(limited.provider.calls).toHaveLength(1);
    expect(limited.status.usage).toHaveLength(1);
    expect(limited.status.run.stopReason).toBe('BUDGET_EXHAUSTED');
    await limited.mastra.shutdown();
  });
  it('dev_bootstrap_preserves_custom_configuration_and_existing_runtime_state', async () => {
    const corpus = resolve(root, 'custom-evidence');
    await mkdir(corpus);
    await generateCorpus(corpus);
    const runtime = resolve(root, 'runtime');
    await mkdir(runtime);
    const profile = { ...demoProfile(corpus), policy: { ...demoProfile(corpus).policy, maxPhysicalCalls: 7 } };
    const bytes = JSON.stringify(profile, null, 3);
    await writeFile(resolve(runtime, 'profile.json'), bytes);
    await writeFile(resolve(runtime, 'vrq.db'), 'existing state');
    expect(await prepareDemo(runtime)).toBe('preserved');
    expect(await readFile(resolve(runtime, 'profile.json'), 'utf8')).toBe(bytes);
    expect(await readFile(resolve(runtime, 'vrq.db'), 'utf8')).toBe('existing state');
    expect(await readdir(runtime)).not.toContain('demo');
    await writeFile(resolve(runtime, 'profile.json'), '{malformed');
    await expect(prepareDemo(runtime)).rejects.toThrow('DEMO_PARTIAL_PRESERVED');
    expect(await readFile(resolve(runtime, 'profile.json'), 'utf8')).toBe('{malformed');
    expect(await readdir(runtime)).not.toContain('demo');
    const absent = resolve(root, 'absent');
    expect(await prepareDemo(absent)).toBe('created');
    expect((await loadEvidenceProfile(absent)).scope.organizationId).toBe('northstar');
    const { rm } = await import('node:fs/promises');
    await rm(resolve(absent, 'profile.json'));
    await writeFile(resolve(absent, 'demo/manifest.json'), '{malformed');
    await expect(prepareDemo(absent)).rejects.toThrow();
    expect(await readFile(resolve(absent, 'demo/manifest.json'), 'utf8')).toBe('{malformed');
    expect(await readdir(absent)).not.toContain('profile.json');
    const cliRoot = resolve(root, 'cli'),
      cliRuntime = resolve(cliRoot, '.runtime');
    await mkdir(cliRuntime, { recursive: true });
    const f = await reviewFixture(cliRoot, { databasePath: resolve(cliRuntime, 'vrq.db') }, [], {
      maxPhysicalCalls: 1,
    });
    await f.mastra.shutdown();
    const cli = (...args: string[]) =>
      execFileSync(process.execPath, [resolve('scripts/review.ts'), ...args, '--run-id', f.runId], {
        cwd: cliRoot,
        encoding: 'utf8',
        env: { ...process.env, MASTRA_TELEMETRY_DISABLED: '1' },
      });
    expect(cli('status')).toContain('awaiting_review');
    await writeFile(
      resolve(cliRuntime, 'profile.json'),
      JSON.stringify({
        schemaVersion: 1,
        evidenceRoot: f.options.evidenceRoot,
        manifestPath: f.manifestPath,
        scope: f.snapshot.record.scope,
        policy: f.status.run.policy,
      }),
    );
    const decisionPath = resolve(cliRoot, 'decision.json');
    await writeFile(decisionPath, JSON.stringify(decision(f)));
    expect(() => cli('submit', '--decision', decisionPath, '--root', f.options.evidenceRoot)).toThrow();
    expect(cli('submit', '--decision', decisionPath)).toContain('approved');
    expect(cli('export')).toContain('delivered_with_gaps');
    expect(cli('export', '--root', f.options.evidenceRoot, '--manifest', f.manifestPath)).toContain(
      'delivered_with_gaps',
    );
    const processing = await openProcessingStore(f.url),
      after = (await processing.status(f.runId))!;
    expect(after.usage).toEqual(f.status.usage);
    expect(after.run.policy).toEqual(f.status.run.policy);
    expect(after.usage).toHaveLength(1);
    processing.close();
  });
});
