import { describe, expect, it } from 'vitest';

import type { FactoryRuleItemContext, FactoryStageRuleContext } from '../rules/types.js';
import { createProviderWorkItemForTests } from '../storage/test-utils.js';
import { cardRuleFacts } from './card-facts.js';
import { phaseRunDecision } from './phase-runner.js';
import { selfReviewWorkBoard, triageWorkBoard } from './test-utils.js';
import { BUILD_OBJECTIVE, workBoard } from './work.js';

function entering(
  source: FactoryRuleItemContext['source'],
  fromStage: string,
  toStage: string,
): Pick<FactoryStageRuleContext, 'ingress' | 'item' | 'fromStage'> {
  return {
    ingress: { type: 'rule', id: 'ingress-1' },
    fromStage,
    item: {
      id: 'item-1',
      source,
      sourceKey: 'source-1',
      parentWorkItemId: null,
      title: 'Fix the issue',
      url: 'https://github.com/acme/app/issues/3',
      stages: [toStage],
      acceptedAt: null,
      metadata: {},
      workItem: createProviderWorkItemForTests({
        id: 'item-1',
        title: 'Fix the issue',
        source: { integrationId: 'github', type: 'issue', externalId: '3' },
        metadata: { identifier: 'acme/app#3' },
      }),
    },
  };
}

describe('the Work board seed', () => {
  it('stores a runner for every working phase, with the skill, context and fields each phase runs on', () => {
    const working = Object.fromEntries(
      Object.entries(workBoard.phases).flatMap(([key, phase]) =>
        phase.kind === 'working'
          ? [
              [
                key,
                {
                  runner: phase.runner,
                  exitTool: phase.exitTool,
                  tools: phase.tools,
                  autoStart: phase.autoStart,
                  autoStartWhen: phase.autoStartWhen,
                  nextPhases: phase.nextPhases,
                },
              ],
            ]
          : [],
      ),
    );
    // New projects' Work has no Triage: cards go from Intake straight to Planning.
    expect(working).toEqual({
      planning: {
        runner: { agentId: 'code-agent', skill: 'factory-plan', context: 'work' },
        exitTool: { id: 'submit_plan', autoApprove: false },
        tools: undefined,
        autoStart: undefined,
        autoStartWhen: undefined,
        nextPhases: ['execute', 'intake', 'done', 'canceled'],
      },
      execute: {
        runner: {
          agentId: 'code-agent',
          skill: 'factory-build',
          context: 'work',
          goal: { objective: BUILD_OBJECTIVE, maxRuns: 20 },
        },
        exitTool: undefined,
        tools: undefined,
        autoStart: undefined,
        autoStartWhen: undefined,
        nextPhases: ['pr-review', 'planning', 'done', 'canceled'],
      },
      'pr-review': {
        runner: { agentId: 'code-agent', skill: 'factory-review', context: 'review' },
        exitTool: undefined,
        tools: ['factory_record_review_verdict', 'factory_review_source'],
        autoStart: undefined,
        autoStartWhen: undefined,
        nextPhases: ['intake', 'planning', 'execute', 'done', 'canceled'],
      },
    });
    expect(workBoard.tools).toEqual({});
  });

  it("states the build goal's done, continue and waiting criteria in the stored objective the judge reads", () => {
    expect(BUILD_OBJECTIVE).toContain('plan approved in Planning');
    expect(BUILD_OBJECTIVE).toContain('pushed');
    // The judge cannot see the project's self-review setting: the objective never asks it to.
    expect(BUILD_OBJECTIVE).not.toMatch(/self-review/i);
    expect(BUILD_OBJECTIVE).toMatch(/out of Building \(to Review after opening the change request/);
    // A change request tracked on its own card never lets the card into Review: that hand-off is done too.
    expect(BUILD_OBJECTIVE).toContain('tracked on its own card');
    expect(BUILD_OBJECTIVE).toContain('says a person should confirm it is reviewed there');
    expect(BUILD_OBJECTIVE).toMatch(/[Ww]aiting/);
    expect(BUILD_OBJECTIVE.length).toBeLessThanOrEqual(2_000);
  });
});

describe('Work phase runs', () => {
  it('starts factory-build with its goal whether the card comes from Planning or back from Review', () => {
    for (const fromStage of ['planning', 'pr-review']) {
      expect(phaseRunDecision(workBoard, 'execute', entering('github-issue', fromStage, 'execute'))).toEqual({
        type: 'invokeSkill',
        role: 'work',
        skillName: 'factory-build',
        arguments: 'Work item (https://github.com/acme/app/issues/3)',
        goal: { objective: BUILD_OBJECTIVE, maxRuns: 20 },
        startsAfterOwnMove: true,
        idempotencyKey: 'ingress-1:execute:factory-build',
      });
    }
  });

  it('has no self-review phase: Building hands its change request straight to Review', () => {
    expect(Object.keys(workBoard.phases)).not.toContain('review');
    expect(workBoard.phases['pr-review']).toMatchObject({ name: 'Review' });
  });

  it("starts self-review on its own, in an older project's Work, only while the card has no open change request", () => {
    const facts = (metadata: Record<string, unknown>) =>
      cardRuleFacts({ title: 'Fix the issue', metadata, externalSource: null });
    expect(selfReviewWorkBoard.startsAutomatically('review', facts({}))).toBe(true);
    expect(selfReviewWorkBoard.startsAutomatically('review', facts({ openPullRequestNumber: 7 }))).toBe(false);
    expect(
      phaseRunDecision(selfReviewWorkBoard, 'review', entering('github-issue', 'execute', 'review')),
    ).toMatchObject({
      role: 'review',
      skillName: 'factory-self-review',
      idempotencyKey: 'ingress-1:review:factory-self-review',
    });
  });

  it("starts the triage runner for an incident.io follow-up, in a project's Work that kept Triage", () => {
    expect(
      phaseRunDecision(triageWorkBoard, 'triage', {
        ...entering('incidentio-follow-up', 'intake', 'triage'),
      }),
    ).toMatchObject({ role: 'triage', skillName: 'factory-triage', idempotencyKey: 'ingress-1:triage:factory-triage' });
  });
});
