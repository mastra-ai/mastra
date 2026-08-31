import { describe, it, expect } from 'vitest';
import { buildBwrapCommand } from './bubblewrap';

/**
 * Find the value that follows a flag in the arg list.
 */
function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

describe('buildBwrapCommand', () => {
  it('should mount a minimal /dev so tools that open /dev/null work', () => {
    const { args } = buildBwrapCommand('git status', '/workspace', {});

    expect(valueAfter(args, '--dev')).toBe('/dev');
  });

  it('should mount /dev before the binds so a path under /dev is not shadowed', () => {
    const { args } = buildBwrapCommand('ls', '/workspace', {
      readOnlyPaths: ['/dev/dri'],
    });

    // bwrap applies operations in order, so a --dev emitted after this bind would
    // replace it with the fresh tmpfs.
    const devIndex = args.indexOf('--dev');
    expect(devIndex).toBeGreaterThanOrEqual(0);
    expect(devIndex).toBeLessThan(args.indexOf('/dev/dri'));
  });

  it('should mount /proc and a tmpfs at /tmp', () => {
    const { args } = buildBwrapCommand('ls', '/workspace', {});

    expect(valueAfter(args, '--proc')).toBe('/proc');
    expect(valueAfter(args, '--tmpfs')).toBe('/tmp');
  });

  it('should not inject defaults when custom bwrapArgs are provided', () => {
    const { command, args } = buildBwrapCommand('ls', '/workspace', {
      bwrapArgs: ['--ro-bind', '/usr', '/usr'],
    });

    expect(command).toBe('bwrap');
    expect(args).toEqual(['--ro-bind', '/usr', '/usr', '--', 'sh', '-c', 'ls']);
  });
});
