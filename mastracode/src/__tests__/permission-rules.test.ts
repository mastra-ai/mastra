import { describe, expect, it } from 'vitest';
import {
  arePermissionRulesEqual,
  hasPermissionRules,
  mergePermissionRules,
  normalizePermissionRules,
} from '../utils/permission-rules.js';

describe('permission-rules utils', () => {
  it('normalizes unknown input into an empty rules object', () => {
    expect(normalizePermissionRules(undefined)).toEqual({ categories: {}, tools: {} });
    expect(normalizePermissionRules('invalid')).toEqual({ categories: {}, tools: {} });
  });

  it('drops invalid policy entries during normalization', () => {
    const normalized = normalizePermissionRules({
      categories: {
        read: 'allow',
        edit: 'deny',
        execute: 'invalid',
      },
      tools: {
        request_sandbox_access: 'deny',
        view: 'wrong',
      },
    });

    expect(normalized).toEqual({
      categories: { read: 'allow', edit: 'deny' },
      tools: { request_sandbox_access: 'deny' },
    });
  });

  it('merges category and tool overrides', () => {
    const merged = mergePermissionRules(
      {
        categories: { read: 'allow', edit: 'ask' },
        tools: { view: 'allow' },
      },
      {
        categories: { edit: 'deny', execute: 'allow' },
        tools: { view: 'deny', write_file: 'deny' },
      },
    );

    expect(merged).toEqual({
      categories: { read: 'allow', edit: 'deny', execute: 'allow' },
      tools: { view: 'deny', write_file: 'deny' },
    });
  });

  it('detects equality and non-empty rules', () => {
    const a = {
      categories: { edit: 'ask' as const },
      tools: { write_file: 'deny' as const },
    };
    const b = {
      categories: { edit: 'ask' as const },
      tools: { write_file: 'deny' as const },
    };
    const c = {
      categories: { edit: 'deny' as const },
      tools: { write_file: 'deny' as const },
    };

    expect(arePermissionRulesEqual(a, b)).toBe(true);
    expect(arePermissionRulesEqual(a, c)).toBe(false);
    expect(hasPermissionRules({ categories: {}, tools: {} })).toBe(false);
    expect(hasPermissionRules(a)).toBe(true);
  });
});
