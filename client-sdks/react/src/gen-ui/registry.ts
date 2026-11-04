import { isStandardSchema, toSafeJSONObject } from '@mastra/client-js/gen-ui';
import type {
  GenUILimits,
  GenUIPlacement,
  InferSchemaOutput,
  JSONObject,
  StandardSchemaV1,
} from '@mastra/client-js/gen-ui';
import type { ComponentType, ReactNode } from 'react';

/** Props every registered GenUI component receives. `props` has passed the component's schema. */
export interface GenUIComponentProps<P> {
  props: P;
  /** Rendered child nodes when the component is used inside a declarative surface. */
  children?: ReactNode;
}

/**
 * Props for the optional preview rendered while a frontend tool's arguments are
 * still streaming. `partialProps` is a best-effort parse of incomplete JSON and
 * has NOT been validated, so treat every field as possibly missing.
 */
export interface GenUIStreamingProps {
  partialProps: JSONObject;
}

export interface GenUIComponentToolOptions<R extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined> {
  /** Tool name exposed to the model. Defaults to `ui_<componentName>`. */
  name?: string;
  /** Tool description for the model. Defaults to the component description. */
  description?: string;
  /**
   * `display` (default): the tool resolves as soon as the component renders.
   * `interactive`: the tool resolves with the value the user submits through `useGenUIToolResponse`.
   */
  mode?: 'display' | 'interactive';
  /** Validates the value passed to `respond()` in interactive mode before it reaches the agent. */
  responseSchema?: R;
}

export interface GenUIComponentDefinition<S extends StandardSchemaV1 = StandardSchemaV1> {
  /** Validates every props object coming from the model. Must support synchronous validation. */
  schema: S;
  component: ComponentType<GenUIComponentProps<InferSchemaOutput<S>>>;
  /** Optional preview while a frontend tool call is still streaming its arguments. */
  streaming?: ComponentType<GenUIStreamingProps>;
  /** Model-facing description, used for tool descriptions and the surface catalog. */
  description?: string;
  /**
   * JSON Schema sent to the model. Zod schemas and schemas implementing Standard JSON Schema are
   * converted automatically; provide this for any other validator.
   */
  jsonSchema?: JSONObject;
  /** Expose the component as a frontend tool the model can call directly. Off by default. */
  tool?: boolean | GenUIComponentToolOptions;
  /** Allow the component in declarative surfaces. Defaults to `true`. */
  declarative?: boolean;
}

/**
 * Type-erased definition for heterogeneous registries. `StandardSchemaV1<any, any>` (rather than `any`)
 * keeps props as `any`, so a definition can be spread and extended (`{ ...Card, tool: true }`).
 */
export type AnyGenUIComponentDefinition = GenUIComponentDefinition<StandardSchemaV1<any, any>>;

/** Typed helper: infers component props from the schema. */
export function defineGenUIComponent<S extends StandardSchemaV1>(
  definition: GenUIComponentDefinition<S>,
): GenUIComponentDefinition<S> {
  return definition;
}

export type GenUIToolPhase =
  | 'input-streaming'
  | 'input-available'
  | 'awaiting-approval'
  | 'suspended'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

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

export interface GenUIToolRendererDefinition<
  AS extends StandardSchemaV1 | undefined = undefined,
  OS extends StandardSchemaV1 | undefined = undefined,
> {
  argsSchema?: AS;
  outputSchema?: OS;
  component: ComponentType<GenUIToolCallProps<InferSchemaOutput<AS>, InferSchemaOutput<OS>>>;
}

/** Typed helper for rendering an existing backend tool by name. */
export function defineGenUIToolRenderer<
  AS extends StandardSchemaV1 | undefined = undefined,
  OS extends StandardSchemaV1 | undefined = undefined,
>(definition: GenUIToolRendererDefinition<AS, OS>): GenUIToolRendererDefinition<AS, OS> {
  return definition;
}

export interface GenUIFallbackProps {
  /** Human-readable reason, safe to display. */
  reason: string;
  kind: 'unknown-component' | 'invalid-props' | 'render-error' | 'incompatible-catalog' | 'invalid-surface';
  component?: string;
}

export interface GenUISurfaceStatusProps {
  status: 'streaming' | 'failed' | 'aborted';
  error?: string;
}

export interface GenUIFallbacks {
  /** Rendered in place of a node or tool UI that cannot be shown. */
  Fallback?: ComponentType<GenUIFallbackProps>;
  /** Rendered while a node's props are incomplete or a tool's arguments are streaming. */
  Loading?: ComponentType<{ component?: string }>;
  /** Rendered next to a surface tree while it streams, or after it failed or was aborted. */
  SurfaceStatus?: ComponentType<GenUISurfaceStatusProps>;
}

export interface GenUICatalog {
  id: string;
  /** Semver-like version string. Surfaces declaring a different major version are treated as incompatible. */
  version: string;
}

export interface GenUISurfaceToolOptions {
  /** Defaults to `ui_surface`. */
  name?: string;
  /** Extra guidance appended to the generated tool description. */
  instructions?: string;
  /**
   * Placements the model may choose. List only those your app renders: `inline` renders in the
   * message, every other placement needs a `GenUISurfaceOutlet`. Defaults to `['inline']`.
   */
  placements?: GenUIPlacement[];
}

export interface CreateGenUIOptions {
  /** Components the model may use, keyed by the name the model refers to. */
  components?: Record<string, AnyGenUIComponentDefinition>;
  /** Custom renderers for existing backend tools, keyed by tool id. */
  tools?: Record<string, GenUIToolRendererDefinition<any, any>>;
  fallbacks?: GenUIFallbacks;
  catalog?: GenUICatalog;
  /**
   * Expose a frontend tool that lets the model compose declarative surfaces from the
   * registered components. Off by default.
   */
  surfaceTool?: boolean | GenUISurfaceToolOptions;
  limits?: Partial<GenUILimits>;
}

export interface GenUIComponentEntry {
  name: string;
  definition: AnyGenUIComponentDefinition;
  /** Present when the component is exposed as a frontend tool. */
  tool?: {
    name: string;
    description: string;
    mode: 'display' | 'interactive';
    /** JSON Schema, or a zod 3 schema that client-js converts when sending tools. */
    inputSchema: JSONObject | StandardSchemaV1;
    responseSchema?: StandardSchemaV1;
  };
}

export interface GenUIManifestComponent {
  name: string;
  description?: string;
  /** Omitted for zod 3 schemas without an explicit `jsonSchema`. */
  propsSchema?: JSONObject;
}

/** Immutable, shareable GenUI configuration. Create it once at module scope. */
export interface GenUIRegistry {
  readonly components: Readonly<Record<string, GenUIComponentEntry>>;
  /** Frontend tool name → component name. */
  readonly componentTools: Readonly<Record<string, string>>;
  readonly tools: Readonly<Record<string, GenUIToolRendererDefinition<any, any>>>;
  readonly fallbacks: GenUIFallbacks;
  readonly catalog?: GenUICatalog;
  readonly surfaceTool?: { name: string; instructions?: string; placements: readonly GenUIPlacement[] };
  readonly limits?: Partial<GenUILimits>;
  /** Serializable description of every declarative component. Safe to send to a server. */
  manifest(): GenUIManifestComponent[];
}

const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const COMPONENT_NAME = /^[A-Za-z0-9_\-.:]{1,128}$/;

const defaultToolName = (componentName: string) => `ui_${componentName.replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 64);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const MAX_JSON_SCHEMA_DEPTH = 64;

/**
 * Resolve the schema sent to the model. Prefers an explicit `jsonSchema`, then Standard JSON Schema
 * (zod 4, arktype, valibot adapters). Zod 3 schemas are handed to client-js as-is, which converts them.
 */
function resolveModelSchema(name: string, definition: AnyGenUIComponentDefinition): JSONObject | StandardSchemaV1 {
  if (definition.jsonSchema) return definition.jsonSchema;
  const schema = definition.schema;
  const standard = schema['~standard'];
  const jsonSchema = 'jsonSchema' in standard && isRecord(standard.jsonSchema) ? standard.jsonSchema : undefined;
  if (typeof jsonSchema?.input === 'function') {
    const result: unknown = jsonSchema.input({ target: 'draft-07' });
    // Copying drops the non-enumerable `~standard` zod puts on its output, so it isn't mistaken for a schema object.
    if (isRecord(result)) return toSafeJSONObject(result, MAX_JSON_SCHEMA_DEPTH);
  }
  if (schema['~standard'].vendor === 'zod') return schema;
  throw new Error(
    `GenUI component "${name}": cannot derive a JSON Schema from a "${schema['~standard'].vendor}" schema. ` +
      'Pass `jsonSchema` explicitly.',
  );
}

/**
 * Create a GenUI registry. Only what you register here can ever be rendered, and only
 * components with `tool` set are exposed to the model as tools.
 */
export function createGenUI(options: CreateGenUIOptions = {}): GenUIRegistry {
  const components: Record<string, GenUIComponentEntry> = {};
  const componentTools: Record<string, string> = {};
  const schemaCache = new Map<string, JSONObject | StandardSchemaV1>();
  const modelSchemaFor = (name: string, definition: AnyGenUIComponentDefinition) => {
    let cached = schemaCache.get(name);
    if (!cached) {
      cached = resolveModelSchema(name, definition);
      schemaCache.set(name, cached);
    }
    return cached;
  };

  for (const [name, definition] of Object.entries(options.components ?? {})) {
    if (!COMPONENT_NAME.test(name)) throw new Error(`GenUI component name "${name}" is invalid`);
    if (!definition || typeof definition.component === 'undefined' || !isRecord(definition.schema)) {
      throw new Error(`GenUI component "${name}" needs a component and a schema`);
    }
    const entry: GenUIComponentEntry = { name, definition };
    if (definition.tool) {
      const toolOptions: GenUIComponentToolOptions = definition.tool === true ? {} : definition.tool;
      const toolName = toolOptions.name ?? defaultToolName(name);
      if (!TOOL_NAME.test(toolName)) throw new Error(`GenUI tool name "${toolName}" is invalid`);
      if (componentTools[toolName]) {
        throw new Error(`GenUI tool name "${toolName}" is used by both "${componentTools[toolName]}" and "${name}"`);
      }
      componentTools[toolName] = name;
      entry.tool = {
        name: toolName,
        description: toolOptions.description ?? definition.description ?? `Render the ${name} component.`,
        mode: toolOptions.mode ?? 'display',
        inputSchema: modelSchemaFor(name, definition),
        ...(toolOptions.responseSchema ? { responseSchema: toolOptions.responseSchema } : {}),
      };
    }
    components[name] = entry;
  }

  const surfaceToolOptions = options.surfaceTool === true ? {} : options.surfaceTool || undefined;
  const surfaceTool = surfaceToolOptions
    ? {
        name: surfaceToolOptions.name ?? 'ui_surface',
        instructions: surfaceToolOptions.instructions,
        placements: Object.freeze([...new Set<GenUIPlacement>(surfaceToolOptions.placements ?? ['inline'])]),
      }
    : undefined;
  if (surfaceTool) {
    if (!TOOL_NAME.test(surfaceTool.name)) throw new Error(`GenUI tool name "${surfaceTool.name}" is invalid`);
    if (surfaceTool.placements.length === 0) throw new Error('GenUI surface tool needs at least one placement');
    if (componentTools[surfaceTool.name]) {
      throw new Error(`GenUI surface tool name "${surfaceTool.name}" collides with a component tool`);
    }
  }
  for (const toolName of Object.keys(options.tools ?? {})) {
    if (componentTools[toolName] || surfaceTool?.name === toolName) {
      throw new Error(`GenUI tool renderer "${toolName}" collides with a GenUI frontend tool of the same name`);
    }
  }

  const registry: GenUIRegistry = {
    components,
    componentTools,
    tools: { ...options.tools },
    fallbacks: { ...options.fallbacks },
    catalog: options.catalog,
    surfaceTool,
    limits: options.limits,
    manifest: () =>
      Object.values(components)
        .filter(entry => entry.definition.declarative !== false)
        .map(entry => {
          const schema = modelSchemaFor(entry.name, entry.definition);
          return {
            name: entry.name,
            ...(entry.definition.description ? { description: entry.definition.description } : {}),
            ...(isStandardSchema(schema) ? {} : { propsSchema: schema }),
          };
        }),
  };
  return Object.freeze(registry);
}

/** Is a surface's declared catalog compatible with the registry's? Surfaces without a catalog always are. */
export function isCatalogCompatible(
  registry: GenUIRegistry,
  surface: { catalogId?: string; catalogVersion?: string },
): boolean {
  if (!surface.catalogId || !registry.catalog) return true;
  if (surface.catalogId !== registry.catalog.id) return false;
  if (!surface.catalogVersion) return true;
  const major = (version: string) => version.split('.')[0];
  return major(surface.catalogVersion) === major(registry.catalog.version);
}
