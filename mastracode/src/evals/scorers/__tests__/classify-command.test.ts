import { describe, it, expect } from 'vitest';
import { isBuildCommand, isTestCommand, getExitCode, isSuccessResult, matchFilePath } from '../classify-command';

describe('classify-command', () => {
  describe('isBuildCommand', () => {
    it('recognises basic build commands', () => {
      expect(isBuildCommand('pnpm build')).toBe(true);
      expect(isBuildCommand('npm run build')).toBe(true);
      expect(isBuildCommand('tsc --noEmit')).toBe(true);
      expect(isBuildCommand('pnpm typecheck')).toBe(true);
    });

    it('rejects test commands', () => {
      expect(isBuildCommand('pnpm test')).toBe(false);
      expect(isBuildCommand('vitest run')).toBe(false);
      expect(isBuildCommand('jest')).toBe(false);
    });

    it('handles compound commands correctly', () => {
      expect(isBuildCommand('pnpm build && pnpm test')).toBe(true); // build segment is build
      expect(isBuildCommand('pnpm test && pnpm lint')).toBe(false); // no build segment
    });

    it('does not false-positive on test runner as primary verb', () => {
      expect(isBuildCommand('pnpm test --build')).toBe(false);
    });
  });

  describe('isTestCommand', () => {
    it('recognises test commands', () => {
      expect(isTestCommand('pnpm test')).toBe(true);
      expect(isTestCommand('vitest run')).toBe(true);
      expect(isTestCommand('jest --coverage')).toBe(true);
      expect(isTestCommand('pytest')).toBe(true);
      expect(isTestCommand('pnpm run spec')).toBe(true);
    });

    it('rejects non-test commands', () => {
      expect(isTestCommand('pnpm build')).toBe(false);
      expect(isTestCommand('tsc --noEmit')).toBe(false);
    });
  });

  describe('getExitCode', () => {
    it('extracts from object with exitCode', () => {
      expect(getExitCode({ exitCode: 0 })).toBe(0);
      expect(getExitCode({ exitCode: 1 })).toBe(1);
    });

    it('extracts from object with code', () => {
      expect(getExitCode({ code: 0 })).toBe(0);
    });

    it('extracts from string', () => {
      expect(getExitCode('exited with code 0')).toBe(0);
      expect(getExitCode('exit code 1')).toBe(1);
    });

    it('returns null for missing/unknown', () => {
      expect(getExitCode(null)).toBe(null);
      expect(getExitCode(undefined)).toBe(null);
      expect(getExitCode('some random string')).toBe(null);
      expect(getExitCode({})).toBe(null);
    });
  });

  describe('isSuccessResult', () => {
    it('returns false if error is truthy', () => {
      expect(isSuccessResult({ exitCode: 0 }, 'something went wrong')).toBe(false);
    });

    it('returns true for exitCode 0', () => {
      expect(isSuccessResult({ exitCode: 0 })).toBe(true);
    });

    it('returns false for exitCode 1', () => {
      expect(isSuccessResult({ exitCode: 1 })).toBe(false);
    });

    it('returns false for null result', () => {
      expect(isSuccessResult(null)).toBe(false);
    });
  });

  describe('matchFilePath', () => {
    it('exact match', () => {
      expect(matchFilePath('src/foo.ts', 'src/foo.ts')).toBe(true);
    });

    it('suffix match', () => {
      expect(matchFilePath('/abs/path/src/foo.ts', 'src/foo.ts')).toBe(true);
    });

    it('reverse suffix match', () => {
      expect(matchFilePath('src/foo.ts', '/abs/path/src/foo.ts')).toBe(true);
    });

    it('no match', () => {
      expect(matchFilePath('src/foo.ts', 'src/bar.ts')).toBe(false);
    });
  });
});
