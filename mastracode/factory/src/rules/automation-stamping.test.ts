/**
 * Automation moves flow through the governed transition path: a system-actor
 * transition stamps the rules-engine actor id into stage history (`by` on
 * entered stages, `exitedBy` on closed ones), and metrics attribute the pass
 * to automation.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { computeFactoryMetrics } from '../storage/domains/work-items/metrics.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const DISPATCHER = 'factory-rule-dispatcher';

const input = {
  externalSource: { integrationId: 'github', type: 'issue', externalId: '7' },
  title: 'Automate me',
  stages: ['intake'],
  sessions: {},
  metadata: {},
};

function automationRequest(item: { id: string; revision: number }, overrides: Partial<{ orgId: string }> = {}) {
  return {
    orgId: overrides.orgId ?? 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    board: 'work' as const,
    stage: 'triage' as const,
    expectedRevision: item.revision,
    actor: { type: 'system' as const, id: DISPATCHER },
    ingress: { type: 'rule' as const, identity: 'rule-ingress-1' },
    cause: 'test automation move',
  };
}

describe('governed automation moves', () => {
  let workItems: WorkItemsStorage;

  beforeEach(async () => {
    workItems = (await createFactoryStorageForTests()).workItems;
  });

  it('stamps the rules-engine actor on entered and exited history entries', async () => {
    const created = await workItems.upsert({ orgId: 'org1', userId: 'user_1', factoryProjectId: PROJECT_ID, input });
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage: workItems,
    });

    const result = await service.transition(automationRequest(created.item));

    expect(result).toMatchObject({ status: 'accepted', stage: 'triage' });
    const moved = await workItems.get({ orgId: 'org1', id: created.item.id });
    expect(moved!.stages).toEqual(['triage']);
    const closed = moved!.stageHistory.find(entry => entry.stage === 'intake')!;
    const opened = moved!.stageHistory.find(entry => entry.stage === 'triage')!;
    expect(closed.by).toBe('user_1'); // human created it
    expect(closed.exitedBy).toBe(DISPATCHER);
    expect(opened.by).toBe(DISPATCHER);
    expect(opened.exitedAt).toBeUndefined();

    // Metrics split human vs total accordingly: intake entered by a human,
    // triage entered by the rules engine → 1 human of 2 total.
    const metrics = computeFactoryMetrics([moved!], {
      windowStart: Date.now() - 60_000,
      windowEnd: Date.now() + 60_000,
    });
    expect(metrics.transitions).toEqual({ human: 1, total: 2 });
  });

  it('rejects items outside the org without moving them', async () => {
    const created = await workItems.upsert({ orgId: 'org1', userId: 'user_1', factoryProjectId: PROJECT_ID, input });
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage: workItems,
    });

    const result = await service.transition(automationRequest(created.item, { orgId: 'org2' }));

    expect(result).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    expect((await workItems.get({ orgId: 'org1', id: created.item.id }))!.stages).toEqual(['intake']);
  });
});
