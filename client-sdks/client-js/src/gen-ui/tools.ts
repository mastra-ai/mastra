import { builtInValidationFunctions } from '@json-render/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { GenUIDefinition } from './definition';
import { createSpecResolver } from './resolver';
import type { GenUISpecResolver } from './resolver';
import { readSpecToolArgs, specToolInputSchema } from './spec';
import { applySpecEdit, readSpecEditArgs, specEditDescription, specEditInputSchema } from './spec-edit';
import { createSpecValidator } from './validator';
import type { GenUISpecValidator } from './validator';

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecToolExecuteContext {
  /** The id of the tool call being run. The edit tool needs it to find what it edits. */
  toolCallId?: string;
  /**
   * The conversation so far, as stored thread messages. The edit tool needs it to find the interface it edits:
   * the call's `target`, or the latest spec before the call.
   */
  messages?: ReadonlyArray<MastraDBMessage>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecTool {
  name: string;
  description: string;
  /** JSON Schema of the arguments the model writes. */
  inputSchema: ReturnType<typeof specToolInputSchema> | ReturnType<typeof specEditInputSchema>;
  /** Checks the model's spec or edit; resolves `{ ok: false, error }` for the model to fix it. */
  execute(input: unknown, context?: GenUISpecToolExecuteContext): Promise<Record<string, unknown>>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface CreateSpecToolsOptions {
  definition: GenUIDefinition;
  /**
   * Reads the interfaces edits apply to from each call's `messages`. Pass the resolver your views read, so an
   * edit starts from the same state the user had set in its target (its `stateOf`). Defaults to a new resolver,
   * where an edit starts from the state the target's spec set.
   */
  resolver?: GenUISpecResolver;
  /** Defaults to a validator for the definition. */
  validator?: GenUISpecValidator;
}

/** The model-facing description of the spec tool: the spec format and what the definition offers. */
function specToolDescription(definition: GenUIDefinition): string {
  const declarative = Object.values(definition.components).filter(entry => entry.declarative);
  const actionNames = Object.keys(definition.actions);
  const functionNames = Object.keys(definition.functions);
  return [
    'Render a user interface built only from the registered components below, as a json-render spec:',
    '`root` is the id of the top element and `elements` lists every element as {id, type, props, children?}.',
    'Each call renders a new, complete interface where the call appears in the conversation.',
    'Put initial values in `state`, as a JSON object string. Props can read state with {"$state": "/path"}; inputs bind two-way with {"$bindState": "/path"}; {"$template": "Hi ${/name}"} interpolates; other json-render expressions ($cond/$then/$else, $computed) go in {"$expr": "<expression as JSON>"}.',
    'For lists backed by a state array, put `repeat` {statePath, key} on a container: its children render once per item and read it with {"$item": "field"}, {"$index": true} and {"$bindItem": "field"}.',
    '`visible` shows an element only when a condition holds, e.g. "{\\"$state\\": \\"/tab\\", \\"eq\\": \\"home\\"}" (operators eq, neq, gt, gte, lt, lte, not; combine with $and / $or).',
    `Elements react to component events through \`on\` and to state changes through \`watch\`, lists like [{"event": "press", "action": "setState", "params": "{\\"statePath\\": \\"/open\\", \\"value\\": true}"}]; a binding may ask first with \`confirm\` and chain \`onSuccess\` / \`onError\`. Built-in actions: setState, pushState, removeState, validateForm${
      actionNames.length ? `. App actions: ${actionNames.join(', ')}` : ''
    }.`,
    functionNames.length
      ? `Functions for {"$expr": "{\\"$computed\\": \\"<name>\\", \\"args\\": {...}}"}: ${functionNames.join(', ')}.`
      : '',
    definition.directives.length
      ? `Custom expressions, written as {"<name>": ...} (inside {"$expr": ...} when nested or strict):\n${definition.directives
          .map(({ name, description }) => `- ${name}${description ? `: ${description}` : ''}`)
          .join('\n')}`
      : '',
    `Form fields with a \`checks\` prop, like [{"type": "required", "message": "..."}], are checked by validateForm, which writes {valid, errors} to its statePath (default /formValidation). Check types: ${[
      ...Object.keys(builtInValidationFunctions),
      ...Object.keys(definition.validationFunctions),
    ].join(', ')}.`,
    // Prop schemas are already in the input schema; repeating them here would double the tokens.
    `Components (props must match the component's schema in the input schema):\n${declarative
      .map(({ name, description, events, slots }) =>
        [
          `- ${name}`,
          description ? `: ${description}` : '',
          events.length ? ` (events: ${events.join(', ')})` : '',
          slots.length ? ` (slots: ${slots.join(', ')})` : '',
        ].join(''),
      )
      .join('\n')}`,
    definition.specTool?.instructions,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The spec tool and its edit tool a definition configures, ready to hand to an agent as client tools or to run
 * on a server. Empty when the definition has no spec tool.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createSpecTools(options: CreateSpecToolsOptions): GenUISpecTool[] {
  const { definition } = options;
  const specTool = definition.specTool;
  if (!specTool) return [];
  const resolver = options.resolver ?? createSpecResolver({ specTool });
  const { checkSpec } = options.validator ?? createSpecValidator(definition);
  const edit = specTool.edit;
  const declarative = Object.values(definition.components).filter(entry => entry.declarative);

  const tools: GenUISpecTool[] = [
    {
      name: specTool.name,
      description: specToolDescription(definition),
      inputSchema: specToolInputSchema(declarative),
      execute: async (input, context) => {
        const read = readSpecToolArgs(input, true);
        if (!read.ok) return { ok: false, error: read.error };
        const error = checkSpec(read.spec);
        if (error) return { ok: false, error };
        const id = context?.toolCallId;
        return { ok: true, ...(id ? { id } : {}) };
      },
    },
  ];

  if (edit) {
    tools.push({
      name: edit.name,
      description: specEditDescription(edit.modes, specTool.name),
      inputSchema: specEditInputSchema(edit.modes),
      execute: async (input, context) => {
        const id = context?.toolCallId;
        if (!id) return { ok: false, error: `${edit.name} was called without a tool call id` };
        if (!context?.messages) return { ok: false, error: `${edit.name} was called without the conversation` };
        const read = readSpecEditArgs(input, true, edit.modes);
        if (!read.ok) return { ok: false, error: read.error };
        resolver.update(context.messages);
        const base = resolver.readEditBase(id, read.edit);
        if (!base.spec) return { ok: false, error: base.error ?? `interface "${base.target}" is not complete yet` };
        const applied = applySpecEdit(base.spec, read.edit);
        if (!applied.ok) return { ok: false, error: applied.error };
        const error = checkSpec(applied.spec);
        if (error) return { ok: false, error };
        return {
          ok: true,
          id,
          target: base.target,
          baseState: base.spec.state ?? {},
        };
      },
    });
  }
  return tools;
}
