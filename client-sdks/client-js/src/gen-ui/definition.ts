import type {
  Catalog,
  ComputedFunction,
  DirectiveDefinition,
  EditMode,
  InferCatalogComponents,
  ValidationFunction,
} from '@json-render/core';
import { z } from 'zod/v4';
import type { JSONObject } from './json';

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
export interface GenUIComponentToolConfig {
  /** Tool name exposed to the model. Defaults to `ui_<componentName>`. */
  name?: string;
  /** Tool description for the model. Defaults to the catalog description. */
  description?: string;
  /**
   * `display` (default): the tool resolves as soon as the component renders.
   * `interactive`: the tool resolves with the value the user submits.
   */
  mode?: 'display' | 'interactive';
  /** Validates the value the user submits in interactive mode before it reaches the agent. */
  responseSchema?: z.ZodType;
  /** Also offer the component in specs the model composes through the spec tool. Defaults to `true`. */
  declarative?: boolean;
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
  };
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionEntry {
  name: string;
  params?: z.ZodType;
  description?: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecToolConfig {
  name: string;
  instructions?: string;
  edit?: { name: string; modes: EditMode[] };
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface CreateGenUIDefinitionOptions<C extends Catalog = Catalog> {
  /** json-render catalog: component props schemas, descriptions and events, plus the actions specs may bind. */
  catalog?: C;
  /** Catalog components the model may also call directly as tools. */
  componentTools?: { [K in keyof InferCatalogComponents<C>]?: true | GenUIComponentToolConfig };
  /** Expose `ui_spec`, through which the model composes catalog components into a json-render spec. */
  specTool?: boolean | GenUISpecToolOptions;
  /** Functions specs may call with `$computed`. */
  functions?: Record<string, ComputedFunction>;
  /** Validation functions form fields may use in `checks`, besides json-render's built-in ones. */
  validationFunctions?: Record<string, ValidationFunction>;
  /** Custom `$`-prefixed prop expressions specs may use. Their descriptions are sent to the model. */
  directives?: DirectiveDefinition[];
  /** Tool names already taken, such as backend tools; GenUI tools may not reuse them. */
  reservedToolNames?: Iterable<string>;
}

/**
 * What a catalog offers the model, independent of how it renders: component entries with their model-facing
 * schemas, catalog actions, component tools and the spec tool configuration.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIDefinition<C extends Catalog = Catalog> {
  readonly catalog?: C;
  readonly components: Readonly<Record<string, GenUIComponentEntry>>;
  readonly actions: Readonly<Record<string, GenUIActionEntry>>;
  /** Tool name → component name. */
  readonly componentTools: Readonly<Record<string, string>>;
  readonly specTool?: GenUISpecToolConfig;
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

/** The components and actions a json-render catalog declares. */
export function readCatalog(catalog: Catalog | undefined) {
  const data = (catalog?.data ?? {}) as {
    components?: Record<string, { props: z.ZodType; description?: string; events?: string[]; slots?: string[] }>;
    actions?: Record<string, { params?: z.ZodType; description?: string }>;
  };
  return { components: data.components ?? {}, actions: data.actions ?? {} };
}

/**
 * Read a json-render catalog into what the model is offered: component tools, spec-composable components,
 * actions and the spec tool. Renderer-free, so the same definition serves a browser chat, a server or a bot.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUIDefinition<C extends Catalog = Catalog>(
  options: CreateGenUIDefinitionOptions<C>,
): GenUIDefinition<C> {
  const { catalog } = options;
  const catalogData = readCatalog(catalog);
  const toolOptions = (options.componentTools ?? {}) as Record<string, true | GenUIComponentToolConfig | undefined>;
  const reserved = new Set(options.reservedToolNames);

  for (const name of Object.keys(toolOptions)) {
    if (!catalogData.components[name]) throw new Error(`GenUI component tool "${name}" is not in the catalog`);
  }

  const components: Record<string, GenUIComponentEntry> = {};
  const componentTools: Record<string, string> = {};
  for (const [name, definition] of Object.entries(catalogData.components)) {
    if (!COMPONENT_NAME.test(name)) throw new Error(`Invalid GenUI component name "${name}"`);
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
      if (componentTools[toolName] || reserved.has(toolName)) {
        throw new Error(`GenUI tool name "${toolName}" is used twice`);
      }
      componentTools[toolName] = name;
      entry.tool = { name: toolName, mode: tool.mode ?? 'display' };
      const description = tool.description ?? definition.description;
      if (description) entry.tool.description = description;
      if (tool.responseSchema) entry.tool.responseSchema = tool.responseSchema;
    }
    components[name] = entry;
  }

  const actions: Record<string, GenUIActionEntry> = {};
  for (const [name, definition] of Object.entries(catalogData.actions)) {
    actions[name] = { name, ...definition };
  }

  let specTool: GenUISpecToolConfig | undefined;
  if (options.specTool) {
    if (!Object.values(components).some(entry => entry.declarative)) {
      throw new Error('The GenUI spec tool needs at least one catalog component specs may use');
    }
    const config = options.specTool === true ? {} : options.specTool;
    const name = config.name ?? 'ui_spec';
    if (!TOOL_NAME.test(name)) throw new Error(`Invalid GenUI tool name "${name}"`);
    if (componentTools[name] || reserved.has(name)) throw new Error(`GenUI tool name "${name}" is used twice`);
    let edit: GenUISpecToolConfig['edit'];
    if (config.edit !== false) {
      const editConfig = config.edit === true || !config.edit ? {} : config.edit;
      const editName = editConfig.name ?? 'ui_spec_edit';
      if (!TOOL_NAME.test(editName)) throw new Error(`Invalid GenUI tool name "${editName}"`);
      if (editName === name || componentTools[editName] || reserved.has(editName)) {
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

  return Object.freeze({
    ...(catalog ? { catalog } : {}),
    components: Object.freeze(components),
    actions: Object.freeze(actions),
    componentTools: Object.freeze(componentTools),
    ...(specTool ? { specTool } : {}),
    functions: Object.freeze({ ...options.functions }),
    validationFunctions: Object.freeze({ ...options.validationFunctions }),
    directives: [...(options.directives ?? [])],
  });
}
