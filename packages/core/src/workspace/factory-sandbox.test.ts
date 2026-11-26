import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  FactorySandbox,
  FACTORY_SANDBOX_BRAND,
  describeFactorySandbox,
  isFactorySandbox,
  normalizeFactorySandboxSettings,
} from './factory-sandbox';
import type { FactorySandboxBuilds, FactorySandboxContext } from './factory-sandbox';
import { LocalSandbox } from './sandbox/local-sandbox';
import type { MastraSandbox } from './sandbox/mastra-sandbox';

const settingsSchema = z.object({
  cpuCount: z.number().int().min(1).max(8).optional(),
  memoryMb: z.number().int().min(512).optional(),
});
type Settings = z.infer<typeof settingsSchema>;

class TestSandbox extends FactorySandbox<Settings> {
  readonly provider = 'test';
  readonly settings = settingsSchema;
  create(ctx: FactorySandboxContext): MastraSandbox {
    return new LocalSandbox({ id: ctx.sessionId });
  }
}

const ctx: FactorySandboxContext = { sessionId: 's1', getRepositoryAccess: undefined };

describe('isFactorySandbox', () => {
  it('rejects a plain object that merely has create', () => {
    expect(isFactorySandbox({ create: () => undefined })).toBe(false);
    expect(isFactorySandbox(null)).toBe(false);
    expect(isFactorySandbox(() => undefined)).toBe(false);
  });

  it('accepts a FactorySandbox subclass', () => {
    expect(isFactorySandbox(new TestSandbox())).toBe(true);
  });

  it('accepts any object carrying the Symbol.for brand', () => {
    const branded = { [Symbol.for('mastra.factory.sandbox')]: true, create: () => undefined };
    expect(isFactorySandbox(branded)).toBe(true);
    expect(isFactorySandbox({ [FACTORY_SANDBOX_BRAND]: false })).toBe(false);
  });
});

describe('describeFactorySandbox', () => {
  it('emits JSON Schema for a zod settings schema and no capabilities without template or builds', () => {
    const description = describeFactorySandbox(new TestSandbox());
    expect(description.provider).toBe('test');
    const cpu = description.settingsSchema.properties?.cpuCount as JSONSchema7;
    expect(cpu.type).toBe('integer');
    expect(cpu.minimum).toBe(1);
    expect(cpu.maximum).toBe(8);
    expect(description.capabilities).toEqual({ template: false, builds: { available: false, history: false } });
  });

  it('emits the input side of the schema, so a defaulted field stays optional', () => {
    class Defaulted extends FactorySandbox<{ region?: string }> {
      readonly provider = 'defaulted';
      readonly settings = z.object({ region: z.enum(['us', 'eu']).default('us') });
      create = () => new LocalSandbox();
    }
    const description = describeFactorySandbox(new Defaulted());
    expect(description.settingsSchema.required ?? []).not.toContain('region');
    expect((description.settingsSchema.properties?.region as JSONSchema7).default).toBe('us');
  });

  it('passes a plain JSON Schema settings schema through', () => {
    const jsonSchema: JSONSchema7 = {
      type: 'object',
      properties: { baseImage: { type: 'string', title: 'Base image' } },
    };
    const sandbox: FactorySandbox = {
      [FACTORY_SANDBOX_BRAND]: true,
      provider: 'json',
      settings: jsonSchema,
      create: c => new LocalSandbox({ id: c.sessionId }),
    };
    const description = describeFactorySandbox(sandbox);
    expect(description.settingsSchema.properties?.baseImage).toMatchObject({ type: 'string', title: 'Base image' });
  });

  it('reports template and builds capabilities from method presence', () => {
    const builds: FactorySandboxBuilds<Settings> = {
      start: async () => ({ buildId: 'b1', status: 'pending' }),
      get: async () => ({ buildId: 'b1', status: 'ready' }),
    };
    class WithBuilds extends TestSandbox {
      readonly builds = builds;
      template() {
        return {};
      }
    }
    expect(describeFactorySandbox(new WithBuilds()).capabilities).toEqual({
      template: true,
      builds: { available: true, history: false },
    });

    class WithHistory extends WithBuilds {
      readonly builds = { ...builds, list: async () => [] };
    }
    expect(describeFactorySandbox(new WithHistory()).capabilities.builds.history).toBe(true);
  });
});

describe('normalizeFactorySandboxSettings', () => {
  it('validates through the standard schema', async () => {
    const std = normalizeFactorySandboxSettings(new TestSandbox());
    const bad = await std['~standard'].validate({ cpuCount: 'x' });
    expect('issues' in bad && bad.issues?.length).toBeTruthy();
    const good = await std['~standard'].validate({ cpuCount: 2 });
    expect('value' in good && good.value).toEqual({ cpuCount: 2 });
  });

  it('builds a sandbox synchronously with the session id', () => {
    const sandbox = new TestSandbox().create(ctx, {});
    expect(sandbox.id).toBe('s1');
  });
});
