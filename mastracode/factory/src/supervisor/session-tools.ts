import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { DEFAULT_OBSERVATION_THRESHOLD, DEFAULT_REFLECTION_THRESHOLD } from '../session/memory-settings-hydration.js';
import type { OMConfigurableSession } from '../session/memory-settings-hydration.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import { factoryMemorySettingsUserId } from '../storage/domains/memory-settings/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SupervisorScope } from './read-tools.js';

interface ConfigurableSession extends OMConfigurableSession {
  thread: {
    getId(): string | null;
    getById(args: { threadId: string }): Promise<{ resourceId: string; metadata?: Record<string, unknown> } | null>;
    setSettingOn(args: { threadId: string; key: string; value: unknown }): Promise<void>;
    rename(args: { title: string }): Promise<void>;
  };
  run: { isRunning(): boolean };
  mode: { get(): string; switch(args: { modeId: string }): Promise<void> };
  model: { get(): string; switch(args: { modelId: string; scope: 'thread' }): Promise<void> };
}

interface Dependencies {
  scope: SupervisorScope;
  userId: string;
  workItems: Pick<WorkItemsStorage, 'listRunBindings' | 'getForProject'>;
  audit: AuditStorage;
  controller: {
    getSessionByResource(resourceId: string): Promise<ConfigurableSession | undefined>;
    listModes(): { id: string }[];
  };
  memorySettings: Pick<MemorySettingsStorage, 'get'>;
  projects: Pick<FactoryProjectsStorage, 'getById'>;
  now?: () => Date;
}

const modelId = z.string().trim().min(1);
const memorySchema = z
  .object({
    observerModelId: modelId.optional(),
    reflectorModelId: modelId.optional(),
    observationThreshold: z.number().int().positive().optional(),
    reflectionThreshold: z.number().int().positive().optional(),
  })
  .strict()
  .refine(value => Object.values(value).some(v => v !== undefined), 'Provide at least one memory setting.');
const inputSchema = z
  .object({
    target: z.union([
      z.object({ sessionId: z.string().min(1) }).strict(),
      z.object({ workItemId: z.string().min(1), role: z.string().min(1) }).strict(),
      z.object({ all: z.literal(true) }).strict(),
    ]),
    changes: z
      .object({
        model: modelId.optional(),
        mode: modelId.optional(),
        memory: z.union([z.literal('resync'), memorySchema]).optional(),
        title: z.string().trim().min(1).max(200).optional(),
      })
      .strict()
      .refine(value => Object.values(value).some(v => v !== undefined), 'Provide at least one change.'),
  })
  .strict();

type MemoryValues = z.infer<typeof memorySchema> & { observeAttachments?: 'auto' | boolean };
type MemoryKnob = keyof MemoryValues;
type MemoryOutcome = {
  applied: Partial<Record<MemoryKnob, 'written' | 'unchanged'>>;
  skipped: Partial<Record<MemoryKnob, string>>;
  warnings: string[];
};
type Result = {
  sessionId: string;
  resourceId: string;
  workItemId: string;
  role: string;
  threadId: string;
  status: 'updated' | 'skipped';
  skipReason?: 'work-item-gone' | 'session-not-live';
  applied: {
    model?: 'now' | 'next-run-start' | 'next-thread-switch';
    mode?: 'now' | 'next-thread-switch';
    title?: 'now';
    memory?: MemoryOutcome['applied'];
  };
  skipped: { model?: string; mode?: string; title?: string; memory?: string | MemoryOutcome['skipped'] };
  warnings: string[];
};
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function updateMemory(session: ConfigurableSession, values: MemoryValues): Promise<MemoryOutcome> {
  const outcome: MemoryOutcome = { applied: {}, skipped: {}, warnings: [] };
  for (const knob of Object.keys(values) as MemoryKnob[]) {
    const value = values[knob];
    if (value === undefined) continue;
    const role = knob === 'observerModelId' ? 'observer' : knob === 'reflectorModelId' ? 'reflector' : undefined;
    const read = () =>
      role
        ? session.om[role].modelId()
        : (session.state.get()?.[knob] ?? (knob === 'observeAttachments' ? 'auto' : undefined));
    if (read() === value) {
      outcome.applied[knob] = 'unchanged';
      continue;
    }
    if (session.run.isRunning()) {
      outcome.skipped[knob] = 'session-busy';
      continue;
    }
    try {
      if (role && typeof value === 'string') await session.om[role].switchModel({ modelId: value });
      else if (knob === 'observationThreshold' && typeof value === 'number')
        await session.state.set({ observationThreshold: value });
      else if (knob === 'reflectionThreshold' && typeof value === 'number')
        await session.state.set({ reflectionThreshold: value });
      else if (knob === 'observeAttachments' && (value === 'auto' || typeof value === 'boolean'))
        await session.state.set({ observeAttachments: value });
      outcome.applied[knob] = 'written';
    } catch (error) {
      if (read() === value) outcome.applied[knob] = 'written';
      else outcome.skipped[knob] = message(error);
      outcome.warnings.push(`${knob}: ${message(error)}`);
    }
  }
  return outcome;
}

export function createFactorySupervisorSessionTools(deps: Dependencies): IntegrationTools {
  return {
    factory_update_session: createTool({
      id: 'factory_update_session',
      description:
        'Update active Factory worker sessions without approval. Choose one session, a work item and role, or all active bindings. Model changes apply now when current and idle, next run start when busy, or next thread switch for other threads. Busy sessions skip mode and memory changes; non-current threads skip title changes. Memory is session-wide; resync restores stored Factory settings and defaults. Returns per-binding applied/skipped fields and warnings. Cannot change permissions, yolo or notifications.',
      requireApproval: false,
      inputSchema,
      execute: async ({ target, changes }) => {
        const { orgId, factoryProjectId } = deps.scope;
        const bindings = (await deps.workItems.listRunBindings(orgId, factoryProjectId))
          .filter(binding => binding.status === 'active')
          .filter(
            binding =>
              'all' in target ||
              ('sessionId' in target
                ? binding.sessionId === target.sessionId
                : binding.workItemId === target.workItemId && binding.role === target.role),
          );
        if (!('all' in target) && (bindings.length === 0 || ('workItemId' in target && bindings.length !== 1)))
          throw new Error('Not an active worker session of this factory.');
        const results: Result[] = [];
        const memoryOutcomes = new Map<string, MemoryOutcome | string>();
        for (const binding of bindings) {
          const { sessionId, resourceId, workItemId, role, threadId } = binding;
          const result: Result = {
            sessionId,
            resourceId,
            workItemId,
            role,
            threadId,
            status: 'skipped',
            applied: {},
            skipped: {},
            warnings: [],
          };
          results.push(result);
          try {
            if (!(await deps.workItems.getForProject(orgId, factoryProjectId, workItemId))) {
              result.skipReason = 'work-item-gone';
              continue;
            }
            const session = await deps.controller.getSessionByResource(resourceId);
            if (!session) {
              result.skipReason = 'session-not-live';
              continue;
            }
            const current = () => session.thread.getId() === threadId;
            const boundThread = await session.thread.getById({ threadId });
            if (!boundThread || boundThread.resourceId !== resourceId)
              throw new Error('Bound thread is missing or belongs to another resource.');
            const stillActive = (await deps.workItems.listRunBindings(orgId, factoryProjectId)).some(
              row =>
                row.id === binding.id &&
                row.status === 'active' &&
                row.resourceId === resourceId &&
                row.threadId === threadId,
            );
            if (!stillActive) throw new Error('Worker binding is no longer active.');
            if (changes.mode) {
              if (!deps.controller.listModes().some(mode => mode.id === changes.mode))
                result.skipped.mode = 'unknown-mode';
              else if (current() && session.run.isRunning()) result.skipped.mode = 'session-busy';
              else
                try {
                  if (current()) {
                    await session.mode.switch({ modeId: changes.mode });
                    result.applied.mode = 'now';
                  } else {
                    await session.thread.setSettingOn({ threadId, key: 'currentModeId', value: changes.mode });
                    result.applied.mode = 'next-thread-switch';
                  }
                } catch (error) {
                  if (current() && session.mode.get() === changes.mode) {
                    result.applied.mode = 'now';
                    result.warnings.push(
                      `Mode switched in memory; persistence or incoming-model reconciliation failed: ${message(error)}`,
                    );
                  } else result.skipped.mode = message(error);
                }
            }
            if (changes.model) {
              try {
                const storedMode = current()
                  ? undefined
                  : (await session.thread.getById({ threadId }))?.metadata?.currentModeId;
                const effectiveMode = result.applied.mode
                  ? changes.mode!
                  : typeof storedMode === 'string' && deps.controller.listModes().some(mode => mode.id === storedMode)
                    ? storedMode
                    : session.mode.get();
                await session.thread.setSettingOn({
                  threadId,
                  key: `modeModelId_${effectiveMode}`,
                  value: changes.model,
                });
                result.applied.model = current() ? 'next-run-start' : 'next-thread-switch';
                if (current() && !session.run.isRunning() && session.mode.get() === effectiveMode) {
                  try {
                    await session.model.switch({ modelId: changes.model, scope: 'thread' });
                    result.applied.model = 'now';
                  } catch (error) {
                    if (session.model.get() === changes.model) result.applied.model = 'now';
                    result.warnings.push(`Model persisted; live switch failed: ${message(error)}`);
                  }
                }
              } catch (error) {
                result.skipped.model = message(error);
              }
            }
            if (changes.memory) {
              let outcome = memoryOutcomes.get(resourceId);
              if (outcome !== undefined)
                result.warnings.push('Memory reused the first binding outcome for this shared session.');
              else {
                try {
                  if (session.run.isRunning()) outcome = 'session-busy';
                  else {
                    let values: MemoryValues;
                    if (changes.memory === 'resync') {
                      const stored = await deps.memorySettings.get({
                        orgId,
                        userId: factoryMemorySettingsUserId(factoryProjectId),
                      });
                      const project = await deps.projects.getById({ id: factoryProjectId });
                      if (!project) throw new Error('Factory project no longer exists.');
                      const provider = project.defaultModelId?.split('/')[0];
                      const fallback =
                        (provider
                          ? resolveProviderOMDefault(provider, project.defaultModelId ?? undefined).modelId
                          : undefined) ?? DEFAULT_OM_MODEL_ID;
                      values = {
                        observerModelId: stored?.observerModelId ?? fallback,
                        reflectorModelId: stored?.reflectorModelId ?? fallback,
                        observationThreshold: stored?.observationThreshold ?? DEFAULT_OBSERVATION_THRESHOLD,
                        reflectionThreshold: stored?.reflectionThreshold ?? DEFAULT_REFLECTION_THRESHOLD,
                        observeAttachments: stored?.observeAttachments ?? 'auto',
                      };
                    } else values = changes.memory;
                    outcome = await updateMemory(session, values);
                  }
                } catch (error) {
                  outcome = message(error);
                }
                memoryOutcomes.set(resourceId, outcome);
              }
              if (typeof outcome === 'string') result.skipped.memory = outcome;
              else {
                if (Object.keys(outcome.applied).length) result.applied.memory = outcome.applied;
                if (Object.keys(outcome.skipped).length) result.skipped.memory = outcome.skipped;
                result.warnings.push(...outcome.warnings);
              }
            }
            if (changes.title) {
              if (!current()) result.skipped.title = 'thread-not-current';
              else
                try {
                  await session.thread.rename({ title: changes.title });
                  result.applied.title = 'now';
                } catch (error) {
                  result.skipped.title = message(error);
                }
            }
          } catch (error) {
            for (const field of ['model', 'mode', 'memory', 'title'] as const) {
              if (
                changes[field] !== undefined &&
                result.applied[field] === undefined &&
                result.skipped[field] === undefined
              )
                result.skipped[field] = message(error);
            }
          }
          for (const [field, reason] of Object.entries(result.skipped)) {
            result.warnings.push(`${field} skipped: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
          }
          if (Object.keys(result.applied).length) {
            result.status = 'updated';
            try {
              await deps.audit.record({
                orgId,
                factoryProjectId,
                actorId: deps.userId,
                actorType: 'human',
                action: 'factory.supervisor.session_updated',
                targets: [{ type: 'factory_session', id: sessionId }],
                metadata: {
                  cause: 'supervisor',
                  workItemId,
                  role,
                  threadId,
                  applied: result.applied,
                  warnings: result.warnings,
                },
                occurredAt: deps.now?.() ?? new Date(),
              });
            } catch (error) {
              result.warnings.push(`Changes applied but audit recording failed: ${message(error)}`);
            }
          }
        }
        const touched = results.filter(result => result.status === 'updated').length;
        return { results, summary: { targets: results.length, touched, untouched: results.length - touched } };
      },
    }),
  };
}
