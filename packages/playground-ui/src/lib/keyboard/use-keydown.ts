import { useEffect, useEffectEvent, useState } from 'react';

export type UseKeydownArgs = {
  [keySet: string]: () => void;
};

type ParsedKeyCombo = {
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

export const matchesCombo = (event: KeyboardEvent, combo: ParsedKeyCombo): boolean =>
  event.metaKey === combo.meta &&
  event.ctrlKey === combo.ctrl &&
  event.shiftKey === combo.shift &&
  event.altKey === combo.alt &&
  event.key.toLowerCase() === combo.key;

export const useKeydown = (opts: UseKeydownArgs) => {
  const handlers = useEffectEvent((event: KeyboardEvent) => {
    for (const [combo, handler] of Object.entries(opts)) {
      if (matchesCombo(event, parseKeyCombo(combo))) {
        event.preventDefault();
        handler();
        return;
      }
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handlers(event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};

export const useTableKeydown = (tableCount: number) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useKeydown({
    ArrowUp: () => {
      setActiveIndex(current => (current - 1 + tableCount) % tableCount);
    },
    ArrowDown: () => {
      setActiveIndex(current => (current + 1) % tableCount);
    },
    Home: () => {
      setActiveIndex(0);
    },
    End: () => {
      setActiveIndex(tableCount - 1);
    },
  });

  return {
    activeIndex,
    setActiveIndex,
  };
};
