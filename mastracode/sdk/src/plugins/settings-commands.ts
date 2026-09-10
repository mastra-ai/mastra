import { z } from 'zod';

import type { MastraCodePluginSession } from '../plugin.js';

export type PluginSettingsValues = Record<string, string | boolean>;
export type PluginSettingsField = { label: string; description?: string } & (
  | { type: 'boolean' }
  | { type: 'string' }
  | { type: 'select'; options: { label: string; value: string }[] }
);
export type PluginInteractiveBinding = {
  readonly session: MastraCodePluginSession;
  readonly sessionId: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly signal: AbortSignal;
};
export type PluginSettingsContext = PluginInteractiveBinding;
export type PluginSettingsSnapshot = {
  values: PluginSettingsValues;
  status?: { label: string; value: string }[];
};
export type PluginSettingsCommand = {
  label: string;
  description?: string;
  fields: Record<string, PluginSettingsField>;
  schema: z.ZodType<PluginSettingsValues>;
  resolve: (context: PluginSettingsContext) => PluginSettingsSnapshot | Promise<PluginSettingsSnapshot>;
  save: (values: PluginSettingsValues, context: PluginSettingsContext) => Promise<void>;
};
export type PluginSettingsCommands = Record<string, PluginSettingsCommand>;
export type PluginSettingsResult<T> = { success: true; value: T } | { success: false; error: string };
export type LoadedPluginSettingsCommand = {
  pluginId: string;
  name: string;
  command: PluginSettingsCommand;
  signal: AbortSignal;
};

const fieldSchema = z.intersection(
  z.object({ label: z.string().min(1), description: z.string().optional() }),
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('boolean') }),
    z.object({ type: z.literal('string') }),
    z.object({
      type: z.literal('select'),
      options: z
        .array(z.object({ label: z.string().min(1), value: z.string() }))
        .min(1)
        .refine(
          options => new Set(options.map(option => option.value)).size === options.length,
          'Duplicate select values',
        ),
    }),
  ]),
);
const definitionSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  fields: z.record(z.string().min(1), fieldSchema),
  schema: z.custom<z.ZodType<PluginSettingsValues>>(value => value instanceof z.ZodType),
  resolve: z.custom<PluginSettingsCommand['resolve']>(value => typeof value === 'function'),
  save: z.custom<PluginSettingsCommand['save']>(value => typeof value === 'function'),
});

export function validateSettingsCommands(value: unknown): PluginSettingsCommands {
  return z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), definitionSchema).parse(value);
}

function valuesSchema(command: PluginSettingsCommand) {
  const shape = Object.fromEntries(
    Object.entries(command.fields).map(([key, field]) => [
      key,
      field.type === 'boolean'
        ? z.boolean()
        : field.type === 'string'
          ? z.string()
          : z.string().refine(value => field.options.some(option => option.value === value), 'Unknown select value'),
    ]),
  );
  // Validate both sides of the plugin schema: defaults, stripping, or transforms
  // cannot turn an incomplete submission into a complete settings record.
  const fields = z.object(shape).strict();
  return {
    async parseAsync(value: unknown) {
      const complete = fields.parse(value);
      return fields.parse(await command.schema.parseAsync(complete));
    },
  };
}

export function collectSettingsCommands(
  contributions: LoadedPluginSettingsCommand[],
  reservedNames: Iterable<string>,
): { commands: LoadedPluginSettingsCommand[]; diagnostics: string[] } {
  const reserved = new Set(reservedNames);
  const counts = new Map<string, number>();
  for (const entry of contributions) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  const diagnostics: string[] = [];
  const commands = contributions.filter(entry => {
    if (entry.signal.aborted) return false;
    if (reserved.has(entry.name) || counts.get(entry.name)! > 1) {
      diagnostics.push(
        `Plugin "${entry.pluginId}" settings command /${entry.name} conflicts with another command; rename it.`,
      );
      return false;
    }
    return true;
  });
  return { commands, diagnostics };
}

export function openSettingsCommand(entry: LoadedPluginSettingsCommand, binding: PluginInteractiveBinding) {
  const signal = AbortSignal.any([entry.signal, binding.signal]);
  const context: PluginSettingsContext = { ...binding, signal };
  const check = () => signal.throwIfAborted();
  const run = async <T>(action: () => Promise<T>): Promise<PluginSettingsResult<T>> => {
    try {
      check();
      const value = await action();
      check();
      return { success: true, value };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
  return {
    context,
    resolve: () =>
      run(async () => {
        const snapshot = await entry.command.resolve(context);
        check();
        const values = await valuesSchema(entry.command).parseAsync(snapshot.values);
        const status = z
          .array(z.object({ label: z.string(), value: z.string() }))
          .optional()
          .parse(snapshot.status);
        return { values, status };
      }),
    save: (values: unknown) =>
      run(async () => {
        const parsed = await valuesSchema(entry.command).parseAsync(values);
        check();
        await entry.command.save(parsed, context);
      }),
  };
}
