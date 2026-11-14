import { expect } from 'vitest';
import type { Scan, Evidence } from '../../src/discovery/contracts.js';
import type { Category, Playbook } from '../../src/knowledge/playbooks.js';
import type { StoredProof, Hypothesis, Job } from '../../src/investigation/store.js';
import { sanitizedVerificationInput } from '../../src/investigation/models.js';
import { discoveryCase, type DiscoveryLab } from './harness.js';
import { completedJob, investigation, modelWire, ownedScan } from './investigation.js';

type Variant = 'vulnerable' | 'patched' | 'missing' | 'absent';
type MatrixCase = {
  category: Category;
  segment: string;
  identity?: 'idor' | 'authentication_bypass' | 'bfla';
  binding: (ids: string[]) => Record<string, unknown>;
};
export const categoryMatrix: MatrixCase[] = [
  {
    category: 'idor',
    segment: 'resource',
    identity: 'idor',
    binding: ids => ({ marker: 'LAB_MARKER_OWNEDRESOURCE01', ownerProfileId: ids[0], alternateProfileId: ids[1] }),
  },
  {
    category: 'authentication_bypass',
    segment: 'auth',
    identity: 'authentication_bypass',
    binding: ids => ({ marker: 'LAB_MARKER_AUTHRESOURCE01', authenticatedProfileId: ids[0], publicProfileId: ids[1] }),
  },
  {
    category: 'bfla',
    segment: 'admin',
    identity: 'bfla',
    binding: ids => ({ marker: 'LAB_MARKER_ADMINRESOURCE01', adminProfileId: ids[0], lowProfileId: ids[1] }),
  },
  { category: 'ssrf', segment: 'ssrf', binding: () => ({}) },
  {
    category: 'misconfiguration',
    segment: 'configuration',
    binding: ids => ({ publicProfileId: ids[0], headerName: 'x-content-type-options', expectedValue: 'nosniff' }),
  },
  {
    category: 'cors',
    segment: 'cors',
    binding: ids => ({ publicProfileId: ids[0], marker: 'LAB_MARKER_CORSRESOURCE01' }),
  },
  {
    category: 'open_redirect',
    segment: 'redirect',
    binding: ids => ({
      publicProfileId: ids[0],
      parameter: 'next',
      destination: 'https://redirect.example.invalid/owned-destination',
    }),
  },
  {
    category: 'information_exposure',
    segment: 'exposure',
    binding: ids => ({ publicProfileId: ids[0], marker: 'LAB_MARKER_EXPOSURERESOURCE01', expectedAccess: 'private' }),
  },
];
/** Run one owned category/variant verification journey and return its measured outcome. */
export async function runMatrixVariant(
  lab: DiscoveryLab,
  wire: Awaited<ReturnType<typeof modelWire>>,
  scenario: MatrixCase,
  variant: Variant,
  ordinal: number,
) {
  wire.scenario.category = scenario.category;
  wire.scenario.path = `/owned/${scenario.segment}/${variant === 'missing' ? 'vulnerable' : variant}`;
  // An optimistic model must never create a finding from a deterministic negative or missing proof.
  wire.scenario.interpretation = 'CONFIRMED';
  wire.scenario.surfaceKind = scenario.category === 'ssrf' && variant !== 'absent' ? 'form' : 'endpoint';
  let scan: Scan, ids: string[], targetId: string;
  if (scenario.identity) {
    const selected = await ownedScan(lab, wire.scenario.path, scenario.identity);
    scan = selected.scan;
    ids = selected.profiles.map(item => item.id);
    targetId = selected.target.id;
  } else {
    const selected = await discoveryCase(lab, { path: wire.scenario.path });
    const admitted = await selected.admit();
    expect(admitted.status).toBe(202);
    scan = await lab.wait(String(admitted.data.id));
    ids = [selected.profile.id];
    targetId = selected.target.id;
    expect(scan.state).toBe('COMPLETED');
    expect(scan.cleanup).toBe('COMPLETE');
  }
  if (variant !== 'missing' && scenario.category !== 'ssrf')
    expect(
      (
        await lab.request(`/api/targets/${targetId}/verification-resources`, 'POST', {
          category: scenario.category,
          path: wire.scenario.path,
          ...scenario.binding(ids),
        })
      ).status,
    ).toBe(201);
  const before = await lab.stats();
  const admitted = await investigation(lab, scan);
  expect((await lab.request(`/api/investigations/${admitted.id}/plan`, 'POST', {})).status).toBe(200);
  if (scenario.category === 'ssrf') {
    const hypotheses = (await lab.request(`/api/investigations/${admitted.id}/hypotheses`)).data.items as Hypothesis[];
    expect(hypotheses).toHaveLength(1);
    const pending = (await lab.request(`/api/investigations/${admitted.id}/jobs`)).data.items as Job[];
    expect(pending[0]?.state).toBe('AWAITING_APPROVAL');
    if (variant === 'missing') {
      const refused = await lab.request(`/api/hypotheses/${hypotheses[0]!.id}/approval`, 'POST', {
        callback: 'http://unowned.example.invalid/callback',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      expect(refused.status).toBe(403);
      const current = (await lab.request(`/api/investigations/${admitted.id}`)).data;
      expect(
        (await lab.request(`/api/investigations/${admitted.id}/cancel`, 'POST', {}, Number(current.revision))).status,
      ).toBe(200);
      expect((await lab.stats())['owned-callback-received'] ?? 0).toBe(before['owned-callback-received'] ?? 0);
      expect((await lab.request(`/api/investigations/${admitted.id}/findings`)).data.items).toEqual([]);
      return {
        caseId: `owned-case-${ordinal}`,
        category: scenario.category,
        variant,
        outcome: 'AWAITING_APPROVAL',
        requests: 0,
        modelInput: null,
        ruleBinding: hypotheses[0]!.ruleBinding,
      };
    }
    const approval = await lab.request(`/api/hypotheses/${hypotheses[0]!.id}/approval`, 'POST', {
      callback: `http://${lab.boundary.address}:18080/owned/callback`,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    expect(approval.status).toBe(201);
    expect(
      (
        await lab.request(
          `/api/approvals/${approval.data.id}/decision`,
          'POST',
          { decision: 'approved', revision: approval.data.revision },
          Number(approval.data.revision),
        )
      ).status,
    ).toBe(200);
  }
  const job = await completedJob(lab, admitted.id);
  expect(job.state).toBe('COMPLETED');
  expect(job.attempts).toBe(1);
  const expected =
    variant === 'vulnerable'
      ? 'CONFIRMED'
      : variant === 'patched'
        ? 'NOT_REPRODUCED'
        : variant === 'missing'
          ? 'PRECONDITION_MISSING'
          : 'NOT_APPLICABLE';
  expect(job.result?.outcome).toBe(expected);
  const findings = (await lab.request(`/api/investigations/${admitted.id}/findings`)).data.items as unknown[];
  expect(findings).toHaveLength(variant === 'vulnerable' ? 1 : 0);
  const proofs = (await lab.request(`/api/investigations/${admitted.id}/evaluations`)).data.items as StoredProof[];
  expect(proofs).toHaveLength(1);
  const proof = proofs[0]!.proof;
  expect(proof.evidence.map(item => item.id)).toEqual(job.result?.evidenceIds);
  if (variant === 'vulnerable') {
    expect(proof.completed).toBe(true);
    expect(proof.withheld).toBe(false);
  }
  if (variant === 'missing') expect(proof.requestCount).toBe(0);
  const after = await lab.stats();
  expect(after['write-contacts'] ?? 0).toBe(before['write-contacts'] ?? 0);
  expect(after['credential-url-contacts'] ?? 0).toBe(0);
  const inventory = (await lab.request(`/api/scans/${scan.id}/inventory?limit=100`)).data.items as Evidence[];
  const serialized = JSON.stringify({ wire: wire.received, api: lab.exported, inventory });
  for (const secret of Object.values(lab.privateValues)) expect(serialized).not.toContain(secret);
  const playbooks = (await lab.request('/api/playbooks')).data.items as Playbook[];
  const playbook = playbooks.find(item => item.category === scenario.category)!;
  const hypothesis = (
    (await lab.request(`/api/investigations/${admitted.id}/hypotheses`)).data.items as Hypothesis[]
  )[0]!;
  return {
    caseId: `owned-case-${ordinal}`,
    category: scenario.category,
    variant,
    outcome: job.result?.outcome,
    requests: proof.requestCount,
    modelInput: JSON.parse(sanitizedVerificationInput(proof, playbook)),
    ruleBinding: hypothesis.ruleBinding,
  };
}
