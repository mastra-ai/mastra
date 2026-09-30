import { SECURITY_REVIEW_STAGE } from './storyBoards';
import type { WorkflowStep } from './workflows/storyWorkflows';

export type SkillSource = 'built-in' | 'repo' | 'settings';

export type StorySkill = { name: string; description: string; source: SkillSource };

export const SKILL_SOURCE_LABELS: Record<SkillSource, string> = {
  'built-in': 'Built in',
  repo: 'From repo .mastra/skills',
  settings: 'Added in Settings',
};

const SKILLS: Record<string, StorySkill> = {
  'factory-triage': {
    name: 'factory-triage',
    description: 'Labels the issue, rates severity and effort, suggests a route.',
    source: 'built-in',
  },
  'factory-plan': {
    name: 'factory-plan',
    description: 'Writes the plan a person approves before any code changes.',
    source: 'built-in',
  },
  'factory-build': {
    name: 'factory-build',
    description: 'Implements the approved plan on a branch and opens the pull request.',
    source: 'built-in',
  },
  'factory-review': {
    name: 'factory-review',
    description: 'Reviews the diff and approves or requests changes on the last commit.',
    source: 'built-in',
  },
  'factory-rereview': {
    name: 'factory-rereview',
    description: 'Checks only what changed since the last review.',
    source: 'built-in',
  },
  'repo-conventions': {
    name: 'repo-conventions',
    description: 'Folder layout, naming and lint rules of this repository.',
    source: 'repo',
  },
  testing: {
    name: 'testing',
    description: 'Which test runner to use and how to add a regression test.',
    source: 'repo',
  },
  changeset: {
    name: 'changeset',
    description: 'Writes the changeset every published package change needs.',
    source: 'repo',
  },
  'security-checklist': {
    name: 'security-checklist',
    description: 'Secrets, auth and injection checks the security team asks for.',
    source: 'settings',
  },
  'incident-runbook': {
    name: 'incident-runbook',
    description: 'Where the dashboards live and who to page.',
    source: 'settings',
  },
};

const LANE_SKILL_NAMES: Record<string, string[]> = {
  triage: ['factory-triage'],
  planning: ['factory-plan', 'repo-conventions'],
  execute: ['factory-build', 'repo-conventions', 'testing'],
  review: ['factory-review', 'factory-rereview', 'changeset'],
  [SECURITY_REVIEW_STAGE]: ['factory-review', 'security-checklist'],
  investigate: ['incident-runbook'],
  mitigate: ['incident-runbook'],
};

function skillsNamed(names: string[]): StorySkill[] {
  return names.flatMap(name => SKILLS[name] ?? []);
}

export function skillsOnLane(stageId: string): StorySkill[] {
  return skillsNamed(LANE_SKILL_NAMES[stageId] ?? []);
}

export function stepSkills(step: WorkflowStep, laneId: string | undefined): StorySkill[] {
  if (step.kind !== 'agent') return [];
  if (step.skills) return skillsNamed(step.skills);
  return laneId === undefined ? [] : skillsOnLane(laneId);
}
