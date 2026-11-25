import { toStandardSchema } from '@mastra/core/schema';
import type { PublicSchema } from '@mastra/core/schema';
import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { z } from 'zod';
import { BillingError, identifierSchema } from '../billing/contracts/core.js';
import { boundedJson, boundedJsonSchema, fingerprint } from '../billing/runtime/accounting.js';
import type { Json } from '../billing/runtime/accounting.js';
import type { ConversationOperation } from '../billing/storage/conversations.js';
import { outsideParentExecution } from '../billing/runtime/invocation-context.js';
import { outsideExecution } from '../billing/runtime/execution-scope.js';
import type { StudioAgentRuntime } from './studio-agent-decorator.js';
import type { StudioConversation } from './studio-wrapper-contracts.js';

const durableJson = z.unknown().refine(value => boundedJsonSchema.safeParse(value).success, {
  message: 'A bounded JSON projection is required.',
});

// The billing/native adapter owns application transformations. Validate the registered
// schema at the tool boundary while forwarding original JSON, as the workflow facade does.
const originalInput = <T>(schema: PublicSchema<T>, optionalFields: readonly string[] = []) => {
  const standard = toStandardSchema(schema);
  return {
    '~standard': {
      ...standard['~standard'],
      validate: (value: unknown) => {
        let projection = value;
        if (optionalFields.length && value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const fields = Object.getOwnPropertyDescriptors(value);
          for (const key of optionalFields) {
            const field = fields[key];
            if (field && 'value' in field && field.value === undefined) delete fields[key];
          }
          projection = Object.create(Object.getPrototypeOf(value), fields);
        }
        const bounded = durableJson.safeParse(projection);
        if (!bounded.success) return { issues: bounded.error.issues };
        const result = standard['~standard'].validate(value);
        const original = (checked: Awaited<typeof result>) => (checked.issues ? checked : { value: value as T });
        return result instanceof Promise ? result.then(original) : original(result);
      },
    },
  };
};
const reference = z.strictObject({ operationId: identifierSchema });
const queryReference = z.strictObject({ operationId: identifierSchema.nullish() });
const root = <T>(work: () => T) => outsideParentExecution(() => outsideExecution(work));
const state = (operation: ConversationOperation, response: unknown) => ({
  operationId: operation.id,
  ...(response === null ? { state: 'uncertain', result: null, billing: null } : (response as object)),
});

/** Registered-schema tools with billing-owned claims before detached root dispatch. */
export function createStudioOperationTools(runtime: StudioAgentRuntime) {
  const { integration } = runtime;
  const safe = async (work: () => Promise<unknown>) => {
    try {
      return await work();
    } catch (error) {
      const failure = error instanceof BillingError ? error : new BillingError('state_unavailable');
      return { error: { code: failure.code, message: failure.message, retryable: failure.retryable } };
    }
  };
  const messageIdentity = async (conversation: StudioConversation, context?: Pick<ToolExecutionContext, 'agent'>) => {
    let messages = context?.agent?.getMessages?.() ?? context?.agent?.messages ?? [];
    let message = [...messages]
      .reverse()
      .find(
        (message: { role?: string; type?: string; id?: string }) =>
          (message.role === 'user' || (message.role === 'signal' && message.type === 'user')) && !!message.id,
      );
    if (!message) {
      const memory = await runtime.agents[conversation.owner.agentId].getMemory();
      if (!memory) throw new BillingError('state_unavailable');
      messages = (
        await memory.recall({
          threadId: conversation.owner.threadId,
          resourceId: conversation.owner.resourceId,
          perPage: 40,
        })
      ).messages;
      message = [...messages]
        .reverse()
        .find(
          (message: { role?: string; type?: string; id?: string }) =>
            (message.role === 'user' || (message.role === 'signal' && message.type === 'user')) && !!message.id,
        );
    }
    if (!message?.id) throw new BillingError('state_unavailable');
    return message.id as string;
  };
  const invocation = async (
    resourceId: string,
    action: string,
    input: unknown,
    toolCallId: string,
    context?: Pick<ToolExecutionContext, 'agent'>,
    executionId?: string,
    pending?: Json,
  ) => {
    const conversation = runtime.current();
    await integration.organizations.authorize(conversation.billing);
    if (!toolCallId || (context?.agent?.threadId && context.agent.threadId !== conversation.owner.threadId))
      throw new BillingError('forbidden');
    // Approval hooks read persisted history without an agent context in this same turn.
    await context?.agent?.flushMessages?.();
    const messageId = await messageIdentity(conversation, context);
    conversation.controller.signal.throwIfAborted();
    const operation = await integration.conversations.claim(conversation.billing, conversation.owner, {
      messageId,
      toolCallId,
      resourceId,
      action,
      input: boundedJson(input),
      ...(executionId ? { executionId } : {}),
      ...(pending === undefined ? {} : { pending }),
    });
    conversation.controller.signal.throwIfAborted();
    return { conversation, operation };
  };
  const owned = async (conversation: StudioConversation, operationId: string, resourceId: string) => {
    const operation = await integration.conversations.get(conversation.billing, conversation.owner, operationId);
    if (operation.resourceId !== resourceId) throw new BillingError('forbidden');
    return operation;
  };
  const read = async (conversation: StudioConversation, operation: ConversationOperation) => {
    const response = integration.resources.agents[operation.resourceId]
      ? await integration.execution.agentStatus(operation.resourceId, conversation.billing, operation.requestKey)
      : operation.executionId
        ? await integration.execution.workflowOperation(
            operation.resourceId,
            operation.executionId,
            'status',
            conversation.billing,
            undefined,
            null,
          )
        : await integration.execution.workflowStatus(operation.resourceId, conversation.billing, operation.requestKey);
    const executionId =
      response?.billing?.executionId ??
      (response?.result && typeof response.result === 'object' && !Array.isArray(response.result)
        ? response.result.executionId
        : undefined);
    if (!operation.executionId && typeof executionId === 'string')
      await integration.conversations.bindExecution(
        conversation.billing,
        conversation.owner,
        operation.id,
        executionId,
      );
    return state(operation, response);
  };
  const query = async (conversation: StudioConversation, resourceId: string, operationId?: string) => {
    if (operationId) return read(conversation, await owned(conversation, operationId, resourceId));
    const operations = await integration.conversations.list(conversation.billing, conversation.owner, resourceId);
    return { operations: await Promise.all(operations.map(operation => read(conversation, operation))) };
  };
  const validatePending = async (conversation: StudioConversation, operation: ConversationOperation) => {
    if (
      !operation.executionId ||
      !operation.pending ||
      typeof operation.pending !== 'object' ||
      Array.isArray(operation.pending)
    )
      throw new BillingError('conflict');
    const pending = operation.pending as Record<string, Json>;
    const current = await integration.execution.workflowOperation(
      operation.resourceId,
      operation.executionId,
      'status',
      conversation.billing,
      undefined,
      null,
    );
    const value = current.result as Record<string, Json>;
    if (
      value.status !== 'suspended' ||
      !Array.isArray(value.suspendedSteps) ||
      !value.suspendedSteps.includes(pending.step) ||
      fingerprint(boundedJson(value.pending)) !== pending.fingerprint
    )
      throw new BillingError('conflict');
    return pending;
  };
  runtime.approval = async (conversation, toolCallId, approved) => {
    const operation = await integration.conversations.get(conversation.billing, conversation.owner, toolCallId, true);
    if (operation.action !== 'resume') throw new BillingError('forbidden');
    const pending = operation.pending as Record<string, Json> | null;
    if (!pending || typeof pending.nativeRunId !== 'string') throw new BillingError('conflict');
    const previous = await integration.conversations.approval(
      conversation.billing,
      conversation.owner,
      operation.id,
      approved,
    );
    if (!previous?.accepted) {
      if (!previous) await validatePending(conversation, operation);
      await integration.conversations.approval(conversation.billing, conversation.owner, operation.id, approved, true);
      if (!approved)
        await root(() =>
          integration.execution.workflowOperation(
            operation.resourceId,
            operation.executionId!,
            'cancel',
            conversation.billing,
            operation.requestKey,
            {},
          ),
        );
    }
    return {
      replayed: previous?.accepted ?? false,
      runId: pending.nativeRunId,
      ...(!approved
        ? {
            declineReason: JSON.stringify({
              event: 'workflow_approval_declined',
              ...(await read(conversation, operation)),
            }),
          }
        : {}),
    };
  };
  return {
    agentTool(id: string) {
      if (!identifierSchema.safeParse(id).success) throw new BillingError('invalid_configuration');
      const resource = integration.resources.agents[id];
      if (!resource) throw new BillingError('invalid_configuration');
      return createTool({
        id: `${id}-operation`,
        description: `Execute the registered ${id} business agent, or query an earlier operation. Omit operationId on query to recover the latest twenty operations in this conversation after a lost response or Stop. Execution uses its billing policy.`,
        inputSchema: originalInput(
          z
            .strictObject({
              action: z.enum(['execute', 'query']),
              prompt: (resource.promptSchema ?? z.string().min(1).max(8192)).nullish(),
              operationId: identifierSchema.nullish(),
            })
            .superRefine((input, context) => {
              if (input.action === 'execute') {
                if (input.prompt == null)
                  context.addIssue({ code: 'custom', path: ['prompt'], message: 'Execution requires a prompt.' });
                if (input.operationId != null)
                  context.addIssue({
                    code: 'custom',
                    path: ['operationId'],
                    message: 'Execution cannot select an existing operation.',
                  });
              } else if (input.prompt != null)
                context.addIssue({ code: 'custom', path: ['prompt'], message: 'Queries cannot include a prompt.' });
            }),
          ['prompt', 'operationId'],
        ),
        execute: (input, context) =>
          safe(async () => {
            if (input.action === 'query') {
              const conversation = runtime.current();
              return query(conversation, id, input.operationId ?? undefined);
            }
            const prompt = input.prompt!;
            // Native parsing can retain absent query fields as undefined, which is not durable JSON.
            const { conversation, operation } = await invocation(
              id,
              'generate',
              { action: input.action, prompt },
              context.agent!.toolCallId,
              context,
            );
            if (!operation.claimed) return read(conversation, operation);
            const response = await root(() =>
              integration.execution.generate(id, prompt, conversation.billing, operation.requestKey),
            );
            await integration.conversations.bindExecution(
              conversation.billing,
              conversation.owner,
              operation.id,
              response.billing.executionId,
            );
            return state(operation, response);
          }),
      });
    },
    workflowTools(id: string, options: { approvalSteps?: readonly string[] } = {}) {
      if (!identifierSchema.safeParse(id).success) throw new BillingError('invalid_configuration');
      const parsed = z
        .strictObject({
          approvalSteps: z
            .array(identifierSchema)
            .max(100)
            .refine(steps => new Set(steps).size === steps.length)
            .default([]),
        })
        .safeParse(options);
      if (!parsed.success) throw new BillingError('invalid_configuration');
      const settings = parsed.data;
      const resource = integration.resources.workflows[id];
      if (!resource || settings.approvalSteps.some(step => !resource.native.steps[step]?.resumeSchema))
        throw new BillingError('invalid_configuration');
      const start = createTool({
        id: `${id}-start`,
        description: `Start the registered billed ${id} workflow. Query its saved suspension before requesting approval.`,
        inputSchema: originalInput(resource.native.inputSchema),
        execute: (input, context) =>
          safe(async () => {
            const { conversation, operation } = await invocation(
              id,
              'start',
              input,
              context.agent!.toolCallId,
              context,
            );
            if (!operation.claimed) {
              const saved = await read(conversation, operation);
              const projection = (saved as { result?: Json }).result;
              // Only a missing run or one still awaiting admission may resume startup.
              // The durable create/start claims reuse this request key and prevent repeated compute.
              if (
                projection !== null &&
                (typeof projection !== 'object' || Array.isArray(projection) || projection.status !== 'created')
              )
                return saved;
            }
            return root(async () => {
              const run = await integration.execution.createRun(id, conversation.billing, operation.requestKey);
              await integration.conversations.bindExecution(
                conversation.billing,
                conversation.owner,
                operation.id,
                run.executionId,
              );
              return state(
                operation,
                await integration.execution.workflowOperation(
                  id,
                  run.executionId,
                  'start',
                  conversation.billing,
                  operation.requestKey,
                  boundedJson(input),
                ),
              );
            });
          }),
      });
      const queryTool = createTool({
        id: `${id}-query`,
        description:
          'Read an existing operation without repeating it. Omit operationId to recover the latest twenty initiating operations in this conversation, including after Stop or restart.',
        inputSchema: queryReference,
        execute: input =>
          safe(async () => {
            const conversation = runtime.current();
            return query(conversation, id, input.operationId ?? undefined);
          }),
      });
      const envelope = toStandardSchema(
        reference
          .extend({ step: z.enum(settings.approvalSteps as [string, ...string[]]), approvalData: durableJson })
          .superRefine((input, context) => {
            // Reserve the largest supported run identifier and the fixed SHA-256 digest.
            const pending = durableJson.safeParse({
              nativeRunId: 'r'.repeat(identifierSchema.maxLength!),
              step: input.step,
              fingerprint: '0'.repeat(64),
              resumeData: input.approvalData,
            });
            if (!pending.success)
              context.addIssue({
                code: 'custom',
                path: ['approvalData'],
                message: 'Approval data and its metadata must fit the durable JSON limits.',
              });
          }),
      );
      const resumeSchema = {
        '~standard': {
          ...envelope['~standard'],
          jsonSchema: {
            input: (options: Parameters<(typeof envelope)['~standard']['jsonSchema']['input']>[0]) => ({
              type: 'object',
              additionalProperties: false,
              required: ['operationId', 'step', 'approvalData'],
              properties: {
                operationId: { type: 'string', minLength: 1, maxLength: 128 },
                step: { type: 'string', enum: settings.approvalSteps },
                approvalData: {
                  anyOf: settings.approvalSteps.map(step =>
                    resource.native.steps[step].resumeSchema!['~standard'].jsonSchema.input(options),
                  ),
                },
              },
            }),
            output: (options: Parameters<(typeof envelope)['~standard']['jsonSchema']['output']>[0]) =>
              envelope['~standard'].jsonSchema.output(options),
          },
          validate: (value: unknown) => {
            const outer = envelope['~standard'].validate(value);
            const validate = (checked: Awaited<typeof outer>) => {
              if (checked.issues) return checked;
              const input = checked.value;
              const result = resource.native.steps[input.step].resumeSchema!['~standard'].validate(input.approvalData);
              const original = (checked: any) => (checked.issues ? checked : { value: input });
              return result instanceof Promise ? result.then(original) : original(result);
            };
            return outer instanceof Promise ? outer.then(validate) : validate(outer);
          },
        },
      };
      const resume = createTool({
        id: `${id}-resume`,
        description:
          'Request native approval to resume exactly the saved pending business step. The user must approve using Studio controls.',
        inputSchema: originalInput(resumeSchema),
        requireApproval: true,
        beforeApproval: async (input, context) => {
          try {
            const conversation = runtime.current();
            const original = await owned(conversation, input.operationId, id);
            if (!original.executionId) throw new BillingError('conflict');
            const current = await integration.execution.workflowOperation(
              id,
              original.executionId,
              'status',
              conversation.billing,
              undefined,
              null,
            );
            const projection = current.result as Record<string, Json>;
            if (
              projection.status !== 'suspended' ||
              !Array.isArray(projection.suspendedSteps) ||
              !projection.suspendedSteps.includes(input.step)
            )
              throw new BillingError('conflict');
            const nativeRunId = runtime.agents[conversation.owner.agentId].getActiveThreadRunId({
              threadId: conversation.owner.threadId,
              resourceId: conversation.owner.resourceId,
            });
            if (!nativeRunId) throw new BillingError('state_unavailable');
            await invocation(
              id,
              'resume',
              input,
              context.toolCallId,
              undefined,
              original.executionId,
              boundedJson({
                nativeRunId,
                step: input.step,
                fingerprint: fingerprint(boundedJson(projection.pending)),
                resumeData: input.approvalData,
              }),
            );
          } catch {
            return { proceed: false as const, output: { error: { code: 'conflict' } } };
          }
        },
        execute: (input, context) =>
          safe(async () => {
            const conversation = runtime.current();
            const operation = await integration.conversations.get(
              conversation.billing,
              conversation.owner,
              context.agent!.toolCallId,
              true,
            );
            if (operation.resourceId !== id || operation.action !== 'resume') throw new BillingError('forbidden');
            const pending = await validatePending(conversation, operation);
            if (
              pending.step !== input.step ||
              fingerprint(boundedJson(pending.resumeData)) !== fingerprint(boundedJson(input.approvalData))
            )
              throw new BillingError('conflict');
            return state(
              operation,
              await root(() =>
                integration.execution.workflowOperation(
                  id,
                  operation.executionId!,
                  'resume',
                  conversation.billing,
                  operation.requestKey,
                  boundedJson({ step: input.step, resumeData: input.approvalData }),
                ),
              ),
            );
          }),
      });
      const cancel = createTool({
        id: `${id}-cancel`,
        description:
          'Explicitly cancel an existing owned business workflow through billing. Stopping chat does not cancel it.',
        inputSchema: reference,
        execute: (input, context) =>
          safe(async () => {
            const conversation = runtime.current();
            const original = await owned(conversation, input.operationId, id);
            if (!original.executionId) throw new BillingError('conflict');
            const { operation } = await invocation(
              id,
              'cancel',
              input,
              context.agent!.toolCallId,
              context,
              original.executionId,
            );
            return state(
              operation,
              await root(() =>
                integration.execution.workflowOperation(
                  id,
                  original.executionId!,
                  'cancel',
                  conversation.billing,
                  operation.requestKey,
                  {},
                ),
              ),
            );
          }),
      });
      return {
        [`${id}-start`]: start,
        [`${id}-query`]: queryTool,
        ...(settings.approvalSteps.length ? { [`${id}-resume`]: resume } : {}),
        [`${id}-cancel`]: cancel,
      };
    },
  };
}
