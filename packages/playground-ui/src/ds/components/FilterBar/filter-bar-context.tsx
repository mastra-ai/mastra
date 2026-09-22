/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearRemovable,
  collectIds,
  createGroup,
  denormalize,
  findGroup,
  flattenItems,
  groupDepth,
  insertItem,
  normalize,
  pruneEmptyGroups,
  removeNode,
  setGroupLogic,
  updateItem as updateTreeItem,
} from './filter-bar-tree';
import type { FilterBarValueInput } from './filter-bar-tree';
import { isFilterBarGroup } from './types';
import type {
  DraftStage,
  FilterBarCommit,
  FilterBarDraft,
  FilterBarExpression,
  FilterBarField,
  FilterBarGroup,
  FilterBarItem,
  FilterBarLogic,
  FilterBarNode,
  FilterBarOperator,
  FilterBarSegment,
  FilterBarValue,
} from './types';

type SegmentKey = `${string}:${FilterBarSegment}`;

const SEGMENTS_LEFT_TO_RIGHT: FilterBarSegment[] = ['field', 'operator', 'value', 'remove'];
const SEGMENTS_RIGHT_TO_LEFT: FilterBarSegment[] = [...SEGMENTS_LEFT_TO_RIGHT].reverse();

/** Default nesting bound for advanced-filter groups (root-level group = depth 1). */
export const DEFAULT_MAX_GROUP_DEPTH = 3;

/**
 * Marks a focus scope: the bar and each open advanced-filter popover. Arrow navigation
 * never crosses scopes, so ←/→ inside a popover cannot land back in the bar.
 */
export const FILTER_BAR_SCOPE_ATTR = 'data-filter-bar-scope';

const scopeOf = (el: Element | null | undefined) => el?.closest(`[${FILTER_BAR_SCOPE_ATTR}]`) ?? null;

const stageOf = (draft: FilterBarDraft | null): DraftStage => {
  if (!draft) return 'none';
  return draft.operatorId ? 'operator' : 'field';
};

export type FilterBarContextValue = {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  /** Every rendered item in visual order (groups flattened), including leaving ones. */
  items: FilterBarItem[];
  /** The rendered tree, including the pending commit and leaving nodes. */
  expression: FilterBarExpression;
  /** False when the consumer passed a flat `FilterBarItem[]`: no groups are offered. */
  groupsEnabled: boolean;
  /** Deepest allowed group nesting (root-level group = 1). */
  maxDepth: number;
  /** Filter under construction in the input, once a field is picked; `null` otherwise. */
  draft: FilterBarDraft | null;
  /** Progress or reset the draft. Its id is assigned on first field pick and kept afterwards. */
  setDraft: (next: Omit<FilterBarDraft, 'id' | 'from' | 'groupId'> | null) => void;
  /** Append an item for the draft, reusing its id so the draft chip becomes the item's chip. */
  commitDraft: (next: Required<Omit<FilterBarDraft, 'id' | 'from' | 'groupId'>>, value: FilterBarValue) => void;
  /** The draft that just became an item, until its chip has glinted or the bar moves on. */
  lastCommit: FilterBarCommit | null;
  settleCommit: () => void;
  updateItem: (id: string, patch: Partial<Omit<FilterBarItem, 'id'>>) => void;
  /** Removes a leaf. Its group stays, even empty, until the popover closes (see `setOpenGroup`). */
  removeItem: (id: string) => void;
  /** Ids of removed items and groups still rendered while their chip plays its exit animation. */
  leaving: ReadonlySet<string>;
  /** Called by a leaving chip once its exit animation has finished (or when nothing animates). */
  settleRemove: (id: string) => void;
  /** Removes every removable item (chips rendered with `removable={false}` stay) and every group left empty. */
  clear: () => void;
  /** Whether at least one item can be removed, i.e. whether Clear has anything to do. */
  hasRemovableItems: boolean;
  /** Called by chips so `clear` and the Clear button know which items are pinned. */
  registerNonRemovable: (itemId: string, nonRemovable: boolean) => void;
  /** Appends an empty group to the root (`undefined`) or inside `parentId`, and points the input at it. */
  addGroup: (parentId: string | undefined, logic: FilterBarLogic) => string;
  /** Removes a group and everything below it. */
  removeGroup: (groupId: string) => void;
  setLogic: (groupId: string, logic: FilterBarLogic) => void;
  /** Nesting level of a group (root-level = 1); 0 when unknown. */
  getGroupDepth: (groupId: string) => number;
  /** Root group whose advanced-filter popover is open. */
  openGroupId: string | null;
  /** Open a root group's popover, or close it with `null` (empty groups are pruned on close). */
  setOpenGroup: (groupId: string | null) => void;
  /** Group the input commits into; `undefined` = root. */
  inputTarget: string | undefined;
  /** Point the input at a group (or back at the root with `undefined`) and focus it. */
  openGroupInput: (groupId: string | undefined) => void;
  getField: (fieldId: string) => FilterBarField | undefined;
  getOperator: (operatorId: string) => FilterBarOperator | undefined;
  /** Operators allowed for a field (`field.operators` or every root operator). */
  getFieldOperators: (field: FilterBarField) => FilterBarOperator[];
  registerSegment: (itemId: string, segment: FilterBarSegment, el: HTMLElement | null) => void;
  registerInput: (el: HTMLInputElement | null) => void;
  /**
   * Focus a segment of the nearest editable chip starting at `fromIndex` and
   * walking in `direction` (read-only chips register no segments and are skipped).
   * Never leaves the focus scope of the currently focused element. Returns false if
   * nothing was focused.
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
  value: FilterBarValueInput;
  /** Receives the same shape as `value` (method syntax so flat-only handlers stay assignable). */
  onValueChange(value: FilterBarValueInput): void;
  createItemId?: (fieldId: string) => string;
  /** Deepest allowed group nesting (root-level group = 1). Defaults to 3. */
  maxDepth?: number;
  ariaLabel: string;
  children: ReactNode;
};

const idsOf = (nodes: FilterBarNode[], out = new Set<string>()): Set<string> => {
  for (const node of nodes) {
    out.add(node.id);
    if (isFilterBarGroup(node)) idsOf(node.nodes, out);
  }
  return out;
};

/**
 * The previously rendered tree with the consumer's new `value` folded in: nodes still
 * present take their new version (in their old position), leaving nodes stay where they
 * were, and nodes the consumer added are appended. Once nothing is leaving the result is
 * exactly `next`, so consumer reorders are only deferred, never lost.
 */
const mergeNodes = (prev: FilterBarNode[], next: FilterBarNode[], leaving: ReadonlySet<string>): FilterBarNode[] => {
  const nextById = new Map(next.map(node => [node.id, node]));
  const seen = new Set<string>();
  const out: FilterBarNode[] = [];
  for (const old of prev) {
    const fresh = nextById.get(old.id);
    if (fresh) {
      seen.add(old.id);
      out.push(
        isFilterBarGroup(fresh) && isFilterBarGroup(old)
          ? { ...fresh, nodes: mergeNodes(old.nodes, fresh.nodes, leaving) }
          : fresh,
      );
    } else if (leaving.has(old.id)) {
      out.push(old);
    }
  }
  for (const node of next) if (!seen.has(node.id)) out.push(node);
  return out;
};

export function FilterBarProvider({
  fields,
  operators,
  value,
  onValueChange,
  createItemId,
  maxDepth = DEFAULT_MAX_GROUP_DEPTH,
  ariaLabel,
  children,
}: FilterBarProviderProps) {
  const segments = useRef(new Map<SegmentKey, HTMLElement>());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flat = Array.isArray(value);
  const expression = useMemo(() => normalize(value), [value]);
  const exprRef = useRef(expression);
  exprRef.current = expression;
  const [announcement, setAnnouncement] = useState('');
  const [nonRemovableIds, setNonRemovableIds] = useState<ReadonlySet<string>>(() => new Set());
  const [inputTarget, setInputTarget] = useState<string | undefined>(undefined);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const emit = useCallback(
    (next: FilterBarExpression) => onValueChange(denormalize(next, flat)),
    [onValueChange, flat],
  );

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
  // Removed nodes stay rendered at their old position until their chip has animated out.
  const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(() => new Set());
  const settleRemove = useCallback((id: string) => {
    setLeavingIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const markLeaving = useCallback((ids: Iterable<string>) => {
    const list = [...ids];
    if (list.length === 0) return;
    setLeavingIds(prev => new Set([...prev, ...list]));
  }, []);

  // Until the consumer reflects the commit in `value`, the committed item is ours to show;
  // nodes on their way out keep their place in the previously rendered tree.
  const renderedTreeRef = useRef<FilterBarNode[]>(expression.nodes);
  const { rendered, items, leaving, rootGroupOf } = useMemo(() => {
    const present = idsOf(expression.nodes);
    let rendered: FilterBarExpression =
      leavingIds.size === 0
        ? expression
        : { ...expression, nodes: mergeNodes(renderedTreeRef.current, expression.nodes, leavingIds) };
    if (lastCommit && !present.has(lastCommit.item.id)) {
      rendered = insertItem(rendered, lastCommit.groupId, lastCommit.item);
    }
    renderedTreeRef.current = rendered.nodes;
    const shown = idsOf(rendered.nodes);
    const leaving = new Set([...leavingIds].filter(id => shown.has(id) && !present.has(id)));
    // Each leaf's root-level group: arrow navigation lands on that group's advanced chip
    // when the leaf itself is unmounted (closed popover).
    const rootGroupOf = new Map<string, string>();
    for (const node of rendered.nodes) {
      if (isFilterBarGroup(node))
        for (const { item } of flattenItems({ logic: 'and', nodes: [node] })) rootGroupOf.set(item.id, node.id);
    }
    return { rendered, items: flattenItems(rendered).map(e => e.item), leaving, rootGroupOf };
  }, [expression, lastCommit, leavingIds]);

  // The draft chip is keyed by the id the committed item will carry, so React keeps the same
  // element through the commit. Consumers who derive ids themselves supply `createItemId` so
  // the id we hand back in `onValueChange` is the one they'll hand back in `value`.
  const newItemId = useCallback(
    (fieldId: string) => (createItemId ? createItemId(fieldId) : createFilterId()),
    [createItemId],
  );

  const setDraft = useCallback(
    (next: Omit<FilterBarDraft, 'id' | 'from' | 'groupId'> | null) => {
      setLastCommit(null);
      setDraftState(prev =>
        next
          ? {
              ...next,
              id: prev?.fieldId === next.fieldId ? prev.id : newItemId(next.fieldId),
              from: stageOf(prev),
              groupId: inputTarget,
            }
          : null,
      );
    },
    [newItemId, inputTarget],
  );

  const commitDraft = useCallback(
    ({ fieldId, operatorId }: Required<Omit<FilterBarDraft, 'id' | 'from' | 'groupId'>>, value: FilterBarValue) => {
      // Operators without a value commit straight from the operator step, before a draft exists.
      const id = draftRef.current?.id ?? newItemId(fieldId);
      const groupId = draftRef.current?.groupId ?? inputTarget;
      const item = { id, fieldId, operatorId, value };
      emit(insertItem(exprRef.current, groupId, item));
      setLastCommit({ item, from: stageOf(draftRef.current), glint: true, groupId });
      setDraftState(null);
      announce('Filter added');
    },
    [emit, announce, newItemId, inputTarget],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<FilterBarItem, 'id'>>) => {
      emit(updateTreeItem(exprRef.current, id, patch));
    },
    [emit],
  );

  const removeItem = useCallback(
    (id: string) => {
      markLeaving([id]);
      emit(removeNode(exprRef.current, id));
      setLastCommit(null);
      announce('Filter removed');
    },
    [emit, announce, markLeaving],
  );

  const releaseInputTarget = useCallback((gone: ReadonlySet<string>) => {
    setInputTarget(prev => (prev && gone.has(prev) ? undefined : prev));
  }, []);

  const removeGroup = useCallback(
    (groupId: string) => {
      const expr = exprRef.current;
      const group = findGroup(expr, groupId);
      const gone = new Set(group ? collectIds(group) : [groupId]);
      markLeaving(gone);
      emit(removeNode(expr, groupId));
      setLastCommit(null);
      setDraftState(null);
      releaseInputTarget(gone);
      setOpenGroupId(prev => (prev === groupId ? null : prev));
      announce('Advanced filter removed');
    },
    [emit, announce, markLeaving, releaseInputTarget],
  );

  const addGroup = useCallback(
    (parentId: string | undefined, logic: FilterBarLogic) => {
      const group: FilterBarGroup = { id: createFilterId(), kind: 'group', logic, nodes: [] };
      emit(createGroup(exprRef.current, parentId, group));
      setLastCommit(null);
      setDraftState(null);
      setInputTarget(group.id);
      announce(parentId ? 'Nested group added' : 'Advanced filter added');
      return group.id;
    },
    [emit, announce],
  );

  const setLogic = useCallback(
    (groupId: string, logic: FilterBarLogic) => {
      emit(setGroupLogic(exprRef.current, groupId, logic));
      announce(`Conditions joined with ${logic}`);
    },
    [emit, announce],
  );

  const getGroupDepth = useCallback((groupId: string) => groupDepth(exprRef.current, groupId), []);

  const setOpenGroup = useCallback(
    (groupId: string | null) => {
      setOpenGroupId(groupId);
      if (groupId !== null) return;
      // Closing the editor: whatever was left empty goes away, and the input returns to the bar.
      const expr = exprRef.current;
      const pruned = pruneEmptyGroups(expr);
      const kept = idsOf(pruned.nodes);
      const gone = new Set([...idsOf(expr.nodes)].filter(id => !kept.has(id)));
      if (gone.size > 0) {
        markLeaving(gone);
        emit(pruned);
      }
      setDraftState(null);
      setInputTarget(undefined);
    },
    [emit, markLeaving],
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const openGroupInput = useCallback(
    (groupId: string | undefined) => {
      setInputTarget(groupId);
      setDraftState(null);
      // The input for a group mounts with the next render and focuses itself.
      if (groupId === undefined) focusInput();
    },
    [focusInput],
  );

  const clear = useCallback(() => {
    const expr = exprRef.current;
    const next = clearRemovable(expr, nonRemovableIds);
    const kept = idsOf(next.nodes);
    const gone = new Set([...idsOf(expr.nodes)].filter(id => !kept.has(id)));
    markLeaving(gone);
    emit(next);
    setLastCommit(null);
    setDraftState(null);
    setInputTarget(undefined);
    setOpenGroupId(null);
    announce('All filters removed');
  }, [emit, announce, nonRemovableIds, markLeaving]);

  const hasRemovableItems = flattenItems(expression).some(({ item }) => !nonRemovableIds.has(item.id));

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
    // An unmounting input must not clear the ref if another input already took over.
    if (el) inputRef.current = el;
    else if (!inputRef.current?.isConnected) inputRef.current = null;
  }, []);

  // Chip indices refer to the rendered list (which may still hold leaving chips), not `value`.
  const renderedRef = useRef(items);
  renderedRef.current = items;

  const rootGroupRef = useRef(rootGroupOf);
  rootGroupRef.current = rootGroupOf;

  const focusChip = useCallback((fromIndex: number, direction: -1 | 1, segment: FilterBarSegment) => {
    const items = renderedRef.current;
    const rootGroupOf = rootGroupRef.current;
    // Stay within the scope of the focused element, or (after a mouse click, which does not
    // move focus) of the chip we navigate away from. Unknown scope: any chip qualifies.
    const origin = items[fromIndex - direction];
    const originEl = origin
      ? [...SEGMENTS_LEFT_TO_RIGHT].map(s => segments.current.get(`${origin.id}:${s}`)).find(Boolean)
      : null;
    const scope =
      scopeOf(typeof document === 'undefined' ? null : document.activeElement) ?? scopeOf(originEl) ?? undefined;
    // Custom chips may register only some segments (e.g. just `value`): when the
    // requested one is missing, land on the chip's outermost segment on the side
    // we arrive from.
    const fallbacks: FilterBarSegment[] = direction === -1 ? SEGMENTS_RIGHT_TO_LEFT : SEGMENTS_LEFT_TO_RIGHT;
    for (let i = fromIndex; i >= 0 && i < items.length; i += direction) {
      const item = items[i];
      if (!item) break;
      // A leaf inside a closed popover has no segments: land on its advanced chip instead.
      const ownerIds = [item.id, rootGroupOf.get(item.id)].filter((id): id is string => id !== undefined);
      for (const ownerId of ownerIds) {
        for (const candidate of [segment, ...fallbacks]) {
          const el = segments.current.get(`${ownerId}:${candidate}`);
          if (el && (scope === undefined || scopeOf(el) === scope)) {
            el.focus();
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const focusAfterRemove = useCallback(
    (removedIndex: number) => {
      // Called synchronously after `removeItem`, before React re-renders: the rendered list
      // still holds the removed chip and every neighbour's DOM node is still mounted.
      // Leaving neighbours register no segments, so they are skipped over.
      if (focusChip(removedIndex + 1, 1, 'value') || focusChip(removedIndex - 1, -1, 'value')) return;
      focusInput();
    },
    [focusChip, focusInput],
  );

  const ctx = useMemo<FilterBarContextValue>(
    () => ({
      fields,
      operators,
      items,
      expression: rendered,
      groupsEnabled: !flat,
      maxDepth,
      draft,
      setDraft,
      commitDraft,
      lastCommit,
      settleCommit,
      updateItem,
      removeItem,
      leaving,
      settleRemove,
      clear,
      hasRemovableItems,
      registerNonRemovable,
      addGroup,
      removeGroup,
      setLogic,
      getGroupDepth,
      openGroupId,
      setOpenGroup,
      inputTarget,
      openGroupInput,
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
      rendered,
      flat,
      maxDepth,
      draft,
      setDraft,
      commitDraft,
      lastCommit,
      settleCommit,
      updateItem,
      removeItem,
      leaving,
      settleRemove,
      clear,
      hasRemovableItems,
      registerNonRemovable,
      addGroup,
      removeGroup,
      setLogic,
      getGroupDepth,
      openGroupId,
      setOpenGroup,
      inputTarget,
      openGroupInput,
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
