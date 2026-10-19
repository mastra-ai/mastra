import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { boardAvailableTo } from '../boards/registry.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { FactorySkillLibraryStorage, FactorySkillRecord } from '../storage/domains/factory-skills/base.js';
import type { PhaseKickoff, PhaseSkillRecord, PhaseSkillsStorage } from '../storage/domains/phase-skills/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_CONTENT_LENGTH = 100_000;
const MAX_PROMPT_LENGTH = 16_384;

export interface PhaseSkillRoutesDeps extends RouteDependencies {
  phaseSkills: PhaseSkillsStorage;
  skillLibrary: FactorySkillLibraryStorage;
  projects: FactoryProjectsStorage;
  boards: BoardRegistry;
}

function loose(context: unknown): Context {
  return context as Context;
}

function phaseToWire(record: PhaseSkillRecord) {
  return {
    boardId: record.boardId,
    phaseId: record.phaseId,
    skillName: record.skillName,
    prompt: record.prompt,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function skillToWire(record: FactorySkillRecord) {
  return {
    name: record.name,
    description: record.description,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isSkillName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SKILL_NAME_LENGTH && SKILL_NAME_RE.test(value);
}

function invalid(context: Context, error: string, message: string) {
  return context.json({ error, message }, 400);
}

async function readBody(context: Context): Promise<Record<string, unknown>> {
  const body: unknown = await context.req.json().catch(() => undefined);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** The description and body of a skill, or the reason they are not usable. */
function parseSkillBody(body: Record<string, unknown>): { description: string; content: string } | { message: string } {
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    return { message: `description is required and must be at most ${MAX_DESCRIPTION_LENGTH} characters.` };
  }
  if (!content || content.length > MAX_CONTENT_LENGTH) {
    return { message: `content is required and must be at most ${MAX_CONTENT_LENGTH} characters.` };
  }
  return { description, content };
}

/**
 * A Factory's skill library and what each board phase runs:
 *   - `GET    /web/factory/projects/:id/skill-library`                   — list the Factory's skills
 *   - `POST   /web/factory/projects/:id/skill-library`                   — create a skill
 *   - `PUT    /web/factory/projects/:id/skill-library/:name`             — edit a skill
 *   - `DELETE /web/factory/projects/:id/skill-library/:name`             — delete a skill; phases running it go back to their default
 *   - `GET    /web/factory/projects/:id/phase-skills`                    — list phase kickoffs
 *   - `PUT    /web/factory/projects/:id/phase-skills/:boardId/:phaseId`  — run a library skill (`skillName`) or a `prompt` when a card enters the phase
 *   - `DELETE /web/factory/projects/:id/phase-skills/:boardId/:phaseId`  — go back to the board's built-in kickoff
 */
export class PhaseSkillRoutes extends Route<PhaseSkillRoutesDeps> {
  async #resolveProject(
    context: Context,
  ): Promise<{ orgId: string; factoryProjectId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) return { response: context.json({ error: 'organization_required' }, 403) };
    const factoryProjectId = context.req.param('id');
    await this.deps.projects.ensureReady();
    const project = factoryProjectId
      ? await this.deps.projects.get({ orgId: tenant.orgId, id: factoryProjectId })
      : null;
    if (!project) return { response: context.json({ error: 'factory_project_not_found' }, 404) };
    return { orgId: tenant.orgId, factoryProjectId: project.id };
  }

  /** Only a working phase starts a run, so only a working phase can carry a kickoff. */
  #resolvePhase(
    context: Context,
    factoryProjectId: string,
  ): { boardId: string; phaseId: string } | { response: Response } {
    const boardId = context.req.param('boardId') ?? '';
    const phaseId = context.req.param('phaseId') ?? '';
    const phases = boardAvailableTo(this.deps.boards, boardId, factoryProjectId)
      ? this.deps.boards.get(boardId)?.phases
      : undefined;
    const phase = phases && Object.hasOwn(phases, phaseId) ? phases[phaseId] : undefined;
    if (!phase) return { response: context.json({ error: 'phase_not_found' }, 404) };
    if (phase.kind !== 'working') {
      return {
        response: invalid(context, 'phase_not_working', 'Only working phases start a run that can invoke a skill.'),
      };
    }
    return { boardId, phaseId };
  }

  routes(): ApiRoute[] {
    const libraryPath = '/web/factory/projects/:id/skill-library';
    const phasePath = '/web/factory/projects/:id/phase-skills/:boardId/:phaseId';
    return [
      registerApiRoute(libraryPath, {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const skills = await this.deps.skillLibrary.list(project);
          return context.json({ skills: skills.map(skillToWire) });
        },
      }),
      registerApiRoute(libraryPath, {
        method: 'POST',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const body = await readBody(context);
          if (!isSkillName(body.name)) {
            return invalid(context, 'invalid_skill_name', 'name must be a lowercase, hyphenated skill name.');
          }
          const parsed = parseSkillBody(body);
          if ('message' in parsed) return invalid(context, 'invalid_skill', parsed.message);
          const record = await this.deps.skillLibrary.create({ ...project, name: body.name, ...parsed });
          if (!record) {
            return context.json(
              { error: 'skill_exists', message: `This Factory already has a skill named ${body.name}.` },
              409,
            );
          }
          return context.json({ skill: skillToWire(record) }, 201);
        },
      }),
      registerApiRoute(`${libraryPath}/:name`, {
        method: 'PUT',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const parsed = parseSkillBody(await readBody(context));
          if ('message' in parsed) return invalid(context, 'invalid_skill', parsed.message);
          const record = await this.deps.skillLibrary.update({
            ...project,
            name: context.req.param('name') ?? '',
            ...parsed,
          });
          if (!record) return context.json({ error: 'skill_not_found' }, 404);
          return context.json({ skill: skillToWire(record) });
        },
      }),
      registerApiRoute(`${libraryPath}/:name`, {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const name = context.req.param('name') ?? '';
          if (!(await this.deps.skillLibrary.delete({ ...project, name }))) {
            return context.json({ error: 'skill_not_found' }, 404);
          }
          await this.deps.phaseSkills.clearSkill({ ...project, skillName: name });
          return context.body(null, 204);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/phase-skills', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const records = await this.deps.phaseSkills.list(project);
          return context.json({ phaseSkills: records.map(phaseToWire) });
        },
      }),
      registerApiRoute(phasePath, {
        method: 'PUT',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const phase = this.#resolvePhase(context, project.factoryProjectId);
          if ('response' in phase) return phase.response;
          const body = await readBody(context);
          let kickoff: PhaseKickoff;
          if (body.skillName !== undefined && body.prompt === undefined) {
            if (
              !isSkillName(body.skillName) ||
              !(await this.deps.skillLibrary.get({ ...project, name: body.skillName }))
            ) {
              return invalid(
                context,
                'skill_not_found',
                "skillName must name a skill in this Factory's skill library.",
              );
            }
            kickoff = { skillName: body.skillName, prompt: null };
          } else if (body.prompt !== undefined && body.skillName === undefined) {
            const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
            if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
              return invalid(context, 'invalid_prompt', `prompt must be 1–${MAX_PROMPT_LENGTH} characters.`);
            }
            kickoff = { skillName: null, prompt };
          } else {
            return invalid(context, 'invalid_kickoff', 'Send exactly one of skillName or prompt.');
          }
          const record = await this.deps.phaseSkills.set({ ...project, ...phase, ...kickoff });
          return context.json({ phaseSkill: phaseToWire(record) });
        },
      }),
      registerApiRoute(phasePath, {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const project = await this.#resolveProject(context);
          if ('response' in project) return project.response;
          const phase = this.#resolvePhase(context, project.factoryProjectId);
          if ('response' in phase) return phase.response;
          await this.deps.phaseSkills.clear({ ...project, ...phase });
          return context.body(null, 204);
        },
      }),
    ];
  }
}
