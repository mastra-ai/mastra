import type { Catalog, InferCatalogComponents } from '@json-render/core';
import { defineRegistry } from '@json-render/react';
import type { ComponentRegistry, Components } from '@json-render/react';
import type { GenUILimits, GenUIPlacement, JSONObject } from '@mastra/client-js/gen-ui';
import type { ComponentType } from 'react';
import { z } from 'zod/v4';

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
  /** Also offer the component in `ui_surface` specs. Defaults to `true`. */
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
  kind: 'unknown-component' | 'invalid-props' | 'render-error' | 'invalid-surface';
  component?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISurfaceStatusProps {
  status: 'streaming' | 'failed' | 'aborted';
  error?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIFallbacks {
  /** Rendered in place of an element or tool UI that cannot be shown. */
  Fallback?: ComponentType<GenUIFallbackProps>;
  /** Rendered while a tool's arguments are streaming. */
  Loading?: ComponentType<{ component?: string }>;
  /** Rendered next to a surface while it streams, or after it failed or was aborted. */
  SurfaceStatus?: ComponentType<GenUISurfaceStatusProps>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISurfaceToolOptions {
  /** Defaults to `ui_surface`. */
  name?: string;
  /** Extra guidance appended to the generated tool description. */
  instructions?: string;
  /** Placements the model may choose. Defaults to `['inline']`. */
  placements?: readonly GenUIPlacement[];
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface CreateGenUIOptions<C extends Catalog = Catalog> {
  /** json-render catalog: component props schemas, descriptions and events, plus the actions surfaces may bind. */
  catalog?: C;
  /** One React implementation per catalog component, exactly as passed to json-render's `defineRegistry`. */
  components?: Components<C>;
  /** Catalog components the model may also call directly as frontend tools. */
  componentTools?: { [K in keyof InferCatalogComponents<C>]?: true | GenUIComponentToolOptions };
  /** Renderers for backend tools, by tool name. */
  tools?: Record<string, GenUIToolRendererDefinition<any, any>>;
  fallbacks?: GenUIFallbacks;
  /** Expose `ui_surface`, through which the model composes catalog components into a json-render spec. */
  surfaceTool?: boolean | GenUISurfaceToolOptions;
  limits?: Partial<GenUILimits>;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIComponentEntry {
  name: string;
  props: z.ZodType;
  description?: string;
  events: readonly string[];
  /** Whether surfaces may use the component. */
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
  readonly surfaceTool?: { name: string; instructions?: string; placements: readonly GenUIPlacement[] };
  readonly limits?: Partial<GenUILimits>;
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
 * options decide how it reaches the model (component tools, `ui_surface`) and how backend tools render.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUI<C extends Catalog = Catalog>(options: CreateGenUIOptions<C>): GenUIRegistry<C> {
  const { catalog } = options;
  const data = (catalog?.data ?? {}) as {
    components?: Record<string, { props: z.ZodType; description?: string; events?: string[] }>;
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

  let surfaceTool: GenUIRegistry['surfaceTool'];
  if (options.surfaceTool) {
    if (!Object.values(components).some(entry => entry.declarative)) {
      throw new Error('The GenUI surface tool needs at least one catalog component surfaces may use');
    }
    const config = options.surfaceTool === true ? {} : options.surfaceTool;
    const name = config.name ?? 'ui_surface';
    if (!TOOL_NAME.test(name)) throw new Error(`Invalid GenUI tool name "${name}"`);
    if (componentTools[name] || options.tools?.[name]) throw new Error(`GenUI tool name "${name}" is used twice`);
    const placements = config.placements?.length ? [...config.placements] : (['inline'] as GenUIPlacement[]);
    surfaceTool = { name, placements, ...(config.instructions ? { instructions: config.instructions } : {}) };
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
    ...(surfaceTool ? { surfaceTool } : {}),
    ...(options.limits ? { limits: options.limits } : {}),
  });
}
