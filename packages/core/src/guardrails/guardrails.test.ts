import { describe, expect, it, vi } from 'vitest';
import type { Processor } from '../processors';
import { BatchPartsProcessor } from '../processors/processors';
import { compileGuardrails, GUARDRAIL_SENSITIVITY_THRESHOLDS, resolveGuardrailSensitivityThreshold } from './compile';
import { defineGuardrailPolicy, evaluateGuardrailPolicy } from './index';

const model = {} as any;
const groupModel = { id: 'group-model' } as any;
const checkModel = { id: 'check-model' } as any;

const ids = (processors: Array<{ id?: string }>) => processors.map(processor => String(processor.id));

describe('guardrails', () => {
  describe('compileGuardrails', () => {
    it('compiles applyTo input checks only into input processors', () => {
      const compiled = compileGuardrails({
        model,
        content: {
          moderation: { applyTo: 'input' },
        },
      });

      expect(ids(compiled.inputProcessors)).toEqual([
        'unicode-normalizer',
        'guardrail:policy:content:moderation:input:0',
      ]);
      expect(compiled.outputProcessors).toEqual([]);
    });

    it('adds semantic output batching before LLM-backed output checks', () => {
      const compiled = compileGuardrails({
        model,
        content: true,
      });

      expect(compiled.outputProcessors[0]).toBeInstanceOf(BatchPartsProcessor);
      expect((compiled.outputProcessors[0] as any).options).toMatchObject({
        checkEvery: 'sentence',
        lookback: 'medium',
      });
      expect(ids(compiled.outputProcessors)).toEqual(['batch-parts', 'guardrail:policy:content:moderation:output:1']);
    });

    it('passes policy-level streaming options to output batching', () => {
      const compiled = compileGuardrails({
        model,
        streaming: { checkEvery: 'section', lookback: 'long' },
        content: true,
      });

      expect(compiled.outputProcessors[0]).toBeInstanceOf(BatchPartsProcessor);
      expect((compiled.outputProcessors[0] as any).options).toMatchObject({ checkEvery: 'section', lookback: 'long' });
    });

    it('keeps output batching before parallel LLM-backed output checks', () => {
      const compiled = compileGuardrails({
        model,
        security: { systemPromptLeak: true },
        content: true,
      });

      expect(compiled.outputProcessors[0]).toBeInstanceOf(BatchPartsProcessor);
      expect(ids(compiled.outputProcessors)).toEqual(['batch-parts', 'guardrail-parallel-output-policy']);
      expect((compiled.outputProcessors[1] as any).type).toBe('processor');
    });

    it('compiles independent block-only input checks into a parallel processor workflow', () => {
      const compiled = compileGuardrails({
        model,
        security: { promptInjection: true },
        content: { moderation: { applyTo: 'input' } },
      });

      expect(ids(compiled.inputProcessors)).toEqual(['unicode-normalizer', 'guardrail-parallel-input-policy']);
      expect((compiled.inputProcessors[1] as any).type).toBe('processor');
    });

    it('keeps transforming checks sequential instead of parallelizing them', () => {
      const compiled = compileGuardrails({
        model,
        privacy: {
          pii: { action: 'redact', applyTo: 'input' },
          secrets: { action: 'block', applyTo: 'input' },
        },
      });

      expect(ids(compiled.inputProcessors)).toEqual([
        'unicode-normalizer',
        'guardrail:policy:privacy:pii:input:0',
        'guardrail:policy:privacy:secrets:input:1',
      ]);
    });

    it('compiles deterministic secret checks without requiring a model', () => {
      const compiled = compileGuardrails({
        privacy: {
          secrets: { action: 'block', applyTo: 'input' },
        },
      });

      expect(ids(compiled.inputProcessors)).toEqual(['guardrail:policy:privacy:secrets:input:0']);
      expect(compiled.outputProcessors).toEqual([]);
    });

    it('wraps token limit checks as processInputStep processors', () => {
      const compiled = compileGuardrails({
        privacy: { secrets: { action: 'block', applyTo: 'input' } },
        cost: { tokenLimit: 50 },
      });

      expect(ids(compiled.inputProcessors)).toEqual(['guardrail-parallel-input-policy']);
      expect(() =>
        compileGuardrails({ privacy: { secrets: { action: 'block', applyTo: 'input' } }, cost: { tokenLimit: 50 } }),
      ).not.toThrow();
    });

    it('does not compile a disabled token limit', () => {
      const compiled = compileGuardrails({
        cost: { tokenLimit: { enabled: false, limit: 50 } },
      });

      expect(compiled.inputProcessors).toEqual([]);
      expect(compiled.outputProcessors).toEqual([]);
    });

    it('uses the cost group violation handler for token limits', async () => {
      const onViolation = vi.fn();
      const compiled = compileGuardrails({
        cost: { tokenLimit: 50, onViolation },
      });

      await (compiled.inputProcessors[0] as Processor).onViolation?.({
        processorId: 'token-limiter',
        message: 'Token limit exceeded',
        detail: undefined,
      });

      expect(onViolation).toHaveBeenCalledWith(
        expect.objectContaining({ group: 'cost', check: 'tokenLimit', action: 'block' }),
      );
    });

    it('throws when cost is enabled without an explicit budget', () => {
      expect(() => compileGuardrails({ cost: true } as any)).toThrow(/cost requires maxCost or tokenLimit/);
      expect(() => compileGuardrails({ cost: {} })).toThrow(/cost requires maxCost or tokenLimit/);
    });

    it('throws for unsupported actions instead of silently falling back', () => {
      expect(() =>
        compileGuardrails({
          model,
          content: { moderation: { action: 'redact' as any } },
        }),
      ).toThrow(/content\.moderation does not support action "redact"/);
    });

    it('throws when applyTo is an empty array', () => {
      expect(() =>
        compileGuardrails({
          model,
          content: { moderation: { applyTo: [] } },
        }),
      ).toThrow(/applyTo must include at least one phase/);
    });

    it('uses policy, group, and check models for LLM-backed checks', () => {
      expect(() => compileGuardrails({ content: { moderation: { applyTo: 'input' } } })).toThrow(/requires a model/);
      expect(() => compileGuardrails({ model, content: { moderation: { applyTo: 'input' } } })).not.toThrow();
      expect(() => compileGuardrails({ privacy: { model: groupModel, pii: { applyTo: 'input' } } })).not.toThrow();
      expect(() => compileGuardrails({ privacy: { pii: { model: checkModel, applyTo: 'input' } } })).not.toThrow();
    });

    it('exports researched sensitivity threshold mappings for supported checks', () => {
      expect(GUARDRAIL_SENSITIVITY_THRESHOLDS).toEqual({
        promptInjection: { low: 0.85, medium: 0.7, high: 0.5 },
        moderation: { low: 0.75, medium: 0.5, high: 0.35 },
        pii: { low: 0.8, medium: 0.6, high: 0.4 },
      });
    });

    it('resolves sensitivity using check, group, policy, then medium defaults', () => {
      expect(resolveGuardrailSensitivityThreshold('moderation', undefined, 'high')).toBe(0.35);
      expect(resolveGuardrailSensitivityThreshold('moderation', undefined, 'medium')).toBe(0.5);
      expect(resolveGuardrailSensitivityThreshold('moderation', undefined, undefined)).toBe(0.5);

      const policySensitivity = 'high' as const;
      const groupSensitivity = 'medium' as const;
      const checkSensitivity = 'low' as const;

      expect(resolveGuardrailSensitivityThreshold('pii', undefined, policySensitivity)).toBe(0.4);
      expect(resolveGuardrailSensitivityThreshold('pii', undefined, groupSensitivity ?? policySensitivity)).toBe(0.6);
      expect(
        resolveGuardrailSensitivityThreshold(
          'pii',
          undefined,
          checkSensitivity ?? groupSensitivity ?? policySensitivity,
        ),
      ).toBe(0.8);
    });

    it('lets threshold override sensitivity for advanced tuning', () => {
      expect(resolveGuardrailSensitivityThreshold('promptInjection', 0.91, 'high')).toBe(0.91);
    });

    it('does not compile checks marked enabled false', () => {
      const compiled = compileGuardrails({
        model,
        content: { moderation: { enabled: false } },
        privacy: { secrets: { enabled: false } },
      });

      expect(compiled.inputProcessors).toEqual([]);
      expect(compiled.outputProcessors).toEqual([]);
    });
  });

  describe('defineGuardrailPolicy', () => {
    it('returns reusable branded policies accepted by the compiler', () => {
      const policy = defineGuardrailPolicy({
        name: 'customer-data-policy',
        privacy: { secrets: { action: 'block', applyTo: 'input' } },
      });

      const compiled = compileGuardrails(policy);

      expect(ids(compiled.inputProcessors)).toEqual(['guardrail:customer-data-policy:privacy:secrets:input:0']);
    });
  });

  describe('evaluateGuardrailPolicy', () => {
    it('reports deterministic policy violations without running an agent', async () => {
      const onViolation = vi.fn();
      const report = await evaluateGuardrailPolicy(
        {
          name: 'secrets-policy',
          privacy: {
            secrets: { action: 'block', applyTo: 'input' },
          },
          onViolation,
        },
        {
          input: 'api_key = abcdefghijklmnopqrstuvwxyz',
        },
      );

      expect(report.matched).toBe(true);
      expect(report.blocked).toBe(true);
      expect(report.triggered).toBe(true);
      expect(report.violations).toEqual([
        expect.objectContaining({
          policyName: 'secrets-policy',
          group: 'privacy',
          phase: 'input',
          check: 'secrets',
          action: 'block',
          message: expect.stringContaining('Regex filter: blocked content matching patterns: api-key'),
        }),
      ]);
      expect(onViolation).toHaveBeenCalledWith(expect.objectContaining({ group: 'privacy', check: 'secrets' }));
    });

    it('returns matched transformed content without marking it blocked', async () => {
      const report = await evaluateGuardrailPolicy(
        {
          privacy: {
            secrets: { action: 'redact', applyTo: 'input' },
          },
        },
        {
          input: 'api_key = abcdefghijklmnopqrstuvwxyz',
        },
      );

      expect(report.matched).toBe(true);
      expect(report.blocked).toBe(false);
      expect(report.triggered).toBe(true);
      expect(report.transformed.input).toBe('[API_KEY]');
    });

    it('skips cost checks that need observability storage', async () => {
      const report = await evaluateGuardrailPolicy(
        {
          cost: { maxCost: 1, tokenLimit: 100 },
        },
        {
          input: 'hello',
        },
      );

      expect(report.skipped).toEqual([
        expect.objectContaining({
          group: 'cost',
          check: 'maxCost',
          reason: expect.stringContaining('observability storage'),
        }),
      ]);
    });

    it('requires sample input or output', async () => {
      await expect(evaluateGuardrailPolicy({ privacy: { secrets: true } })).rejects.toThrow(
        /requires input, output, or both/,
      );
    });

    it('lets per-check onViolation override policy-level callbacks', async () => {
      const policyHandler = vi.fn();
      const checkHandler = vi.fn();

      await evaluateGuardrailPolicy(
        {
          privacy: {
            secrets: { action: 'block', applyTo: 'input', onViolation: checkHandler },
          },
          onViolation: policyHandler,
        },
        {
          input: 'api_key = abcdefghijklmnopqrstuvwxyz',
        },
      );

      expect(checkHandler).toHaveBeenCalledWith(expect.objectContaining({ check: 'secrets' }));
      expect(policyHandler).not.toHaveBeenCalled();
    });
  });
});
