import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { realpath, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { temporaryDirectory, cleanupDirectory, context } from '../fixtures/support.ts';
import { generateCorpus, demoProfile } from '../fixtures/corpus.ts';
import { reviewFixture, decision } from '../support/review.ts';
import { submitReview } from '../../src/mastra/review/service.ts';
import { prepareCompletion, sourceBytes } from '../../src/mastra/persistence/completion.ts';
import { writeDocument, validateDocument } from '../../src/mastra/completion/document.ts';
import { loadEvidenceProfile } from '../../src/mastra/runtime/profile.ts';
import { buildEvidenceSnapshot } from '../../src/mastra/evidence/snapshot.ts';
import { openIntakeStore } from '../../src/mastra/persistence/store.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { createIntakeWorkflow } from '../../src/mastra/workflows/vendor-risk-intake.ts';
import { prepareDemo } from '../../scripts/generate-demo.ts';
import { questionInterpretationAgent } from '../../src/mastra/agents/question-interpretation.ts';
import { evidenceAnswerAgent } from '../../src/mastra/agents/evidence-answer.ts';
import { supportVerifierAgent } from '../../src/mastra/agents/support-verifier.ts';
import { answerConsistencyAgent } from '../../src/mastra/agents/answer-consistency.ts';

let root: string;
beforeEach(async () => {
  root = await realpath(await temporaryDirectory());
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await cleanupDirectory(root);
});
describe('Configured evidence and registered runtime', () => {
  it('document_validator_accepts_zip_recompression_and_rejects_unapproved_xml_edits', async () => {
    const f = await reviewFixture(root),
      approved = (await submitReview(decision(f), f.options))!;
    const store = await openIntakeStore(f.url),
      intake = (await store.readIntake(f.runId))!;
    const plan = await prepareCompletion(f.url, f.runId),
      original = sourceBytes(intake.sourceBytes);
    const output = writeDocument(original, plan, approved.projection!);
    expect(() => validateDocument(original, output, plan, approved.projection!)).not.toThrow();
    const { unzipSync, zipSync, strFromU8, strToU8 } = await import('fflate');
    expect(() =>
      validateDocument(original, zipSync(unzipSync(output), { level: 9 }), plan, approved.projection!),
    ).not.toThrow();
    for (const mutation of [
      '<f>1+1</f>',
      '<hyperlink ref="A1" location="evil"/>',
      '<definedName name="Auto_Open">CALL("evil")</definedName>',
    ]) {
      const entries = unzipSync(output),
        part = 'xl/worksheets/sheet1.xml';
      entries[part] = strToU8(strFromU8(entries[part]!).replace('</worksheet>', mutation + '</worksheet>'));
      expect(() => validateDocument(original, zipSync(entries), plan, approved.projection!)).toThrow();
    }
    store.close();
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
    vi.stubEnv('VRQ_MODEL', 'openai/gpt-5-mini');
    const profile = await loadEvidenceProfile(runtime);
    expect(profile.policy.model).toBe('openai/gpt-5-mini');
    expect(JSON.parse(await readFile(resolve(runtime, 'profile.json'), 'utf8'))).toEqual(configured);
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
  it('registered_agents_reject_untrusted_context', async () => {
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
  });
  it('demo_generation_preserves_custom_configuration_and_existing_runtime_state', async () => {
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
    const f = await reviewFixture(cliRoot, { databasePath: resolve(cliRuntime, 'vrq.db') }, [{ value: 'unknown' }]);
    await submitReview(decision(f), f.options);
    const approvedStore = await openProcessingStore(f.url),
      approvedUsage = (await approvedStore.status(f.runId))!.usage;
    await approvedStore.close();
    await f.mastra.shutdown();
    const cli = (...args: string[]) =>
      execFileSync(process.execPath, [resolve('scripts/review.ts'), ...args, '--run-id', f.runId], {
        cwd: cliRoot,
        encoding: 'utf8',
        env: { ...process.env, MASTRA_TELEMETRY_DISABLED: '1' },
      });
    expect(cli('status')).toContain('approved');
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
    expect(after.usage).toEqual(approvedUsage);
    expect(after.run.policy).toEqual(f.status.run.policy);
    processing.close();
  });
});
