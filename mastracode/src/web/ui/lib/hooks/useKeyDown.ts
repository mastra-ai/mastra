import { useEffect, useEffectEvent } from 'react';

type KeyDownCallback = (event: KeyboardEvent) => void;
export type KeyDownBindings = Record<string, KeyDownCallback>;

interface ParsedKeySpec {
  alt: boolean;
  ctrl: boolean;
  key: string;
  meta: boolean;
  mod: boolean;
  shift: boolean;
}

export interface UseKeyDownOptions {
  target?: 'window' | 'document';
  capture?: boolean;
  enabled?: boolean;
}

const modifiers = new Set(['alt', 'ctrl', 'meta', 'mod', 'shift']);

function parseKeySpec(spec: string): ParsedKeySpec {
  const parts = spec
    .toLowerCase()
    .split('+')
    .map(part => part.trim())
    .filter(Boolean);
  const key = [...parts].reverse().find(part => !modifiers.has(part)) ?? '';

  return {
    alt: parts.includes('alt'),
    ctrl: parts.includes('ctrl'),
    key,
    meta: parts.includes('meta'),
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
  };
}

export function matchesKeySpec(spec: string, event: KeyboardEvent): boolean {
  const binding = parseKeySpec(spec);
  const key = event.key.toLowerCase();

  if (!binding.key || key !== binding.key) return false;

  if (binding.mod) {
    if (!(event.ctrlKey || event.metaKey)) return false;
  } else {
    if (event.ctrlKey !== binding.ctrl) return false;
    if (event.metaKey !== binding.meta) return false;
  }

  if (event.altKey !== binding.alt) return false;

  const shouldMatchShift = binding.shift || event.key.length > 1 || /^[a-z0-9]$/.test(binding.key);
  if (shouldMatchShift && event.shiftKey !== binding.shift) return false;

  return true;
}

export function useKeyDown(bindings: KeyDownBindings, options: UseKeyDownOptions = {}) {
  const { capture = false, enabled = true, target = 'window' } = options;

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    for (const [spec, callback] of Object.entries(bindings)) {
      if (!matchesKeySpec(spec, event)) continue;
      callback(event);
      return;
    }
  });

  useEffect(() => {
    if (!enabled) return;

    const node = target === 'document' ? document : window;
    const listener = (event: Event) => handleKeyDown(event as KeyboardEvent);

    node.addEventListener('keydown', listener, capture);
    return () => node.removeEventListener('keydown', listener, capture);
  }, [capture, enabled, target]);
}
