/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FilterBarProps } from './filter-bar';
import type { FilterBarField, FilterBarItem, FilterBarOperator, FilterBarSegment } from './types';

type SegmentKey = `${string}:${FilterBarSegment}`;

const SEGMENTS_LEFT_TO_RIGHT: FilterBarSegment[] = ['field', 'operator', 'value', 'remove'];
const SEGMENTS_RIGHT_TO_LEFT: FilterBarSegment[] = [...SEGMENTS_LEFT_TO_RIGHT].reverse();

export type FilterBarContextValue = {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  items: FilterBarItem[];
  addItem: (item: Omit<FilterBarItem, 'id'>) => void;
  updateItem: (id: string, patch: Partial<Omit<FilterBarItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  hasRemovableItems: boolean;
  registerNonRemovable: (itemId: string, nonRemovable: boolean) => void;
  getField: (fieldId: string) => FilterBarField | undefined;
  getOperator: (operatorId: string) => FilterBarOperator | undefined;
  getFieldOperators: (field: FilterBarField) => FilterBarOperator[];
  registerSegment: (itemId: string, segment: FilterBarSegment, el: HTMLElement | null) => void;
  registerInput: (el: HTMLInputElement | HTMLButtonElement | null) => void;
  focusChip: (fromIndex: number, direction: -1 | 1, segment: FilterBarSegment) => boolean;
  focusInput: () => void;
  focusAfterRemove: (removedIndex: number) => void;
  announce: (message: string) => void;
  announcement: string;
  ariaLabel: string;
  variant: NonNullable<FilterBarProps['variant']>;
};

const FilterBarContext = createContext<FilterBarContextValue | null>(null);

export function useFilterBarContext(): FilterBarContextValue {
  const ctx = useContext(FilterBarContext);
  if (!ctx) throw new Error('FilterBar compound components must be rendered inside <FilterBar>.');
  return ctx;
}

let idCounter = 0;
export function createFilterId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  idCounter += 1;
  return `filter-${idCounter}`;
}

export function emptyValueFor(operator: FilterBarOperator | undefined): string | string[] {
  return operator?.arity === 'many' ? [] : '';
}

export type FilterBarProviderProps = {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  value: FilterBarItem[];
  onValueChange: (items: FilterBarItem[]) => void;
  ariaLabel: string;
  variant: NonNullable<FilterBarProps['variant']>;
  children: ReactNode;
};

export function FilterBarProvider({
  fields,
  operators,
  value,
  onValueChange,
  ariaLabel,
  variant,
  children,
}: FilterBarProviderProps) {
  const segments = useRef(new Map<SegmentKey, HTMLElement>());
  const inputRef = useRef<HTMLInputElement | HTMLButtonElement | null>(null);
  const itemsRef = useRef(value);
  itemsRef.current = value;
  const [announcement, setAnnouncement] = useState('');
  const [nonRemovableIds, setNonRemovableIds] = useState<ReadonlySet<string>>(() => new Set());

  const getField = useCallback((fieldId: string) => fields.find(f => f.id === fieldId), [fields]);
  const getOperator = useCallback((operatorId: string) => operators.find(o => o.id === operatorId), [operators]);
  const getFieldOperators = useCallback(
    (field: FilterBarField) => {
      if (!field.operators) return operators;
      const allowed = new Set(field.operators);
      return operators.filter(o => allowed.has(o.id));
    },
    [operators],
  );

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const addItem = useCallback(
    (item: Omit<FilterBarItem, 'id'>) => {
      onValueChange([...itemsRef.current, { ...item, id: createFilterId() }]);
      announce('Filter added');
    },
    [onValueChange, announce],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<FilterBarItem, 'id'>>) => {
      onValueChange(itemsRef.current.map(item => (item.id === id ? { ...item, ...patch } : item)));
    },
    [onValueChange],
  );

  const removeItem = useCallback(
    (id: string) => {
      onValueChange(itemsRef.current.filter(item => item.id !== id));
      announce('Filter removed');
    },
    [onValueChange, announce],
  );

  const clear = useCallback(() => {
    onValueChange(itemsRef.current.filter(item => nonRemovableIds.has(item.id)));
    announce('All filters removed');
  }, [onValueChange, announce, nonRemovableIds]);

  const hasRemovableItems = value.some(item => !nonRemovableIds.has(item.id));

  const registerNonRemovable = useCallback((itemId: string, nonRemovable: boolean) => {
    setNonRemovableIds(prev => {
      if (prev.has(itemId) === nonRemovable) return prev;
      const next = new Set(prev);
      if (nonRemovable) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const registerSegment = useCallback((itemId: string, segment: FilterBarSegment, el: HTMLElement | null) => {
    const key: SegmentKey = `${itemId}:${segment}`;
    if (el) segments.current.set(key, el);
    else segments.current.delete(key);
  }, []);

  const registerInput = useCallback((el: HTMLInputElement | HTMLButtonElement | null) => {
    inputRef.current = el;
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const focusChip = useCallback((fromIndex: number, direction: -1 | 1, segment: FilterBarSegment) => {
    const items = itemsRef.current;
    const fallbacks: FilterBarSegment[] = direction === -1 ? SEGMENTS_RIGHT_TO_LEFT : SEGMENTS_LEFT_TO_RIGHT;
    for (let i = fromIndex; i >= 0 && i < items.length; i += direction) {
      const item = items[i];
      if (!item) break;
      for (const candidate of [segment, ...fallbacks]) {
        const el = segments.current.get(`${item.id}:${candidate}`);
        if (el) {
          el.focus();
          return true;
        }
      }
    }
    return false;
  }, []);

  const focusAfterRemove = useCallback(
    (removedIndex: number) => {
      const next = itemsRef.current[removedIndex + 1] ?? itemsRef.current[removedIndex - 1];
      if (next) {
        const el = segments.current.get(`${next.id}:value`) ?? segments.current.get(`${next.id}:field`);
        if (el) {
          el.focus();
          return;
        }
      }
      focusInput();
    },
    [focusInput],
  );

  const ctx = useMemo<FilterBarContextValue>(
    () => ({
      fields,
      operators,
      items: value,
      addItem,
      updateItem,
      removeItem,
      clear,
      hasRemovableItems,
      registerNonRemovable,
      getField,
      getOperator,
      getFieldOperators,
      registerSegment,
      registerInput,
      focusChip,
      focusInput,
      focusAfterRemove,
      announce,
      announcement,
      ariaLabel,
      variant,
    }),
    [
      fields,
      operators,
      value,
      addItem,
      updateItem,
      removeItem,
      clear,
      hasRemovableItems,
      registerNonRemovable,
      getField,
      getOperator,
      getFieldOperators,
      registerSegment,
      registerInput,
      focusChip,
      focusInput,
      focusAfterRemove,
      announce,
      announcement,
      ariaLabel,
      variant,
    ],
  );

  return <FilterBarContext.Provider value={ctx}>{children}</FilterBarContext.Provider>;
}
