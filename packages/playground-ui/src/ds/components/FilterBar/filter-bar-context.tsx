/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  DraftStage,
  FilterBarCommit,
  FilterBarDraft,
  FilterBarField,
  FilterBarItem,
  FilterBarOperator,
  FilterBarSegment,
  FilterBarValue,
} from './types';

type SegmentKey = `${string}:${FilterBarSegment}`;

const SEGMENTS_LEFT_TO_RIGHT: FilterBarSegment[] = ['field', 'operator', 'value', 'remove'];
const SEGMENTS_RIGHT_TO_LEFT: FilterBarSegment[] = [...SEGMENTS_LEFT_TO_RIGHT].reverse();

const stageOf = (draft: FilterBarDraft | null): DraftStage => {
  if (!draft) return 'none';
  return draft.operatorId ? 'operator' : 'field';
};

export type FilterBarContextValue = {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  items: FilterBarItem[];
  /** Filter under construction in the input, once a field is picked; `null` otherwise. */
  draft: FilterBarDraft | null;
  /** Progress or reset the draft. Its id is assigned on first field pick and kept afterwards. */
  setDraft: (next: Omit<FilterBarDraft, 'id' | 'from'> | null) => void;
  /** Append an item for the draft, reusing its id so the draft chip becomes the item's chip. */
  commitDraft: (next: Required<Omit<FilterBarDraft, 'id' | 'from'>>, value: FilterBarValue) => void;
  /** The draft that just became an item, until its chip has glinted or the bar moves on. */
  lastCommit: FilterBarCommit | null;
  settleCommit: () => void;
  updateItem: (id: string, patch: Partial<Omit<FilterBarItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  /** Removes every removable item (chips rendered with `removable={false}` stay). */
  clear: () => void;
  /** Whether at least one item can be removed, i.e. whether Clear has anything to do. */
  hasRemovableItems: boolean;
  /** Called by chips so `clear` and the Clear button know which items are pinned. */
  registerNonRemovable: (itemId: string, nonRemovable: boolean) => void;
  getField: (fieldId: string) => FilterBarField | undefined;
  getOperator: (operatorId: string) => FilterBarOperator | undefined;
  /** Operators allowed for a field (`field.operators` or every root operator). */
  getFieldOperators: (field: FilterBarField) => FilterBarOperator[];
  registerSegment: (itemId: string, segment: FilterBarSegment, el: HTMLElement | null) => void;
  registerInput: (el: HTMLInputElement | null) => void;
  /**
   * Focus a segment of the nearest editable chip starting at `fromIndex` and
   * walking in `direction` (read-only chips register no segments and are skipped).
   * Returns false if nothing was focused.
   */
  focusChip: (fromIndex: number, direction: -1 | 1, segment: FilterBarSegment) => boolean;
  focusInput: () => void;
  /** Called by chips to move focus after a removal. */
  focusAfterRemove: (removedIndex: number) => void;
  announce: (message: string) => void;
  announcement: string;
  ariaLabel: string;
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
  createItemId?: (fieldId: string) => string;
  ariaLabel: string;
  children: ReactNode;
};

export function FilterBarProvider({
  fields,
  operators,
  value,
  onValueChange,
  createItemId,
  ariaLabel,
  children,
}: FilterBarProviderProps) {
  const segments = useRef(new Map<SegmentKey, HTMLElement>());
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const [draft, setDraftState] = useState<FilterBarDraft | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [lastCommit, setLastCommit] = useState<FilterBarCommit | null>(null);
  const settleCommit = useCallback(() => setLastCommit(prev => (prev ? { ...prev, glint: false } : null)), []);
  // Until the consumer reflects the commit in `value`, the committed item is ours to show.
  const items = useMemo(
    () => (lastCommit && !value.some(item => item.id === lastCommit.item.id) ? [...value, lastCommit.item] : value),
    [value, lastCommit],
  );

  // The draft chip is keyed by the id the committed item will carry, so React keeps the same
  // element through the commit. Consumers who derive ids themselves supply `createItemId` so
  // the id we hand back in `onValueChange` is the one they'll hand back in `value`.
  const newItemId = useCallback(
    (fieldId: string) => (createItemId ? createItemId(fieldId) : createFilterId()),
    [createItemId],
  );

  const setDraft = useCallback(
    (next: Omit<FilterBarDraft, 'id' | 'from'> | null) => {
      setLastCommit(null);
      setDraftState(prev =>
        next
          ? { ...next, id: prev?.fieldId === next.fieldId ? prev.id : newItemId(next.fieldId), from: stageOf(prev) }
          : null,
      );
    },
    [newItemId],
  );

  const commitDraft = useCallback(
    ({ fieldId, operatorId }: Required<Omit<FilterBarDraft, 'id' | 'from'>>, value: FilterBarValue) => {
      // Operators without a value commit straight from the operator step, before a draft exists.
      const id = draftRef.current?.id ?? newItemId(fieldId);
      const item = { id, fieldId, operatorId, value };
      onValueChange([...itemsRef.current, item]);
      setLastCommit({ item, from: stageOf(draftRef.current), glint: true });
      setDraftState(null);
      announce('Filter added');
    },
    [onValueChange, announce, newItemId],
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
      setLastCommit(null);
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

  const registerInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const focusChip = useCallback((fromIndex: number, direction: -1 | 1, segment: FilterBarSegment) => {
    const items = itemsRef.current;
    // Custom chips may register only some segments (e.g. just `value`): when the
    // requested one is missing, land on the chip's outermost segment on the side
    // we arrive from.
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
      // Called synchronously after `removeItem`, before React re-renders: itemsRef still
      // holds the pre-removal list and every neighbour's DOM node is still mounted.
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
      items,
      draft,
      setDraft,
      commitDraft,
      lastCommit,
      settleCommit,
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
    }),
    [
      fields,
      operators,
      items,
      draft,
      setDraft,
      commitDraft,
      lastCommit,
      settleCommit,
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
    ],
  );

  return <FilterBarContext.Provider value={ctx}>{children}</FilterBarContext.Provider>;
}
