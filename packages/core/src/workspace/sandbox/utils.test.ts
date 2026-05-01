import { describe, it, expect } from 'vitest';
import { shellQuote, splitShellCommand, reassembleShellCommand } from './utils';

describe('shellQuote', () => {
  it('should pass through safe characters unchanged', () => {
    expect(shellQuote('hello')).toBe('hello');
    expect(shellQuote('file.txt')).toBe('file.txt');
    expect(shellQuote('/path/to/file')).toBe('/path/to/file');
    expect(shellQuote('key=value')).toBe('key=value');
    expect(shellQuote('user@host')).toBe('user@host');
  });

  it('should quote strings with spaces', () => {
    expect(shellQuote('hello world')).toBe("'hello world'");
  });

  it('should escape single quotes in strings', () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    expect(shellQuote("don't stop")).toBe("'don'\\''t stop'");
  });

  it('should quote strings with special characters', () => {
    expect(shellQuote('$HOME')).toBe("'$HOME'");
    expect(shellQuote('a && b')).toBe("'a && b'");
    expect(shellQuote('cmd | grep')).toBe("'cmd | grep'");
  });
});

describe('splitShellCommand', () => {
  it('should return single command with no operators', () => {
    const result = splitShellCommand('echo hello');
    expect(result.parts).toEqual(['echo hello']);
    expect(result.operators).toEqual([]);
  });

  it('should split on && operator', () => {
    const result = splitShellCommand('echo hello && echo world');
    expect(result.parts).toEqual(['echo hello', 'echo world']);
    expect(result.operators).toEqual(['&&']);
  });

  it('should split on || operator', () => {
    const result = splitShellCommand('cmd1 || cmd2');
    expect(result.parts).toEqual(['cmd1', 'cmd2']);
    expect(result.operators).toEqual(['||']);
  });

  it('should split on ; operator', () => {
    const result = splitShellCommand('cmd1; cmd2');
    expect(result.parts).toEqual(['cmd1', 'cmd2']);
    expect(result.operators).toEqual([';']);
  });

  it('should split on multiple operators', () => {
    const result = splitShellCommand('cmd1 && cmd2 || cmd3; cmd4');
    expect(result.parts).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4']);
    expect(result.operators).toEqual(['&&', '||', ';']);
  });

  it('should NOT split inside double quotes', () => {
    const result = splitShellCommand('echo "hello && world" && ls');
    expect(result.parts).toEqual(['echo "hello && world"', 'ls']);
    expect(result.operators).toEqual(['&&']);
  });

  it('should NOT split inside single quotes', () => {
    const result = splitShellCommand("bash -c 'cd /tmp && pwd' || echo fail");
    expect(result.parts).toEqual(["bash -c 'cd /tmp && pwd'", 'echo fail']);
    expect(result.operators).toEqual(['||']);
  });

  it('should handle nested quotes correctly', () => {
    const result = splitShellCommand(`echo "it's a 'test'" && ls`);
    expect(result.parts).toEqual([`echo "it's a 'test'"`, 'ls']);
    expect(result.operators).toEqual(['&&']);
  });

  it('should handle escaped quotes', () => {
    const result = splitShellCommand('echo "hello \\"world\\"" && ls');
    expect(result.parts).toEqual(['echo "hello \\"world\\""', 'ls']);
    expect(result.operators).toEqual(['&&']);
  });

  it('should handle browser CLI commands with quoted URLs', () => {
    const result = splitShellCommand(
      `agent-browser connect "wss://cdp.example.com" && agent-browser open "https://google.com"`,
    );
    expect(result.parts).toEqual([
      'agent-browser connect "wss://cdp.example.com"',
      'agent-browser open "https://google.com"',
    ]);
    expect(result.operators).toEqual(['&&']);
  });

  it('should handle empty command', () => {
    const result = splitShellCommand('');
    expect(result.parts).toEqual([]);
    expect(result.operators).toEqual([]);
  });
});

describe('reassembleShellCommand', () => {
  it('should reassemble with single operator', () => {
    expect(reassembleShellCommand(['echo hello', 'echo world'], ['&&'])).toBe('echo hello && echo world');
  });

  it('should reassemble with multiple operators', () => {
    expect(reassembleShellCommand(['cmd1', 'cmd2', 'cmd3'], ['&&', '||'])).toBe('cmd1 && cmd2 || cmd3');
  });

  it('should handle single part with no operators', () => {
    expect(reassembleShellCommand(['echo hello'], [])).toBe('echo hello');
  });

  it('should roundtrip split and reassemble (preserving semantic equivalence)', () => {
    const original = 'cmd1 && cmd2 || cmd3; cmd4';
    const { parts, operators } = splitShellCommand(original);
    const reassembled = reassembleShellCommand(parts, operators);
    // Reassembly normalizes spacing around operators
    expect(parts).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4']);
    expect(operators).toEqual(['&&', '||', ';']);
    expect(reassembled).toBe('cmd1 && cmd2 || cmd3 ; cmd4');
  });
});
