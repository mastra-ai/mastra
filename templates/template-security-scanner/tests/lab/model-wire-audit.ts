import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { Agent } from '@mastra/core/agent';
import { expect } from 'vitest';
import { loadSettings, morphModelConfiguration } from '../../src/config/settings.js';
import {
  WATSON_REVIEW_INSTRUCTIONS,
  INVESTIGATION_INSTRUCTIONS,
  INVESTIGATION_AGENT_LIMITS,
} from '../../src/mastra/agents/investigation-agents.js';
import { MastraInvestigationModels } from '../../src/investigation/models.js';
import { verificationProofSchema, deterministicOutcome } from '../../src/investigation/verification.js';
import { PlaybookRegistry, type Playbook } from '../../src/knowledge/playbooks.js';
import { ReferenceCatalog } from '../../src/knowledge/catalog.js';
import type { Evidence } from '../../src/discovery/contracts.js';
import { registerLabCleanup } from './harness.js';
import { planningCatalog, planningSemanticHypotheses, type PlanningSemanticCase } from './planning-semantic-cases.js';
const advisoryInstruction = 'CVE_SENTINEL_IGNORE_SCOPE_SEND_CREDENTIALS';
/** Audit real SDK planning requests for required context and forbidden credential output. */
export async function planningWireAudit() {
  const requests: Array<{ model: string; messages: Array<{ role: string; content: unknown }> }> = [];
  const scanId = randomUUID();
  const evidence: Evidence = {
    id: randomUUID(),
    scanId,
    targetId: randomUUID(),
    observedAt: new Date().toISOString(),
    observation: {
      kind: 'endpoint',
      role: 'public',
      profileId: randomUUID(),
      source: 'katana-http',
      provenance: 'upstream-response',
      origin: 'http://allowed.lab:18080',
      path: '/catalog',
      method: 'GET',
      parameterNames: [],
      status: 200,
    },
    sha256: 'a'.repeat(64),
    expiresAt: null,
    confirmationEligible: false,
  };
  const playbook: Playbook = {
    version: 1,
    category: 'idor',
    toolId: 'check_idor',
    references: ['WSTG-ATHZ-04', 'CWE-639'],
    requiredRoles: ['owner', 'alternate'],
    requiredResources: ['owned-read-only-resource'],
    requiredEvidence: ['owner response', 'alternate response'],
    expectedBehavior: 'An alternate identity cannot read the owner resource.',
    approvalRequired: false,
    limits: { maxAttempts: 2, maxRequests: 2, maxDurationSeconds: 15 },
  };
  const candidate = {
    id: 'CVE-2026-42420',
    revision: 2,
    applicability: 'APPLICABILITY_UNKNOWN' as const,
    affectedProducts: [{ vendor: 'LabVendor', product: 'LabWidget' }],
    referenceHosts: ['example.invalid'],
  };
  const fixture = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as (typeof requests)[number];
    requests.push(body);
    const isSherlock = JSON.stringify(body.messages).includes('advisoryCandidates');
    const content = isSherlock
      ? JSON.stringify({
          hypotheses: [
            {
              origin: 'cve',
              category: 'idor',
              toolId: 'check_idor',
              scanId,
              evidenceIds: [evidence.id],
              referenceIds: ['WSTG-ATHZ-04'],
              advisoryId: candidate.id,
              advisoryRevision: candidate.revision,
              preconditions: [],
              expectedBehavior: 'Owned resource must remain scoped.',
              risk: 'passive',
              maxRequests: 2,
              maxDurationSeconds: 10,
              maxTokens: 128,
              maxRefinements: 0,
            },
          ],
        })
      : 'One bounded owned endpoint is available.';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: `chatcmpl-${requests.length}`,
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = fixture.address();
    if (!address || typeof address === 'string') throw new Error('MODEL_ADVISORY_FIXTURE_MISSING');
    const settings = loadSettings({}, '/tmp/scanner-advisory-wire');
    const configured = morphModelConfiguration(settings, { MORPH_API_KEY: 'synthetic-advisory-wire-key' });
    const explorer = new Agent({
      ...INVESTIGATION_AGENT_LIMITS,
      id: 'advisory-wire-explorer',
      name: 'Advisory Wire Explorer',
      model: { ...configured.explorer, url: `http://127.0.0.1:${address.port}/v1` },
      instructions: INVESTIGATION_INSTRUCTIONS.nemo,
    });
    const models = new MastraInvestigationModels(
      {
        nemo: explorer,
        sherlock: new Agent({
          ...INVESTIGATION_AGENT_LIMITS,
          id: 'advisory-wire-sherlock',
          name: 'Advisory Wire Sherlock',
          model: { ...configured.explorer, url: `http://127.0.0.1:${address.port}/v1` },
          instructions: INVESTIGATION_INSTRUCTIONS.sherlock,
        }),
        dupin: explorer,
        watson: explorer,
      },
      settings.EXPLORER_MODEL,
      settings.JUDGE_MODEL,
    );
    const result = await models.propose(
      scanId,
      [evidence],
      [playbook],
      [candidate],
      { maxRequests: 2, maxDurationSeconds: 10, maxTokens: 128 },
      4,
      15000,
      {
        reserve: async () => undefined,
      },
      AbortSignal.timeout(30000),
    );
    expect(requests).toHaveLength(2);
    for (const [index, request] of requests.entries()) {
      expect(Buffer.byteLength(JSON.stringify(request))).toBeLessThanOrEqual(16384);
      expect((request as unknown as { max_tokens: number }).max_tokens).toBe(index === 0 ? 512 : 2048);
      expect(
        request.messages.some(
          message =>
            message.role === 'system' &&
            message.content === (index === 0 ? INVESTIGATION_INSTRUCTIONS.nemo : INVESTIGATION_INSTRUCTIONS.sherlock),
        ),
      ).toBe(true);
    }
    expect(requests.map(item => JSON.stringify(item).includes('advisoryCandidates'))).toEqual([false, true]);
    expect(result.value[0]).toMatchObject({ origin: 'cve', advisoryId: candidate.id, advisoryRevision: 2 });
    const sherlockWire = JSON.stringify(requests[1]);
    const sherlock = requests[1]! as (typeof requests)[number] & {
      response_format: { json_schema: { schema: any } };
    };
    const planningInput = JSON.parse(String(sherlock.messages.findLast(message => message.role === 'user')?.content));
    expect(planningInput.planningLimits).toEqual({ maxRequests: 2, maxDurationSeconds: 10, maxTokens: 128 });
    expect({ ...planningInput.effectiveLimitDefaults, ...planningInput.playbooks[0].limits }).toMatchObject({
      maxRequests: 2,
      maxDurationSeconds: 10,
      maxTokens: 128,
    });
    const constraints = sherlock.response_format.json_schema.schema.properties.hypotheses.items.properties;
    expect(constraints.maxRequests).toMatchObject({ minimum: 1, maximum: 2 });
    expect(constraints.maxDurationSeconds).toMatchObject({ minimum: 1, maximum: 10 });
    expect(constraints.maxTokens).toMatchObject({ minimum: 1, maximum: 128 });
    expect(sherlockWire).toContain(candidate.id);
    expect(sherlockWire).toContain('APPLICABILITY_UNKNOWN');
    expect(sherlockWire).toContain('LabWidget');
    expect(sherlockWire).not.toContain(advisoryInstruction);
    expect(sherlockWire).not.toContain('synthetic-advisory-wire-key');
    expect(JSON.stringify(requests[0])).not.toContain('advisoryCandidates');
  } finally {
    await new Promise<void>((resolve, reject) => fixture.close(error => (error ? reject(error) : resolve())));
  }
}

/** Audit the independent review request using the exact sanitized verification context. */
export async function reviewWireAudit() {
  const requests: Array<{ model: string; messages: Array<{ role: string; content: unknown }> }> = [];
  const fixture = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as {
      model: string;
      messages: Array<{ role: string; content: unknown }>;
    };
    requests.push(body);
    const judge = body.model === 'morph-glm53-744b';
    const input = JSON.parse(String(body.messages.findLast(message => message.role === 'user')?.content)) as {
      category: string;
      facts: { alternateMatchesOwnerMarker?: boolean };
    };
    const supportsConfirmation = input.facts?.alternateMatchesOwnerMarker === true;
    const answer = judge
      ? { vote: supportsConfirmation ? 'agree' : 'disagree', reasonCode: 'OWNED_WIRE_EVIDENCE' }
      : {
          category: input.category,
          outcome: !input.facts
            ? 'INCONCLUSIVE'
            : input.category !== 'idor' || supportsConfirmation
              ? 'CONFIRMED'
              : 'NOT_REPRODUCED',
        };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: `chatcmpl-${requests.length}`,
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(answer) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = fixture.address();
    if (!address || typeof address === 'string') throw new Error('MODEL_REVIEW_FIXTURE_MISSING');
    const settings = loadSettings({}, '/tmp/scanner-review-wire');
    const configured = morphModelConfiguration(settings, { MORPH_API_KEY: 'synthetic-review-wire-key' });
    const explorer = new Agent({
      ...INVESTIGATION_AGENT_LIMITS,
      id: 'review-explorer',
      name: 'Review Explorer',
      model: { ...configured.explorer, url: `http://127.0.0.1:${address.port}/v1` },
      instructions: INVESTIGATION_INSTRUCTIONS.dupin,
    });
    const judge = new Agent({
      ...INVESTIGATION_AGENT_LIMITS,
      id: 'review-judge',
      name: 'Review Judge',
      model: { ...configured.judge, url: `http://127.0.0.1:${address.port}/v1` },
      instructions: WATSON_REVIEW_INSTRUCTIONS,
    });
    const models = new MastraInvestigationModels(
      { nemo: explorer, sherlock: explorer, dupin: explorer, watson: judge },
      settings.EXPLORER_MODEL,
      settings.JUDGE_MODEL,
    );
    const playbook: Playbook = {
      version: 1,
      category: 'idor',
      toolId: 'check_idor',
      references: ['WSTG-ATHZ-04', 'CWE-639'],
      requiredRoles: ['owner', 'alternate'],
      requiredResources: ['owned-read-only-resource'],
      requiredEvidence: ['owner response', 'alternate response'],
      expectedBehavior: 'An alternate identity cannot read the owner resource.',
      approvalRequired: false,
      limits: { maxAttempts: 2, maxRequests: 2, maxDurationSeconds: 15 },
    };
    const ownerMarker = 'LAB_MARKER_OWNEDRESOURCE01';
    /** Build an IDOR verification proof with the selected alternate-role marker. */
    const proof = (alternateMarker: string | null) =>
      verificationProofSchema.parse({
        source: 'owned-gateway',
        category: 'idor',
        completed: true,
        surfacePresent: true,
        prerequisitesReady: true,
        identityValid: true,
        scopeApproved: true,
        requestCount: 2,
        evidence: [
          { id: randomUUID(), kind: 'owner response' },
          { id: randomUUID(), kind: 'alternate response' },
        ],
        observation: {
          category: 'idor',
          ownerStatus: 200,
          alternateStatus: alternateMarker ? 200 : 403,
          ownerIdentity: 'private-owner-profile-id',
          alternateIdentity: 'private-alternate-profile-id',
          resourceOwned: true,
          ownerMarker,
          alternateMarker,
        },
        withheld: false,
      });
    const budget = {
      reserve: async (_role: string, inputBytes: number, outputTokens: number) => {
        expect(inputBytes).toBeLessThan(8192);
        expect(outputTokens).toBe(512);
      },
    };
    const signal = AbortSignal.timeout(15000);
    const vulnerable = proof(ownerMarker);
    const patched = proof(null);
    expect((await models.interpret(vulnerable, playbook, 10000, budget, signal)).value.outcome).toBe('CONFIRMED');
    expect((await models.review(vulnerable, playbook, 10000, budget, signal)).value.vote).toBe('agree');
    expect((await models.interpret(patched, playbook, 10000, budget, signal)).value.outcome).toBe('NOT_REPRODUCED');
    expect((await models.review(patched, playbook, 10000, budget, signal)).value.vote).toBe('disagree');
    expect(requests).toHaveLength(4);
    for (const request of requests.filter(item => item.model === 'morph-glm53-744b'))
      expect(
        request.messages.some(message => message.role === 'system' && message.content === WATSON_REVIEW_INSTRUCTIONS),
      ).toBe(true);
    const prompts = requests.map(item => item.messages.findLast(message => message.role === 'user')?.content);
    expect(prompts.every(item => typeof item === 'string')).toBe(true);
    const facts = prompts.map(item => JSON.parse(String(item)) as Record<string, unknown>);
    expect(facts[0]).toEqual(facts[1]);
    expect(facts[2]).toEqual(facts[3]);
    expect(facts[0]).toMatchObject({
      assessment: { claim: 'VULNERABILITY_PRESENT', criterionMeaning: 'SECURE_BEHAVIOR' },
      expectedCriterion: playbook.expectedBehavior,
      source: 'owned-gateway',
      completed: true,
      requestCount: 2,
      facts: { ownerStatus: 200, alternateStatus: 200, alternateMatchesOwnerMarker: true },
    });
    expect(facts[2]).toMatchObject({
      facts: { ownerStatus: 200, alternateStatus: 403, alternateMatchesOwnerMarker: false },
    });
    for (const literal of [ownerMarker, 'private-owner-profile-id', 'private-alternate-profile-id'])
      expect(JSON.stringify(requests)).not.toContain(literal);
    expect(facts.every(item => !('assessed' in item))).toBe(true);

    const headerValue = 'private-header-value';
    const headerProof = verificationProofSchema.parse({
      ...vulnerable,
      category: 'misconfiguration',
      evidence: [{ id: randomUUID(), kind: 'observed header' }],
      observation: {
        category: 'misconfiguration',
        headerName: 'x-private-header',
        expectedValue: 'expected-private-header-value',
        observedValue: headerValue,
      },
    });
    const headerPlaybook: Playbook = {
      ...playbook,
      category: 'misconfiguration',
      toolId: 'check_configuration',
      requiredEvidence: ['observed header'],
      expectedBehavior: 'The documented security header matches its expected value.',
    };
    await models.review(headerProof, headerPlaybook, 10000, budget, signal);
    const destination = 'https://destination.example/private?token=private';
    const redirectProof = verificationProofSchema.parse({
      ...vulnerable,
      category: 'open_redirect',
      evidence: [{ id: randomUUID(), kind: 'Location header' }],
      observation: {
        category: 'open_redirect',
        approvedOrigin: 'https://owned.example',
        submittedDestination: destination,
        location: destination,
        followed: false,
      },
    });
    const redirectPlaybook: Playbook = {
      ...playbook,
      category: 'open_redirect',
      toolId: 'check_redirect',
      requiredEvidence: ['Location header'],
      expectedBehavior: 'The controlled parameter cannot direct the browser outside the approved origin.',
    };
    await models.review(redirectProof, redirectPlaybook, 10000, budget, signal);
    const exposureMarker = 'LAB_MARKER_PRIVATEEXPOSURE01';
    const exposureProof = verificationProofSchema.parse({
      ...vulnerable,
      category: 'information_exposure',
      evidence: [{ id: randomUUID(), kind: 'response marker' }],
      observation: {
        category: 'information_exposure',
        marker: exposureMarker,
        observedMarker: exposureMarker,
        publicResponse: true,
      },
    });
    const exposurePlaybook: Playbook = {
      ...playbook,
      category: 'information_exposure',
      toolId: 'check_exposure',
      requiredEvidence: ['response marker'],
      expectedBehavior: 'The known harmless marker is absent from the public response.',
    };
    await models.review(exposureProof, exposurePlaybook, 10000, budget, signal);
    expect(requests).toHaveLength(7);
    for (const request of requests) {
      expect(Buffer.byteLength(JSON.stringify(request))).toBeLessThanOrEqual(16384);
      expect((request as unknown as { max_tokens: number }).max_tokens).toBe(512);
      for (const key of ['synthetic-review-wire-key', 'synthetic-advisory-wire-key'])
        expect(JSON.stringify(request)).not.toContain(key);
    }
    const additionalFacts = requests
      .slice(4)
      .map(
        item =>
          JSON.parse(String(item.messages.findLast(message => message.role === 'user')?.content)) as Record<
            string,
            unknown
          >,
      );
    expect(additionalFacts[0]).toMatchObject({
      facts: { observedHeaderPresent: true, observedMatchesExpected: false },
    });
    expect(additionalFacts[1]).toMatchObject({
      facts: {
        locationPresent: true,
        locationOutsideApprovedOrigin: true,
        destinationOutsideApprovedOrigin: true,
        locationMatchesSubmittedDestination: true,
        followed: false,
      },
    });
    expect(additionalFacts[2]).toMatchObject({ facts: { publicResponse: true, observedMatchesKnownMarker: true } });
    for (const literal of [headerValue, 'expected-private-header-value', destination, exposureMarker])
      expect(JSON.stringify(requests)).not.toContain(literal);
    const unsafe = verificationProofSchema.parse({
      ...vulnerable,
      evidence: [{ id: randomUUID(), kind: 'credential literal' }],
    });
    await expect(models.review(unsafe, playbook, 10000, budget, signal)).rejects.toThrow('MODEL_REVIEW_PROOF_INVALID');
    expect(requests).toHaveLength(7);
    const catalog = new ReferenceCatalog('file::memory:');
    try {
      const registry = new PlaybookRegistry(catalog);
      await registry.initialize();
      const observations = {
        idor: [vulnerable.observation, patched.observation],
        authentication_bypass: [true, false].map(exposed => ({
          category: 'authentication_bypass',
          protectedStatus: 200,
          publicStatus: exposed ? 200 : 403,
          invalidSessionStatus: 403,
          protectedMarker: ownerMarker,
          publicMarker: exposed ? ownerMarker : null,
          invalidSessionMarker: null,
        })),
        bfla: [true, false].map(exposed => ({
          category: 'bfla',
          adminStatus: 200,
          lowStatus: exposed ? 200 : 403,
          adminMarker: ownerMarker,
          lowMarker: exposed ? ownerMarker : null,
          rolesDistinct: true,
          readOnly: true,
        })),
        ssrf: [true, false].map(observed => ({
          category: 'ssrf',
          environment: 'lab',
          approvalId: randomUUID(),
          approvalCurrent: true,
          ownedCallback: true,
          callbackObserved: observed,
        })),
        misconfiguration: [
          headerProof.observation,
          { ...headerProof.observation, observedValue: 'expected-private-header-value' },
        ],
        cors: [true, false].map(readable => ({
          category: 'cors',
          browserCrossOrigin: true,
          sensitiveFixture: true,
          responseReadable: readable,
        })),
        open_redirect: [
          redirectProof.observation,
          { ...redirectProof.observation, location: 'https://owned.example/private-local' },
        ],
        information_exposure: [exposureProof.observation, { ...exposureProof.observation, observedMarker: null }],
      };
      for (const rule of await registry.list()) {
        const pair = [];
        for (const observation of observations[rule.category]) {
          const input = verificationProofSchema.parse({
            ...vulnerable,
            category: rule.category,
            observation,
            evidence: rule.requiredEvidence.map(kind => ({ id: randomUUID(), kind })),
          });
          const first = requests.length;
          await models.interpret(input, rule, 10000, budget, signal);
          await models.review(input, rule, 10000, budget, signal);
          const [interpretationInput, independentJudgeInput] = requests
            .slice(first)
            .map(request => JSON.parse(String(request.messages.findLast(message => message.role === 'user')?.content)));
          expect(interpretationInput).toEqual(independentJudgeInput);
          expect(interpretationInput.assessment).toMatchObject({
            claim: 'VULNERABILITY_PRESENT',
            criterionMeaning: rule.category === 'ssrf' ? 'AUTHORIZED_REPRODUCTION' : 'SECURE_BEHAVIOR',
          });
          expect(typeof interpretationInput.assessment.confirmationCondition).toBe('string');
          expect(Object.keys(interpretationInput).sort()).toEqual(
            [
              'assessment',
              'category',
              'completed',
              'evidence',
              'expectedCriterion',
              'facts',
              'identityValid',
              'prerequisitesReady',
              'requestCount',
              'scopeApproved',
              'source',
              'surfacePresent',
              'withheld',
            ].sort(),
          );
          expect(interpretationInput.expectedCriterion).toBe(rule.expectedBehavior);
          pair.push(interpretationInput);
        }
        expect(pair[0].assessment).toEqual(pair[1].assessment);
        expect(pair[0].facts).not.toEqual(pair[1].facts);
      }
      for (const [location, relation] of [
        [null, null],
        ['https://owned.example/private-local', false],
        ['https://different.example/private-other', true],
      ] as const) {
        await models.review(
          verificationProofSchema.parse({ ...redirectProof, observation: { ...redirectProof.observation, location } }),
          redirectPlaybook,
          10000,
          budget,
          signal,
        );
        const input = JSON.parse(
          String(requests.at(-1)?.messages.findLast(message => message.role === 'user')?.content),
        );
        expect(input.facts).toMatchObject({
          locationPresent: location !== null,
          locationOutsideApprovedOrigin: relation,
          locationMatchesSubmittedDestination: false,
        });
      }
      for (const flags of [
        { completed: false, observation: undefined },
        { withheld: true },
        { identityValid: false },
        { prerequisitesReady: false },
        { surfacePresent: false },
      ]) {
        const input = verificationProofSchema.parse({ ...vulnerable, ...flags });
        await models.interpret(input, playbook, 10000, budget, signal);
        const wireInput = JSON.parse(
          String(requests.at(-1)?.messages.findLast(message => message.role === 'user')?.content),
        );
        expect(wireInput).toMatchObject({
          completed: input.completed,
          withheld: input.withheld,
          identityValid: input.identityValid,
        });
        if (!input.observation) expect(wireInput.facts).toBeNull();
        expect(deterministicOutcome(playbook, input, 'CONFIRMED', 'agree')).toBe(
          !input.surfacePresent
            ? 'NOT_APPLICABLE'
            : !input.prerequisitesReady
              ? 'PRECONDITION_MISSING'
              : !input.identityValid
                ? 'AUTH_REQUIRED'
                : 'INCONCLUSIVE',
        );
      }
      for (const request of requests) {
        expect(Buffer.byteLength(JSON.stringify(request))).toBeLessThanOrEqual(16384);
        expect((request as unknown as { max_tokens: number }).max_tokens).toBe(512);
        const input = JSON.parse(String(request.messages.findLast(message => message.role === 'user')?.content));
        for (const field of ['variant', 'groundTruth', 'outcome', 'vote', 'assessed', 'expectedOutcome'])
          expect(input).not.toHaveProperty(field);
        for (const literal of [
          ownerMarker,
          'private-owner-profile-id',
          'private-alternate-profile-id',
          headerValue,
          'expected-private-header-value',
          destination,
          exposureMarker,
          'https://owned.example/private-local',
          'https://different.example/private-other',
        ])
          expect(JSON.stringify(request)).not.toContain(literal);
      }
    } finally {
      await catalog.close();
    }
  } finally {
    await new Promise<void>((resolve, reject) => fixture.close(error => (error ? reject(error) : resolve())));
  }
}

// Paid models are replaced only at their outer HTTP boundary; SDK parsing remains real.
/** Exercise planning and review wire contracts against bounded local model responses. */
export async function semanticModelWire() {
  const scenario = {
    interpretation: 'CONFIRMED',
    vote: 'agree',
    planning: 'valid',
    delayMs: 0,
    maxRequests: 2,
    maxDurationSeconds: 15,
    maxTokens: 128,
    summaryBytes: 50,
    semanticCase: null as PlanningSemanticCase | null,
  };
  const received: Array<{ role: string; body: any }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > 16384) {
        response.writeHead(413);
        response.end();
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const system = body.messages
      .filter((message: any) => message.role === 'system')
      .map((message: any) => message.content)
      .join('\n');
    const role = Object.entries(INVESTIGATION_INSTRUCTIONS).find(([, instructions]) => instructions === system)?.[0];
    if (!role) {
      response.writeHead(400);
      response.end();
      return;
    }
    received.push({ role, body });
    const input = JSON.parse(body.messages.findLast((message: any) => message.role === 'user').content);
    if (scenario.planning === 'http-error') {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end('{"error":{"message":"LOCAL_FIXTURE_UNAVAILABLE"}}');
      return;
    }
    let content: string;
    if (role === 'nemo') {
      if (scenario.delayMs) await new Promise(resolve => setTimeout(resolve, scenario.delayMs));
      content = 'Only supplied owned inventory is summarized. '.padEnd(scenario.summaryBytes, ' ');
    } else if (role === 'sherlock') {
      const book = planningCatalog(input).find((item: any) => item.category === 'idor');
      const evidence = input.evidence.find((item: any) => item.kind === 'endpoint');
      content =
        scenario.planning === 'invalid-schema'
          ? '{"hypotheses":"UNTRUSTED_MODEL_OUTPUT"}'
          : JSON.stringify({
              hypotheses: scenario.semanticCase
                ? planningSemanticHypotheses(input, scenario.semanticCase)
                : [
                    {
                      origin: 'playbook',
                      category: 'idor',
                      toolId: book.toolId,
                      scanId: input.scanId,
                      evidenceIds: [scenario.planning === 'ungrounded' ? randomUUID() : evidence.id],
                      referenceIds: [book.references[0]],
                      preconditions: [],
                      expectedBehavior: 'An alternate identity cannot read the owner resource.',
                      risk: scenario.planning === 'risk-mismatch' ? 'active' : 'passive',
                      maxRequests: scenario.maxRequests,
                      maxDurationSeconds: scenario.maxDurationSeconds,
                      maxTokens: scenario.maxTokens,
                      maxRefinements: 0,
                    },
                  ],
            });
    } else
      content = JSON.stringify(
        role === 'dupin'
          ? { category: input.category, outcome: scenario.interpretation }
          : { vote: scenario.vote, reasonCode: 'SCRIPTED_LOCAL_WIRE' },
      );
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: `local-${received.length}`,
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      }),
    );
  });
  server.requestTimeout = 10000;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('MODEL_FIXTURE_ADDRESS_MISSING');
  registerLabCleanup(
    () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  );
  const settings = loadSettings({}, '/tmp/scanner-semantic-wire');
  const configured = morphModelConfiguration(settings, { MORPH_API_KEY: 'synthetic-semantic-wire-key' });
  const agents = Object.fromEntries(
    Object.entries(INVESTIGATION_INSTRUCTIONS).map(([role, instructions]) => [
      role,
      new Agent({
        ...INVESTIGATION_AGENT_LIMITS,
        id: `semantic-${role}`,
        name: role,
        instructions,
        model: {
          ...(role === 'watson' ? configured.judge : configured.explorer),
          url: `http://127.0.0.1:${address.port}/v1`,
        },
      }),
    ]),
  );
  return {
    scenario,
    received,
    models: new MastraInvestigationModels(agents as any, settings.EXPLORER_MODEL, settings.JUDGE_MODEL),
  };
}
