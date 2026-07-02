import { createHash } from 'node:crypto';
import type { IMastraLogger } from '@internal/core/logger';
import { describe, it, expect, vi } from 'vitest';

import { isTenancyScoped, logTenancyDeleteNoOp, logTenancyReadMiss } from './tenancy';

function makeLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: vi.fn(),
    getLogs: vi.fn(),
    getLogsByRunId: vi.fn(),
  } as unknown as IMastraLogger;
}

function token(id: string, org: string | undefined, project: string | undefined): string {
  return createHash('sha256')
    .update(`${id}:${org ?? ''}:${project ?? ''}`)
    .digest('hex')
    .slice(0, 8);
}

describe('tenancy helpers', () => {
  describe('isTenancyScoped', () => {
    it('returns false when filters is undefined', () => {
      expect(isTenancyScoped(undefined)).toBe(false);
    });

    it('returns false when filters is empty', () => {
      expect(isTenancyScoped({})).toBe(false);
    });

    it('returns true when only organizationId is set', () => {
      expect(isTenancyScoped({ organizationId: 'org-1' })).toBe(true);
    });

    it('returns true when only projectId is set', () => {
      expect(isTenancyScoped({ projectId: 'proj-1' })).toBe(true);
    });

    it('returns true when both are set', () => {
      expect(isTenancyScoped({ organizationId: 'org-1', projectId: 'proj-1' })).toBe(true);
    });
  });

  describe('logTenancyReadMiss', () => {
    it('emits a debug log with op, table, and hashed token — no raw id or tenancy', () => {
      const logger = makeLogger();
      logTenancyReadMiss(logger, 'getExperimentById', 'mastra_experiments', {
        id: 'exp-secret',
        organizationId: 'org-1',
        projectId: 'proj-1',
      });

      expect(logger.debug).toHaveBeenCalledTimes(1);
      const [msg, meta] = (logger.debug as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(msg).toBe('tenancy: scoped read miss');
      expect(meta).toEqual({
        op: 'getExperimentById',
        table: 'mastra_experiments',
        token: token('exp-secret', 'org-1', 'proj-1'),
      });
      // PII: raw id + tenancy must never appear in the log payload.
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain('exp-secret');
      expect(serialized).not.toContain('org-1');
      expect(serialized).not.toContain('proj-1');
    });

    it('produces the same token for the same (id, org, project) tuple', () => {
      const logger = makeLogger();
      logTenancyReadMiss(logger, 'op', 't', { id: 'x', organizationId: 'a', projectId: 'b' });
      logTenancyReadMiss(logger, 'op', 't', { id: 'x', organizationId: 'a', projectId: 'b' });
      const calls = (logger.debug as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![1].token).toBe(calls[1]![1].token);
    });

    it('produces different tokens across tenants for the same id', () => {
      const logger = makeLogger();
      logTenancyReadMiss(logger, 'op', 't', { id: 'x', organizationId: 'a', projectId: 'b' });
      logTenancyReadMiss(logger, 'op', 't', { id: 'x', organizationId: 'a', projectId: 'c' });
      const calls = (logger.debug as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![1].token).not.toBe(calls[1]![1].token);
    });
  });

  describe('logTenancyDeleteNoOp', () => {
    it('emits a debug log with op, table, and hashed token — no raw id or tenancy', () => {
      const logger = makeLogger();
      logTenancyDeleteNoOp(logger, 'deleteExperiment', 'mastra_experiments', {
        id: 'exp-secret',
        organizationId: 'org-1',
        projectId: 'proj-1',
      });

      expect(logger.debug).toHaveBeenCalledTimes(1);
      const [msg, meta] = (logger.debug as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(msg).toBe('tenancy: scoped delete no-op');
      expect(meta).toEqual({
        op: 'deleteExperiment',
        table: 'mastra_experiments',
        token: token('exp-secret', 'org-1', 'proj-1'),
      });
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain('exp-secret');
      expect(serialized).not.toContain('org-1');
      expect(serialized).not.toContain('proj-1');
    });

    it('handles partial tenancy (only organizationId set)', () => {
      const logger = makeLogger();
      logTenancyDeleteNoOp(logger, 'deleteExperiment', 'mastra_experiments', {
        id: 'exp-1',
        organizationId: 'org-1',
      });
      const [, meta] = (logger.debug as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(meta.token).toBe(token('exp-1', 'org-1', undefined));
    });
  });
});
