import type {
  Catalog,
  ComputedFunction,
  DirectiveDefinition,
  InferCatalogComponents,
  ValidationFunction,
} from '@json-render/core';
import { defineRegistry } from '@json-render/react';
import type { ComponentRegistry, Components } from '@json-render/react';
import { createGenUIDefinition, readCatalog } from '@mastra/client-js/gen-ui';
import type {
  GenUIComponentEntry as CoreComponentEntry,
  GenUIComponentToolConfig,
  GenUIDefinition,
  GenUISpecToolOptions,
  GenUIToolPhase,
  JSONObject,
} from '@mastra/client-js/gen-ui';
import type { ComponentType } from 'react';
import type { z } from 'zod/v4';
import type { GenUIMcpAppsOptions } from './mcp-apps';

export type {
  GenUIActionEntry,
  GenUISpecEditMode,
  GenUISpecEditToolOptions,
  GenUISpecToolOptions,
  GenUIToolPhase,
} from '@mastra/client-js/gen-ui';

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
export interface GenUIComponentToolOptions extends GenUIComponentToolConfig {
  /** Rendered instead of the component while the model is still writing the arguments. */
  streaming?: ComponentType<GenUIStreamingProps>;
}

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
  /** Render the result of agent tools that have an MCP App as the app itself. */
  mcpApps?: GenUIMcpAppsOptions;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIComponentEntry extends CoreComponentEntry {
  tool?: NonNullable<CoreComponentEntry['tool']> & { streaming?: ComponentType<GenUIStreamingProps> };
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIRegistry<C extends Catalog = Catalog> extends GenUIDefinition<C> {
  /** json-render component registry built from `components`. */
  readonly registry: ComponentRegistry;
  readonly components: Readonly<Record<string, GenUIComponentEntry>>;
  readonly tools: Readonly<Record<string, GenUIToolRendererDefinition<any, any>>>;
  readonly fallbacks: GenUIFallbacks;
  readonly mcpApps?: GenUIMcpAppsOptions;
}

/**
 * Build a GenUI setup around a json-render catalog. The catalog declares what the model may render; the
 * options decide how it reaches the model (component tools, `ui_spec`) and how backend tools render.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUI<C extends Catalog = Catalog>(options: CreateGenUIOptions<C>): GenUIRegistry<C> {
  const { catalog } = options;
  const catalogComponents = readCatalog(catalog).components;
  const implementations = (options.components ?? {}) as Record<string, unknown>;
  for (const name of Object.keys(implementations)) {
    if (!catalogComponents[name]) throw new Error(`GenUI component "${name}" is not in the catalog`);
  }

  const definition = createGenUIDefinition({ ...options, reservedToolNames: Object.keys(options.tools ?? {}) });
  const toolOptions = (options.componentTools ?? {}) as Record<string, true | GenUIComponentToolOptions | undefined>;
  const components: Record<string, GenUIComponentEntry> = {};
  for (const [name, entry] of Object.entries(definition.components)) {
    if (!implementations[name]) throw new Error(`GenUI component "${name}" has no implementation`);
    const raw = toolOptions[name];
    const streaming = raw === true ? undefined : raw?.streaming;
    components[name] = streaming && entry.tool ? { ...entry, tool: { ...entry.tool, streaming } } : entry;
  }

  const { registry } = catalog
    ? defineRegistry(catalog, { components: implementations } as never)
    : { registry: {} as ComponentRegistry };

  return Object.freeze({
    ...definition,
    registry,
    components: Object.freeze(components),
    tools: Object.freeze({ ...options.tools }),
    fallbacks: options.fallbacks ?? {},
    ...(options.mcpApps ? { mcpApps: options.mcpApps } : {}),
  });
}
