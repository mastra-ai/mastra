/**
 * Map of key bindings to handlers.
 *
 * - Combos: `'cmd+k'`, `'ctrl+shift+p'`, `'mod+Home'`.
 * - Timed sequences: `'g$+a'` — press `g`, then `a` within 500ms.
 *   Chain as many steps as needed (`'a$+b$+c'`); the last step has no `$`.
 *   A sequence prefix takes precedence over a plain combo on the same key, and an
 *   unexpected key resets the sequence before being evaluated normally.
 */
export type UseKeydownArgs = {
  [keySet: string]: () => void;
};

export type ParsedKeyCombo = {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
};

const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '');

export const parseKeyCombo = (combo: string): ParsedKeyCombo => {
  const parsed: ParsedKeyCombo = { meta: false, ctrl: false, shift: false, alt: false, key: '' };

  for (const token of combo.split('+')) {
    switch (token.toLowerCase()) {
      case 'cmd':
      case 'meta':
        parsed.meta = true;
        break;
      case 'ctrl':
      case 'control':
        parsed.ctrl = true;
        break;
      case 'shift':
        parsed.shift = true;
        break;
      case 'alt':
      case 'option':
        parsed.alt = true;
        break;
      case 'mod':
        if (isMacPlatform()) parsed.meta = true;
        else parsed.ctrl = true;
        break;
      default:
        parsed.key = token.toLowerCase();
    }
  }

  return parsed;
};

export type KeyStep = ParsedKeyCombo;

/** A binding is a sequence of steps; a plain combo is a sequence of length 1. */
export type ParsedKeyBinding = KeyStep[];

const SEQUENCE_TIMEOUT_MS = 500;
const SEQUENCE_TOKEN = /^(.+)\$$/;

/**
 * Parses `cmd+k` (single step) or `g$+a` (sequence: `g`, then `a` within 500ms).
 * A `key$` token closes a step; the modifiers before it belong to that step.
 */
export const parseKeyBinding = (binding: string): ParsedKeyBinding => {
  const steps: KeyStep[] = [];
  let tokens: string[] = [];

  for (const token of binding.split('+')) {
    const [, sequenceKey] = SEQUENCE_TOKEN.exec(token) ?? [];
    if (sequenceKey) {
      steps.push(parseKeyCombo([...tokens, sequenceKey].join('+')));
      tokens = [];
    } else {
      tokens.push(token);
    }
  }

  if (tokens.length === 0) {
    throw new Error(`Invalid key binding "${binding}": the last step cannot end with $`);
  }
  steps.push(parseKeyCombo(tokens.join('+')));

  for (const step of steps) {
    if (!step.key) throw new Error(`Invalid key binding "${binding}": every step needs a key`);
  }

  return steps;
};

/**
 * Printable symbols like `?`, `!` or `:` are typed with Shift on most layouts, and
 * `event.key` already reflects the resulting character. For those, the Shift state
 * is irrelevant unless the binding asks for it explicitly.
 */
const isShiftedSymbol = (key: string) => key.length === 1 && !/[a-z0-9]/i.test(key);

export const matchesCombo = (event: KeyboardEvent, combo: ParsedKeyCombo): boolean =>
  event.metaKey === combo.meta &&
  event.ctrlKey === combo.ctrl &&
  (event.shiftKey === combo.shift || (!combo.shift && isShiftedSymbol(combo.key))) &&
  event.altKey === combo.alt &&
  event.key.toLowerCase() === combo.key;

const KEYBOARD_CONSUMER_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true" i]',
  '[contenteditable="plaintext-only" i]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-radix-popper-content-wrapper]',
].join(', ');

export const isKeyboardConsumer = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(KEYBOARD_CONSUMER_SELECTOR) !== null;

/**
 * Keys without meta/ctrl/alt (`?`, `g`, `Escape`, arrows…) belong to the
 * focused field or widget, so they must keep typing/navigating there. Combos
 * like `mod+k` are safe to intercept from anywhere.
 */
const isTypingInConsumer = (event: KeyboardEvent) =>
  !event.metaKey && !event.ctrlKey && !event.altKey && isKeyboardConsumer(event.target);

const sameCombo = (a: ParsedKeyCombo, b: ParsedKeyCombo) =>
  a.key === b.key && a.meta === b.meta && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt;

const hasPrefix = (steps: KeyStep[], prefix: KeyStep[]) =>
  steps.length > prefix.length && prefix.every((step, i) => steps[i] !== undefined && sameCombo(steps[i], step));

const canonicalCombo = (combo: ParsedKeyCombo) =>
  `${combo.meta ? 'meta+' : ''}${combo.ctrl ? 'ctrl+' : ''}${combo.alt ? 'alt+' : ''}${combo.shift ? 'shift+' : ''}${combo.key}`;

/** Stable identity for a binding, so `cmd+k` and `meta+k` shadow each other. */
const canonicalBinding = (steps: KeyStep[]) => steps.map(canonicalCombo).join(' ');

/**
 * A set of bindings registered by one `useKeydown` call. `depth` comes from the
 * nearest `KeyboardScope`; deeper layers shadow shallower ones binding by binding.
 */
export type KeyboardLayer = {
  depth: number;
  bindings: UseKeydownArgs;
  shouldHandle?: (event: KeyboardEvent) => boolean;
};

type ResolvedBinding = {
  steps: KeyStep[];
  handler: () => void;
  layer: KeyboardLayer;
};

type PendingSequence = {
  /** Steps already matched, as parsed combos (several bindings may share a prefix). */
  matched: KeyStep[];
  candidates: ResolvedBinding[];
  expiresAt: number;
};

export type KeyboardDispatcher = {
  /** Registers a layer and returns its unregister function. */
  register: (layer: KeyboardLayer) => () => void;
  handleKeydown: (event: KeyboardEvent) => void;
  /** Forgets any armed sequence and clears its timer. */
  reset: () => void;
};

/**
 * Owns the layer registry and the single pending-sequence state for one event
 * target. Deeper layers win; on equal depth, the most recently registered wins.
 */
export const createKeyboardDispatcher = (): KeyboardDispatcher => {
  const layers = new Map<KeyboardLayer, number>();
  let nextOrder = 0;
  let pending: PendingSequence | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    pending = undefined;
    if (expiryTimer !== undefined) {
      clearTimeout(expiryTimer);
      expiryTimer = undefined;
    }
  };

  const arm = (matched: KeyStep[], candidates: ResolvedBinding[], now: number) => {
    reset();
    pending = { matched, candidates, expiresAt: now + SEQUENCE_TIMEOUT_MS };
    expiryTimer = setTimeout(reset, SEQUENCE_TIMEOUT_MS);
  };

  const resolveBindings = (): ResolvedBinding[] => {
    const ranked = [...layers.entries()].sort(([a, orderA], [b, orderB]) =>
      b.depth !== a.depth ? b.depth - a.depth : orderB - orderA,
    );
    const resolved = new Map<string, ResolvedBinding>();
    for (const [layer] of ranked) {
      for (const [binding, handler] of Object.entries(layer.bindings)) {
        const steps = parseKeyBinding(binding);
        const key = canonicalBinding(steps);
        if (!resolved.has(key)) resolved.set(key, { steps, handler, layer });
      }
    }
    return [...resolved.values()];
  };

  const accepts = (layer: KeyboardLayer, event: KeyboardEvent) => !layer.shouldHandle || layer.shouldHandle(event);

  const handleKeydown = (event: KeyboardEvent) => {
    const skipShortcut = event.defaultPrevented || event.isComposing || event.keyCode === 229;
    if (skipShortcut) {
      reset();
      return;
    }
    const isAncestorShortcut = event.target !== event.currentTarget;
    if (isAncestorShortcut && isTypingInConsumer(event)) return;

    const bindings = resolveBindings();
    const now = Date.now();

    if (pending) {
      if (now < pending.expiresAt) {
        const stepIndex = pending.matched.length;
        const candidates = bindings.filter(binding =>
          pending?.candidates.some(
            candidate =>
              candidate.layer === binding.layer &&
              canonicalBinding(candidate.steps) === canonicalBinding(binding.steps),
          ),
        );
        for (const { steps, handler, layer } of candidates) {
          const step = steps[stepIndex];
          if (!step || !hasPrefix(steps, pending.matched) || !matchesCombo(event, step)) continue;
          if (!accepts(layer, event)) return;
          event.preventDefault();
          if (stepIndex === steps.length - 1) {
            reset();
            handler();
          } else {
            arm([...pending.matched, step], candidates, now);
          }
          return;
        }
      }
      // Expired or unexpected key: reset and evaluate the event normally below.
      reset();
    }

    // Sequence prefixes win over plain combos on the same key.
    const candidates = bindings.filter(({ steps, layer }) => {
      const [first] = steps;
      return steps.length > 1 && first && matchesCombo(event, first) && accepts(layer, event);
    });
    const first = candidates[0]?.steps[0];
    if (first) {
      event.preventDefault();
      arm([first], candidates, now);
      return;
    }

    for (const { steps, handler, layer } of bindings) {
      const [first] = steps;
      if (steps.length === 1 && first && matchesCombo(event, first)) {
        if (!accepts(layer, event)) return;
        event.preventDefault();
        handler();
        return;
      }
    }
  };

  const register = (layer: KeyboardLayer) => {
    layers.set(layer, nextOrder++);
    return () => {
      layers.delete(layer);
      if (pending) {
        pending.candidates = pending.candidates.filter(candidate => candidate.layer !== layer);
        if (pending.candidates.length === 0) reset();
      }
    };
  };

  return { register, handleKeydown, reset };
};
