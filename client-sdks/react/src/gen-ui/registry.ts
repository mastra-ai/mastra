import type {
  Catalog,
  ComputedFunction,
  DirectiveDefinition,
  EditMode,
  InferCatalogComponents,
  ValidationFunction,
} from '@json-render/core';
import { defineRegistry } from '@json-render/react';
import type { ComponentRegistry, Components } from '@json-render/react';
import type { ComponentType } from 'react';
import { z } from 'zod/v4';
import type { JSONObject } from './json';

/**
 * Props for the optional preview rendered while a component tool's arguments are still streaming.
 * `partialProps` is a best-effort parse of incomplete JSON and has NOT been validated.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIStreamingProps {
  partialProps: JSONObject;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIComponentToolOptions {
  /** Tool name exposed to the model. Defaults to `ui_<componentName>`. */
  name?: string;
  /** Tool description for the model. Defaults to the catalog description. */
  description?: string;
  /**
   * `display` (default): the tool resolves as soon as the component renders.
   * `interactive`: the tool resolves with the value the user submits through `useGenUIToolResponse`.
   */
  mode?: 'display' | 'interactive';
  /** Validates the value passed to `respond()` in interactive mode before it reaches the agent. */
  responseSchema?: z.ZodType;
  /** Rendered instead of the component while the model is still writing the arguments. */
  streaming?: ComponentType<GenUIStreamingProps>;
  /** Also offer the component in specs the model composes through the spec tool. Defaults to `true`. */
  declarative?: boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIToolPhase =
  | 'input-streaming'
  | 'input-available'
  | 'awaiting-approval'
  | 'suspended'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIToolApproval {
  /** `approval`: the tool requires an approve/decline decision. `suspended`: the tool suspended and waits for resume data. */
  kind: 'approval' | 'suspended';
  /** Payload the tool passed to `suspend()`, if any. Untrusted. */
  suspendPayload?: unknown;
  status: 'idle' | 'pending' | 'error';
  error?: string;
  /** Approve, or resume a suspended tool with `resumeData`. */
  approve(resumeData?: unknown): Promise<void>;
  decline(): Promise<void>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIToolCallProps<A = unknown, O = unknown> {
  toolCallId: string;
  toolName: string;
  phase: GenUIToolPhase;
  /** Best-effort parse of the arguments while they stream. Not validated. */
  partialArgs: JSONObject | undefined;
  /** Final arguments. Validated when the renderer declares `argsSchema`. */
  args: A | undefined;
  /** Tool output. Validated when the renderer declares `outputSchema`. */
  output: O | undefined;
  errorText?: string;
  /** Set when `args` or `output` failed schema validation; the raw value is withheld. */
  validationError?: string;
  /** Present while the tool waits for approval or resume data. */
  approval?: GenUIToolApproval;
}

type Output<S> = S extends z.ZodType ? z.output<S> : unknown;

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIToolRendererDefinition<
  AS extends z.ZodType | undefined = undefined,
  OS extends z.ZodType | undefined = undefined,
> {
  argsSchema?: AS;
  outputSchema?: OS;
  component: ComponentType<GenUIToolCallProps<Output<AS>, Output<OS>>>;
}

/**
 * Typed helper for rendering an existing backend tool by name.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function defineGenUIToolRenderer<
  AS extends z.ZodType | undefined = undefined,
  OS extends z.ZodType | undefined = undefined,
>(definition: GenUIToolRendererDefinition<AS, OS>): GenUIToolRendererDefinition<AS, OS> {
  return definition;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIFallbackProps {
  /** Human-readable reason, safe to display. */
  reason: string;
  kind: 'unknown-component' | 'invalid-props' | 'render-error' | 'invalid-spec';
  component?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecStatusProps {
  status: 'streaming' | 'failed' | 'aborted';
  error?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIFallbacks {
  /** Rendered in place of an element or tool UI that cannot be shown. */
  Fallback?: ComponentType<GenUIFallbackProps>;
  /** Rendered while a tool's arguments are streaming. */
  Loading?: ComponentType<{ component?: string }>;
  /** Rendered next to a spec while the model writes it, or after its tool call failed or was stopped. */
  SpecStatus?: ComponentType<GenUISpecStatusProps>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecToolOptions {
  /** Defaults to `ui_spec`. */
  name?: string;
  /** Extra guidance appended to the generated tool description. */
  instructions?: string;
  /**
   * The edit tool, through which the model changes an earlier interface into a new one. On by default with
   * json-render's `patch` mode; `false` turns it off.
   */
  edit?: boolean | GenUISpecEditToolOptions;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecEditToolOptions {
  /** Defaults to `ui_spec_edit`. */
  name?: string;
  /** json-render edit modes the model may use. Defaults to `['patch']`. */
  modes?: EditMode[];
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface CreateGenUIOptions<C extends Catalog = Catalog> {
  /** json-render catalog: component props schemas, descriptions and events, plus the actions specs may bind. */
  catalog?: C;
  /** One React implementation per catalog component, exactly as passed to json-render's `defineRegistry`. */
  components?: Components<C>;
  /** Catalog components the model may also call directly as frontend tools. */
  componentTools?: { [K in keyof InferCatalogComponents<C>]?: true | GenUIComponentToolOptions };
  /** Renderers for backend tools, by tool name. */
  tools?: Record<string, GenUIToolRendererDefinition<any, any>>;
  fallbacks?: GenUIFallbacks;
  /** Expose `ui_spec`, through which the model composes catalog components into a json-render spec. */
  specTool?: boolean | GenUISpecToolOptions;
  /** Functions specs may call with `$computed`. */
  functions?: Record<string, ComputedFunction>;
  /** Validation functions form fields may use in `checks`, besides json-render's built-in ones. */
  validationFunctions?: Record<string, ValidationFunction>;
  /** Custom `$`-prefixed prop expressions specs may use. Their descriptions are sent to the model. */
  directives?: DirectiveDefinition[];
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIComponentEntry {
  name: string;
  props: z.ZodType;
  description?: string;
  events: readonly string[];
  /** Named slots specs may fill besides `children`. */
  slots: readonly string[];
  /** Whether model-composed specs may use the component. */
  declarative: boolean;
  /** JSON Schema of the props, sent to the model. */
  propsSchema: JSONObject;
  tool?: {
    name: string;
    description?: string;
    mode: 'display' | 'interactive';
    responseSchema?: z.ZodType;
    streaming?: ComponentType<GenUIStreamingProps>;
  };
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionEntry {
  name: string;
  params?: z.ZodType;
  description?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIRegistry<C extends Catalog = Catalog> {
  readonly catalog?: C;
  /** json-render component registry built from `components`. */
  readonly registry: ComponentRegistry;
  readonly components: Readonly<Record<string, GenUIComponentEntry>>;
  readonly actions: Readonly<Record<string, GenUIActionEntry>>;
  /** Tool name → component name. */
  readonly componentTools: Readonly<Record<string, string>>;
  readonly tools: Readonly<Record<string, GenUIToolRendererDefinition<any, any>>>;
  readonly fallbacks: GenUIFallbacks;
  readonly specTool?: { name: string; instructions?: string; edit?: { name: string; modes: EditMode[] } };
  readonly functions: Readonly<Record<string, ComputedFunction>>;
  readonly validationFunctions: Readonly<Record<string, ValidationFunction>>;
  readonly directives: DirectiveDefinition[];
}

const COMPONENT_NAME = /^[A-Za-z0-9_\-.:]{1,128}$/;
const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;

/** JSON Schema of what the model writes: the input side of the schema, without the dialect marker. */
function modelSchema(schema: z.ZodType): JSONObject {
  const { $schema: _dialect, ...json } = z.toJSONSchema(schema, { target: 'draft-07', io: 'input' });
  return json as JSONObject;
}

/**
 * Build a GenUI setup around a json-render catalog. The catalog declares what the model may render; the
 * options decide how it reaches the model (component tools, `ui_spec`) and how backend tools render.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUI<C extends Catalog = Catalog>(options: CreateGenUIOptions<C>): GenUIRegistry<C> {
  const { catalog } = options;
  const data = (catalog?.data ?? {}) as {
    components?: Record<string, { props: z.ZodType; description?: string; events?: string[]; slots?: string[] }>;
    actions?: Record<string, { params?: z.ZodType; description?: string }>;
  };
  const catalogComponents = data.components ?? {};
  const catalogActions = data.actions ?? {};
  const implementations = (options.components ?? {}) as Record<string, unknown>;
  const toolOptions = (options.componentTools ?? {}) as Record<string, true | GenUIComponentToolOptions | undefined>;

  for (const name of Object.keys(implementations)) {
    if (!catalogComponents[name]) throw new Error(`GenUI component "${name}" is not in the catalog`);
  }
  for (const name of Object.keys(toolOptions)) {
    if (!catalogComponents[name]) throw new Error(`GenUI component tool "${name}" is not in the catalog`);
  }

  const components: Record<string, GenUIComponentEntry> = {};
  const componentTools: Record<string, string> = {};
  for (const [name, definition] of Object.entries(catalogComponents)) {
    if (!COMPONENT_NAME.test(name)) throw new Error(`Invalid GenUI component name "${name}"`);
    if (!implementations[name]) throw new Error(`GenUI component "${name}" has no implementation`);
    const raw = toolOptions[name];
    const tool = raw === true ? {} : raw;
    const entry: GenUIComponentEntry = {
      name,
      props: definition.props,
      events: definition.events ?? [],
      slots: (definition.slots ?? []).filter(slot => slot !== 'default'),
      declarative: tool?.declarative ?? true,
      propsSchema: modelSchema(definition.props),
    };
    if (definition.description) entry.description = definition.description;
    if (tool) {
      const toolName = tool.name ?? `ui_${name.replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 64);
      if (!TOOL_NAME.test(toolName)) throw new Error(`Invalid GenUI tool name "${toolName}"`);
      if (componentTools[toolName] || options.tools?.[toolName]) {
        throw new Error(`GenUI tool name "${toolName}" is used twice`);
      }
      componentTools[toolName] = name;
      entry.tool = { name: toolName, mode: tool.mode ?? 'display' };
      const description = tool.description ?? definition.description;
      if (description) entry.tool.description = description;
      if (tool.responseSchema) entry.tool.responseSchema = tool.responseSchema;
      if (tool.streaming) entry.tool.streaming = tool.streaming;
    }
    components[name] = entry;
  }

  const actions: Record<string, GenUIActionEntry> = {};
  for (const [name, definition] of Object.entries(catalogActions)) {
    actions[name] = { name, ...definition };
  }

  let specTool: GenUIRegistry['specTool'];
  if (options.specTool) {
    if (!Object.values(components).some(entry => entry.declarative)) {
      throw new Error('The GenUI spec tool needs at least one catalog component specs may use');
    }
    const config = options.specTool === true ? {} : options.specTool;
    const name = config.name ?? 'ui_spec';
    if (!TOOL_NAME.test(name)) throw new Error(`Invalid GenUI tool name "${name}"`);
    if (componentTools[name] || options.tools?.[name]) throw new Error(`GenUI tool name "${name}" is used twice`);
    let edit: NonNullable<GenUIRegistry['specTool']>['edit'];
    if (config.edit !== false) {
      const editConfig = config.edit === true || !config.edit ? {} : config.edit;
      const editName = editConfig.name ?? 'ui_spec_edit';
      if (!TOOL_NAME.test(editName)) throw new Error(`Invalid GenUI tool name "${editName}"`);
      if (editName === name || componentTools[editName] || options.tools?.[editName]) {
        throw new Error(`GenUI tool name "${editName}" is used twice`);
      }
      const modes = [...new Set<EditMode>(editConfig.modes ?? ['patch'])];
      if (!modes.length) throw new Error('The GenUI spec edit tool needs at least one edit mode');
      edit = { name: editName, modes };
    }
    specTool = {
      name,
      ...(config.instructions ? { instructions: config.instructions } : {}),
      ...(edit ? { edit } : {}),
    };
  }

  const { registry } = catalog
    ? defineRegistry(catalog, { components: implementations } as never)
    : { registry: {} as ComponentRegistry };

  return Object.freeze({
    ...(catalog ? { catalog } : {}),
    registry,
    components: Object.freeze(components),
    actions: Object.freeze(actions),
    componentTools: Object.freeze(componentTools),
    tools: Object.freeze({ ...options.tools }),
    fallbacks: options.fallbacks ?? {},
    ...(specTool ? { specTool } : {}),
    functions: Object.freeze({ ...options.functions }),
    validationFunctions: Object.freeze({ ...options.validationFunctions }),
    directives: [...(options.directives ?? [])],
  });
}
