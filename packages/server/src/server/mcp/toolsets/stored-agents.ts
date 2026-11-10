import type { IMastraEditor } from '@mastra/core/editor';
import type { JSONSchema7 } from '@mastra/schema-compat';
import { GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE } from '../../handlers/editor-builder';
import {
  CREATE_STORED_AGENT_ROUTE,
  GET_STORED_AGENT_ROUTE,
  LIST_STORED_AGENTS_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
} from '../../handlers/stored-agents';
import { createStoredAgentBodySchema, updateStoredAgentBodySchema } from '../../schemas/stored-agents';
import type { Args, CatalogueKit } from '../catalogue';
import { toolError } from '../catalogue';
import { compact, hoistRepeated, object, str, toJSONSchema } from '../schema';

const PUBLISH_DESCRIPTION = 'Publish the change so call_agent uses it right away. Defaults to true.';

function bodySchema(schema: unknown, omit: string[]) {
  const json = toJSONSchema(schema) ?? { type: 'object' };
  const properties = { ...(json.properties as Record<string, any>) };
  for (const key of omit) delete properties[key];
  properties.autoPublish = { type: 'boolean', description: PUBLISH_DESCRIPTION };
  return hoistRepeated(
    compact({
      ...json,
      properties,
      required: ((json.required ?? []) as string[]).filter(key => !omit.includes(key)),
    }) as JSONSchema7,
  );
}

const isObject = (value: unknown): value is Args =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A model the stored agent will run, by body path: an explicit model id, or a reason the model is implicit. */
type ModelUse = { field: string; model: string } | { field: string; implicit: string };

/** OM model values that defer to a default the caller can't see: `'auto'` picks per main model and environment. */
const IMPLICIT_OM_MODELS = new Set(['auto', 'default']);

/**
 * Models Observational Memory runs. Observer and reflector each fall back to the other step's model and then to
 * an implicit one: `true` runs on the editor's builder default OM model, and a config without a model (or with
 * `'auto'`/`'default'`) on Observational Memory's own pick, which depends on the main model and environment.
 */
function observationalMemoryUses(om: unknown, field: string): ModelUse[] {
  if (om === true) return [{ field, implicit: 'true runs on the default Observational Memory model' }];
  if (!isObject(om)) return [];
  const observation = isObject(om.observation) ? om.observation.model : undefined;
  const reflection = isObject(om.reflection) ? om.reflection.model : undefined;
  const uses: ModelUse[] = [
    [`${field}.model`, om.model],
    [`${field}.observation.model`, observation],
    [`${field}.reflection.model`, reflection],
  ]
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !IMPLICIT_OM_MODELS.has(entry[1]))
    .map(([path, model]) => ({ field: path, model }));
  const observer = om.model ?? observation ?? reflection;
  const reflector = om.model ?? reflection ?? observation;
  const isImplicit = (model: unknown) => typeof model !== 'string' || IMPLICIT_OM_MODELS.has(model);
  if (isImplicit(observer) || isImplicit(reflector)) {
    uses.push({ field, implicit: 'sets no explicit model, so it runs on an automatically picked default model' });
  }
  return uses;
}

/**
 * Models inside a stored agent's memory field (static or conditional; inline or bare config): Observational
 * Memory's observer/reflector and the title model (without one, titles use the agent's model). Registered
 * memory refs carry none.
 */
function memoryUses(memory: unknown, field = 'memory'): ModelUse[] {
  const variants = Array.isArray(memory)
    ? memory.map(
        (variant, index) => [isObject(variant) ? variant.value : undefined, `${field}[${index}].value`] as const,
      )
    : ([[memory, field]] as const);
  return variants.flatMap(([variant, path]) => {
    if (!isObject(variant)) return [];
    const inline = variant.type === 'inline';
    const config = inline ? variant.config : variant;
    if (!isObject(config)) return [];
    const configPath = inline ? `${path}.config` : path;
    const title = isObject(config.options) ? config.options.generateTitle : undefined;
    return [
      ...observationalMemoryUses(config.observationalMemory, `${configPath}.observationalMemory`),
      ...(isObject(title) && typeof title.model === 'string'
        ? [{ field: `${configPath}.options.generateTitle.model`, model: title.model }]
        : []),
    ];
  });
}

/**
 * Models in a stored agent's fallback list, which replaces the models of a code agent that hands its model list
 * to the editor. A disabled entry never runs, so it isn't checked; an entry the policy can't read is implicit.
 */
function modelListUses(modelList: unknown): ModelUse[] {
  if (!Array.isArray(modelList)) return [];
  return modelList.flatMap((entry, index): ModelUse[] => {
    if (!isObject(entry) || entry.enabled === false) return [];
    const field = `modelList[${index}]`;
    return typeof entry.provider === 'string' && typeof entry.modelId === 'string'
      ? [{ field, model: `${entry.provider}/${entry.modelId}` }]
      : [{ field, implicit: 'is not a provider and model id' }];
  });
}

/**
 * Models inside a stored agent's input or output processor graph (static or conditional), at every nesting depth:
 * each step's `config.model`. A provider whose config schema needs a model, given none, is implicit; a `model`
 * that isn't a string is too, since the policy can't check it.
 */
function processorUses(processors: unknown, field: string, editor: IMastraEditor | undefined): ModelUse[] {
  const stepUses = (step: unknown, path: string): ModelUse[] => {
    if (!isObject(step)) return [];
    const config = isObject(step.config) ? step.config : {};
    const modelField = `${path}.config.model`;
    if (typeof config.model === 'string') return [{ field: modelField, model: config.model }];
    if (config.model !== undefined) return [{ field: modelField, implicit: 'is not a model id' }];
    const provider = typeof step.providerId === 'string' ? editor?.getProcessorProvider?.(step.providerId) : undefined;
    const needsModel = provider?.configSchema.safeParse({}).error?.issues.some(issue => issue.path[0] === 'model');
    return needsModel ? [{ field: modelField, implicit: 'is not set, so the processor runs on a default model' }] : [];
  };
  const entryUses = (entry: unknown, path: string): ModelUse[] => {
    if (!isObject(entry)) return [];
    const list = (entries: unknown, at: string) =>
      Array.isArray(entries) ? entries.flatMap((child, index) => entryUses(child, `${at}[${index}]`)) : [];
    if (entry.type === 'step') return stepUses(entry.step, `${path}.step`);
    if (entry.type === 'parallel' && Array.isArray(entry.branches)) {
      return entry.branches.flatMap((branch, index) => list(branch, `${path}.branches[${index}]`));
    }
    if (entry.type === 'conditional' && Array.isArray(entry.conditions)) {
      return entry.conditions.flatMap((condition, index) =>
        isObject(condition) ? list(condition.steps, `${path}.conditions[${index}].steps`) : [],
      );
    }
    return [];
  };
  const variants = Array.isArray(processors)
    ? processors.map(
        (variant, index) => [isObject(variant) ? variant.value : undefined, `${field}[${index}].value`] as const,
      )
    : ([[processors, field]] as const);
  return variants.flatMap(([graph, path]) =>
    isObject(graph) && Array.isArray(graph.steps)
      ? graph.steps.flatMap((entry, index) => entryUses(entry, `${path}.steps[${index}]`))
      : [],
  );
}

/**
 * The builder model policy and the builder it came from. Unlike the shared helper, which treats a builder that
 * fails to resolve as "no policy" so agent runs don't fail, the write tools fail closed: no check, no write.
 */
async function resolvePolicy(editor: IMastraEditor | undefined) {
  if (typeof editor?.resolveBuilder !== 'function') return undefined;
  if (typeof editor.hasEnabledBuilderConfig === 'function' && !editor.hasEnabledBuilderConfig()) return undefined;
  try {
    const builder = await editor.resolveBuilder();
    const { builderToModelPolicy } = await import('@mastra/core/agent-builder/ee');
    return { builder, policy: builderToModelPolicy(builder) };
  } catch {
    throw toolError(503, {
      message: 'The builder model policy could not be resolved, so the agent was not saved. Try again later.',
    });
  }
}

const describeAllowed = (allowed: Array<{ provider: string; modelId?: string }>) =>
  allowed.map(entry => `${entry.provider}/${entry.modelId ?? '*'}`).join(', ');

/**
 * Stored agents (agent builder). The routes enforce `stored-agents:*` permissions, author/visibility
 * ownership and builder defaults; the MCP tools also enforce the builder model policy on every model the
 * agent will run, which the HTTP routes leave to the Studio model picker.
 */
export function addStoredAgentTools(kit: CatalogueKit) {
  const { mastra, call, addOperation } = kit;

  /**
   * Enforces the builder model policy on every model the agent will run: its model (each conditional variant),
   * its enabled fallback models, its memory models and its processor models, including the implicit ones the policy cannot check, which are
   * rejected. On create, omitted memory gets the builder default: the admin's pinned memory, else Observational
   * Memory on its default model (the editor's `BUILDER_BASELINE_DEFAULTS`).
   */
  const assertModelsAllowed = async (body: Args, isCreate: boolean) => {
    const editor = mastra.getEditor();
    const resolved = await resolvePolicy(editor);
    if (!resolved?.policy.active || !resolved.policy.allowed?.length) return;
    const allowed = resolved.policy.allowed;

    let uses: ModelUse[];
    if (isCreate && body.memory === undefined) {
      const pinned = resolved.builder?.getConfiguration()?.agent?.memory;
      uses =
        pinned === undefined
          ? [
              {
                field: 'memory',
                implicit: 'is omitted, so the builder default turns on Observational Memory with its default model',
              },
            ]
          : memoryUses(pinned).map(use => ({ ...use, field: `${use.field} (builder default)` }));
    } else {
      uses = memoryUses(body.memory);
    }
    uses.push(
      ...modelListUses(body.modelList),
      ...processorUses(body.inputProcessors, 'inputProcessors', editor),
      ...processorUses(body.outputProcessors, 'outputProcessors', editor),
    );

    const { assertModelAllowed: assertAllowed, toModelCandidates } = await import('@mastra/core/agent-builder/ee');
    const problems: string[] = [];
    for (const use of [
      ...(body.model !== undefined && body.model !== null ? [{ field: 'model', model: body.model }] : []),
      ...uses,
    ]) {
      if ('implicit' in use) {
        problems.push(
          `${use.field}: ${use.implicit}, which the builder model policy cannot check; set an allowed model`,
        );
        continue;
      }
      const model = use.model as Parameters<typeof assertAllowed>[1];
      // The allowlist passes what it can't parse (e.g. '' or 'gpt-4o-mini'); here that fails closed.
      if (toModelCandidates(model).length === 0) {
        problems.push(`${use.field}: ${JSON.stringify(use.model)} is not a provider/model id the policy can check`);
        continue;
      }
      try {
        assertAllowed(allowed, model);
      } catch (error) {
        problems.push(
          `${use.field}: ${(error instanceof Error ? error.message : 'Model not allowed').replace(/\.$/, '')}`,
        );
      }
    }
    if (problems.length > 0) {
      throw toolError(422, {
        message: `${problems.join('; ')}. Allowed models: ${describeAllowed(allowed)}. Call list_available_models for the models you can use.`,
      });
    }
  };
  const withPublish = (args: Args) => ({ ...args, autoPublish: args.autoPublish ?? true });

  addOperation(GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE, object({}), (_args, signal) =>
    call(GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE, {}, signal),
  );
  addOperation(
    LIST_STORED_AGENTS_ROUTE,
    object({
      status: { type: 'string', enum: ['draft', 'published', 'archived'], description: 'Defaults to published.' },
      page: { type: 'integer', minimum: 0, description: 'Page number, from 0.' },
      perPage: { type: 'integer', minimum: 1, description: 'Agents per page. Defaults to 100.' },
    }),
    (args, signal) => call(LIST_STORED_AGENTS_ROUTE, { query: args }, signal),
  );
  const storedAgentId = str('Stored agent id. Call list_stored_agents to find ids.');
  addOperation(GET_STORED_AGENT_ROUTE, object({ storedAgentId }, ['storedAgentId']), (args, signal) =>
    call(GET_STORED_AGENT_ROUTE, { pathParams: { storedAgentId: args.storedAgentId } }, signal),
  );
  addOperation(
    CREATE_STORED_AGENT_ROUTE,
    bodySchema(createStoredAgentBodySchema, ['authorId']),
    async (args, signal) => {
      await assertModelsAllowed(args, true);
      return call(CREATE_STORED_AGENT_ROUTE, { body: withPublish(args) }, signal);
    },
  );
  addOperation(
    UPDATE_STORED_AGENT_ROUTE,
    (() => {
      const schema = bodySchema(updateStoredAgentBodySchema, ['authorId']);
      return { ...schema, properties: { storedAgentId, ...schema.properties }, required: ['storedAgentId'] };
    })(),
    async (args, signal) => {
      const { storedAgentId: id, ...body } = args;
      await assertModelsAllowed(body, false);
      return call(UPDATE_STORED_AGENT_ROUTE, { pathParams: { storedAgentId: id }, body: withPublish(body) }, signal);
    },
  );
}
