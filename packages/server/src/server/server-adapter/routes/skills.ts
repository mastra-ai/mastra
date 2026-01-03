import {
  LIST_SKILLS_ROUTE,
  GET_SKILL_ROUTE,
  LIST_SKILL_REFERENCES_ROUTE,
  GET_SKILL_REFERENCE_ROUTE,
  SEARCH_SKILLS_ROUTE,
  GET_AGENT_SKILL_ROUTE,
} from '../../handlers/skills';
import type { ServerRoute } from '.';

export const SKILLS_ROUTES: ServerRoute<any, any, any>[] = [
  // IMPORTANT: Search route must come before the parameterized routes
  // to avoid /api/skills/search being matched as /api/skills/:skillName
  SEARCH_SKILLS_ROUTE,
  LIST_SKILLS_ROUTE,
  GET_SKILL_ROUTE,
  LIST_SKILL_REFERENCES_ROUTE,
  GET_SKILL_REFERENCE_ROUTE,
  // Agent-specific skill route
  GET_AGENT_SKILL_ROUTE,
];
