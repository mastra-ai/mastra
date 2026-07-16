import type { Skill } from '@mastra/core/workspace';

import { understandIssueSkill } from './understand-issue';
import { understandPrSkill } from './understand-pr';

export const factoryBuiltinSkills = Object.freeze({
  [understandIssueSkill.name]: Object.freeze(understandIssueSkill),
  [understandPrSkill.name]: Object.freeze(understandPrSkill),
}) satisfies Readonly<Record<string, Skill>>;
