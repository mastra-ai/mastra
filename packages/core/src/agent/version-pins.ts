import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { VersionOverrides, VersionSelector } from '../mastra/types';
import type { RequestContext } from '../request-context';

/** @internal Immutable stored-agent identity selected for a running agent execution. */
export interface ResolvedAgentVersionSelection {
  agentId: string;
  versionId: string;
  selectedLabel?: string;
}

/** @internal Root and explicit dependency pins owned by one agent run. */
export interface AgentVersionPins {
  root?: ResolvedAgentVersionSelection;
  agents?: Record<string, ResolvedAgentVersionSelection>;
  defaultStatus?: VersionOverrides['defaultStatus'];
}

/** @internal Request-context slot used to carry run pins through tool creation and delegation. */
export const MASTRA_AGENT_VERSION_PINS_KEY = 'mastra__agentVersionPins';
/** @internal One-shot marker for a nested agent invocation that inherits its parent's run pins. */
export const MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY = 'mastra__agentVersionPinsDelegated';

type VersionedAgentLike = {
  id: string;
  toRawConfig(): Record<string, unknown> | undefined;
  __setRawConfig?(rawConfig: Record<string, unknown>): void;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function invalidPins(reason: string): never {
  throw new MastraError({
    id: 'PINNED_VERSION_INVALID',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Persisted agent version pins are invalid: ${reason}.`,
    details: { reason },
  });
}

function normalizeSelection(value: unknown, expectedAgentId?: string): ResolvedAgentVersionSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidPins('a selection is not an object');
  }
  const input = value as Record<string, unknown>;
  if (!isNonEmptyString(input.agentId)) return invalidPins('a selection has no agentId');
  if (!isNonEmptyString(input.versionId)) return invalidPins(`agent "${input.agentId}" has no versionId`);
  if (expectedAgentId !== undefined && input.agentId !== expectedAgentId) {
    return invalidPins(`agent map key "${expectedAgentId}" does not match selection "${input.agentId}"`);
  }
  if (input.selectedLabel !== undefined && !isNonEmptyString(input.selectedLabel)) {
    return invalidPins(`agent "${input.agentId}" has an invalid selectedLabel`);
  }
  return {
    agentId: input.agentId,
    versionId: input.versionId,
    ...(isNonEmptyString(input.selectedLabel) ? { selectedLabel: input.selectedLabel } : {}),
  };
}

/** @internal Validate and clone pins crossing a serialized workflow boundary. */
export function normalizeAgentVersionPins(value: unknown): AgentVersionPins | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidPins('the pin payload is not an object');
  }
  const input = value as Record<string, unknown>;
  const root = input.root === undefined ? undefined : normalizeSelection(input.root);
  const defaultStatus = input.defaultStatus;
  if (defaultStatus !== undefined && defaultStatus !== 'draft' && defaultStatus !== 'published') {
    return invalidPins('the defaultStatus is invalid');
  }
  const agentsInput = input.agents;
  const agents: Record<string, ResolvedAgentVersionSelection> = {};
  if (agentsInput !== undefined) {
    if (!agentsInput || typeof agentsInput !== 'object' || Array.isArray(agentsInput)) {
      return invalidPins('the agents pin map is not an object');
    }
    for (const [agentId, pinValue] of Object.entries(agentsInput as Record<string, unknown>)) {
      const pin = normalizeSelection(pinValue, agentId);
      agents[agentId] = pin;
    }
  }

  if (!root && Object.keys(agents).length === 0 && !defaultStatus) {
    return invalidPins('the pin payload contains no selections');
  }
  return {
    ...(root ? { root } : {}),
    ...(Object.keys(agents).length > 0 ? { agents } : {}),
    ...(defaultStatus ? { defaultStatus } : {}),
  };
}

function reconcilePersistedSelections(
  current: ResolvedAgentVersionSelection | undefined,
  next: ResolvedAgentVersionSelection,
  location: string,
): ResolvedAgentVersionSelection {
  if (!current) return { ...next };
  if (current.agentId !== next.agentId || current.versionId !== next.versionId) {
    return invalidPins(`${location} selections disagree`);
  }
  if (current.selectedLabel && next.selectedLabel && current.selectedLabel !== next.selectedLabel) {
    return invalidPins(`${location} selected labels disagree`);
  }
  return {
    agentId: current.agentId,
    versionId: current.versionId,
    ...(current.selectedLabel || next.selectedLabel
      ? { selectedLabel: current.selectedLabel ?? next.selectedLabel }
      : {}),
  };
}

/**
 * @internal Reconcile every structured pin payload discovered in one persisted
 * run. Older snapshots may omit fields that newer copies contain, but two
 * copies may never disagree about an immutable selection, its diagnostic
 * label, or the dependency status policy.
 */
export function reconcileAgentVersionPinPayloads(...values: unknown[]): AgentVersionPins | undefined {
  let reconciled: AgentVersionPins | undefined;

  for (const value of values) {
    const pins = normalizeAgentVersionPins(value);
    if (!pins) continue;

    const root = pins.root ? reconcilePersistedSelections(reconciled?.root, pins.root, 'root') : reconciled?.root;
    const agents = { ...(reconciled?.agents ?? {}) };
    for (const [agentId, pin] of Object.entries(pins.agents ?? {})) {
      agents[agentId] = reconcilePersistedSelections(agents[agentId], pin, `agent "${agentId}"`);
    }

    if (
      reconciled?.defaultStatus !== undefined &&
      pins.defaultStatus !== undefined &&
      reconciled.defaultStatus !== pins.defaultStatus
    ) {
      return invalidPins('defaultStatus values disagree');
    }
    const defaultStatus = reconciled?.defaultStatus ?? pins.defaultStatus;

    // Scoped delegation can retain the selected child in both positions. That
    // historical shape is compatible only when both entries identify the same
    // immutable version and label.
    if (root && agents[root.agentId]) {
      const shared = reconcilePersistedSelections(root, agents[root.agentId]!, `root agent "${root.agentId}"`);
      agents[root.agentId] = shared;
      reconciled = {
        root: shared,
        ...(Object.keys(agents).length > 0 ? { agents } : {}),
        ...(defaultStatus ? { defaultStatus } : {}),
      };
    } else {
      reconciled = {
        ...(root ? { root } : {}),
        ...(Object.keys(agents).length > 0 ? { agents } : {}),
        ...(defaultStatus ? { defaultStatus } : {}),
      };
    }
  }

  return reconciled;
}

/**
 * @internal Validate that a top-level continuation snapshot cannot disguise
 * its execution owner as a dependency. Delegation remains valid because the
 * scoped pin boundary promotes the selected child to `root` first.
 */
export function assertAgentVersionPinsOwnerIntegrity(
  pins: AgentVersionPins | undefined,
  ownerAgentId: string,
): AgentVersionPins | undefined {
  if (pins && !pins.root && pins.agents?.[ownerAgentId]) {
    return invalidPins(`execution owner "${ownerAgentId}" is listed as a dependency without a root selection`);
  }
  return pins;
}

/** @internal Read a defensive copy of the pins installed on a run context. */
export function getAgentVersionPins(requestContext: RequestContext | undefined): AgentVersionPins | undefined {
  return normalizeAgentVersionPins(requestContext?.get(MASTRA_AGENT_VERSION_PINS_KEY));
}

/** @internal Replace the run-context pins with a validated defensive copy. */
export function setAgentVersionPins(requestContext: RequestContext, pins: AgentVersionPins | undefined): void {
  const normalized = normalizeAgentVersionPins(pins);
  if (normalized) {
    requestContext.set(MASTRA_AGENT_VERSION_PINS_KEY, normalized);
  } else {
    requestContext.delete(MASTRA_AGENT_VERSION_PINS_KEY);
  }
}

/**
 * @internal Rebase an inherited run pin map onto the agent at a delegation boundary.
 * The parent's root remains private to the parent run; an explicit dependency pin
 * for the delegated agent becomes the child's root while deeper dependency pins
 * remain available to nested tools.
 */
export function scopeAgentVersionPins(
  pins: AgentVersionPins | undefined,
  agentId: string,
): AgentVersionPins | undefined {
  if (!pins) return undefined;
  const root = pins.root?.agentId === agentId ? pins.root : pins.agents?.[agentId];
  const scoped: AgentVersionPins = {
    ...(root ? { root: { ...root } } : {}),
    ...(pins.agents
      ? {
          agents: Object.fromEntries(Object.entries(pins.agents).map(([id, pin]) => [id, { ...pin }])),
        }
      : {}),
    ...(pins.defaultStatus ? { defaultStatus: pins.defaultStatus } : {}),
  };
  if (!scoped.root && !scoped.agents && !scoped.defaultStatus) return undefined;
  return normalizeAgentVersionPins(scoped);
}

/** @internal Replace mutable selectors with the immutable identities owned by a run. */
export function exactVersionOverridesForPins(
  pins: AgentVersionPins | undefined,
  defaultStatus?: VersionOverrides['defaultStatus'],
): VersionOverrides | undefined {
  const selectedDefaultStatus = defaultStatus ?? pins?.defaultStatus;
  if (!pins && !selectedDefaultStatus) return undefined;
  const exactAgents = Object.fromEntries(
    Object.entries(pins?.agents ?? {})
      .filter(([agentId]) => agentId !== pins?.root?.agentId)
      .map(([agentId, pin]) => [agentId, { versionId: pin.versionId }]),
  );
  return {
    ...(selectedDefaultStatus ? { defaultStatus: selectedDefaultStatus } : {}),
    ...(pins?.root ? { self: { versionId: pins.root.versionId } } : {}),
    ...(Object.keys(exactAgents).length > 0 ? { agents: exactAgents } : {}),
  };
}

/** @internal Persist the dependency-selection policy alongside immutable selections. */
export function setAgentVersionPinDefaultStatus(
  requestContext: RequestContext,
  defaultStatus: VersionOverrides['defaultStatus'] | undefined,
): void {
  const pins = getAgentVersionPins(requestContext);
  if (!pins && !defaultStatus) return;
  setAgentVersionPins(requestContext, {
    ...pins,
    ...(defaultStatus ? { defaultStatus } : {}),
  });
}

/**
 * @internal Older structured pin snapshots predate `defaultStatus` on the pin
 * payload but already persisted that policy in their own versions entry. Fold
 * only that snapshot-owned value into the pins before continuation checks.
 */
export function reconcileLegacyPersistedVersionPinDefaultStatus(
  value: unknown,
  persistedVersions: unknown,
): AgentVersionPins | undefined {
  const pins = normalizeAgentVersionPins(value);
  if (!pins || pins.defaultStatus !== undefined) return pins;
  if (!persistedVersions || typeof persistedVersions !== 'object' || Array.isArray(persistedVersions)) return pins;

  const defaultStatus = (persistedVersions as Record<string, unknown>).defaultStatus;
  if (defaultStatus === undefined) return pins;
  return normalizeAgentVersionPins({ ...pins, defaultStatus });
}

/** @internal Merge one immutable root or dependency selection into the run context. */
export function recordAgentVersionPin(
  requestContext: RequestContext,
  pin: ResolvedAgentVersionSelection,
  scope: 'root' | 'agent',
): AgentVersionPins {
  const current = getAgentVersionPins(requestContext);
  const next: AgentVersionPins =
    scope === 'root'
      ? { ...current, root: { ...pin } }
      : { ...current, agents: { ...current?.agents, [pin.agentId]: { ...pin } } };
  setAgentVersionPins(requestContext, next);
  return next;
}

/** @internal Build a pin from the authoritative resolution metadata attached by the editor. */
export function getResolvedAgentVersionSelection(
  agent: VersionedAgentLike,
  selector?: VersionSelector,
): ResolvedAgentVersionSelection | undefined {
  const rawConfig = agent.toRawConfig();
  const versionId = rawConfig?.resolvedVersionId;
  if (!isNonEmptyString(versionId)) return undefined;

  const rawSelectedLabel = rawConfig?.selectedVersionLabel;
  const selectedLabel =
    selector && 'label' in selector && isNonEmptyString(selector.label)
      ? selector.label
      : isNonEmptyString(rawSelectedLabel)
        ? rawSelectedLabel
        : undefined;

  return {
    agentId: agent.id,
    versionId,
    ...(selectedLabel ? { selectedLabel } : {}),
  };
}

/** @internal Keep diagnostic label identity when hydrating a continuation by exact ID. */
export function applySelectedLabelToResolvedAgent(agent: VersionedAgentLike, pin: ResolvedAgentVersionSelection): void {
  if (!pin.selectedLabel || typeof agent.__setRawConfig !== 'function') return;
  agent.__setRawConfig({ ...(agent.toRawConfig() ?? {}), selectedVersionLabel: pin.selectedLabel });
}

function selectorDetails(selector: VersionSelector): Record<string, string> {
  if (typeof selector.versionId === 'string') return { requestedVersionId: selector.versionId };
  if (typeof selector.label === 'string') return { requestedLabel: selector.label };
  return { requestedStatus: selector.status };
}

function selectorsEqual(left: VersionSelector, right: VersionSelector): boolean {
  if ('versionId' in left) return 'versionId' in right && left.versionId === right.versionId;
  if ('label' in left) return 'label' in right && left.label === right.label;
  return 'status' in right && left.status === right.status;
}

/**
 * @internal Canonicalize the two supported root-selector spellings. Supplying
 * both is permitted only when they are identical; the per-agent root entry is
 * then removed so dependency traversal cannot resolve the root a second time.
 */
export function reconcileRootVersionOverrides(
  overrides: VersionOverrides | undefined,
  rootAgentId: string,
): VersionOverrides | undefined {
  if (!overrides) return undefined;
  const selfSelector = overrides.self;
  const mappedSelector = overrides.agents?.[rootAgentId];
  if (selfSelector && mappedSelector && !selectorsEqual(selfSelector, mappedSelector)) {
    throw new MastraError({
      id: 'INVALID_VERSION_SELECTOR',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent "${rootAgentId}" received conflicting root version selectors.`,
      details: {
        agentId: rootAgentId,
        selfSelector: JSON.stringify(selectorDetails(selfSelector)),
        mappedSelector: JSON.stringify(selectorDetails(mappedSelector)),
      },
    });
  }

  const rootSelector = selfSelector ?? mappedSelector;
  const dependencyAgents = Object.fromEntries(
    Object.entries(overrides.agents ?? {}).filter(([agentId]) => agentId !== rootAgentId),
  );
  const canonical: VersionOverrides = {
    ...(rootSelector ? { self: rootSelector } : {}),
    ...(Object.keys(dependencyAgents).length > 0 ? { agents: dependencyAgents } : {}),
    ...(overrides.defaultStatus ? { defaultStatus: overrides.defaultStatus } : {}),
  };
  return Object.keys(canonical).length > 0 ? canonical : undefined;
}

/**
 * @internal A continuation consumes its persisted pin. Only an explicit repeat of the
 * exact immutable ID is accepted; mutable selectors and different IDs fail closed.
 */
export function assertContinuationSelectorMatchesPin(
  selector: VersionSelector | undefined,
  pin: ResolvedAgentVersionSelection,
): void {
  if (!selector) return;
  if ('versionId' in selector && selector.versionId === pin.versionId) return;

  throw new MastraError({
    id: 'PINNED_VERSION_CONFLICT',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${pin.agentId}" continuation is pinned to immutable version "${pin.versionId}" and cannot change selectors.`,
    details: {
      agentId: pin.agentId,
      pinnedVersionId: pin.versionId,
      ...(pin.selectedLabel ? { selectedLabel: pin.selectedLabel } : {}),
      ...selectorDetails(selector),
    },
  });
}

function unpinnedContinuationConflict(agentId: string, selector: VersionSelector): never {
  throw new MastraError({
    id: 'PINNED_VERSION_CONFLICT',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${agentId}" was not version-selected when this run started and cannot add a selector during continuation.`,
    details: { agentId, ...selectorDetails(selector) },
  });
}

function legacyPinRequired(agentId: string, reason: string): never {
  throw new MastraError({
    id: 'PINNED_VERSION_REQUIRED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${agentId}" continuation predates immutable version pins and cannot safely apply ${reason}.`,
    details: { agentId, reason },
  });
}

/**
 * @internal Validate overrides for a genuinely legacy continuation with no
 * structured pin payload. Only an exact root ID can safely bridge old state;
 * dependency selectors and mutable/default selection policy are unknowable.
 */
export function resolveLegacyContinuationRootPin(
  overrides: VersionOverrides | undefined,
  rootAgentId: string,
): ResolvedAgentVersionSelection | undefined {
  if (!overrides) return undefined;
  if (overrides.defaultStatus !== undefined) {
    return legacyPinRequired(rootAgentId, 'a dependency defaultStatus');
  }
  for (const [agentId, selector] of Object.entries(overrides.agents ?? {})) {
    if (agentId !== rootAgentId) {
      return legacyPinRequired(rootAgentId, `a selector for dependency "${agentId}"`);
    }
    if (!('versionId' in selector)) {
      return legacyPinRequired(rootAgentId, `a mutable selector for root agent "${rootAgentId}"`);
    }
  }

  const selectors = [overrides.self, overrides.agents?.[rootAgentId]].filter(
    (selector): selector is VersionSelector => selector !== undefined,
  );
  for (const selector of selectors) {
    if (!('versionId' in selector)) {
      return legacyPinRequired(rootAgentId, `a mutable selector for root agent "${rootAgentId}"`);
    }
  }
  const versionIds = [...new Set(selectors.map(selector => selector.versionId))];
  if (versionIds.length > 1) {
    throw new MastraError({
      id: 'PINNED_VERSION_CONFLICT',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent "${rootAgentId}" continuation supplied conflicting exact root versions.`,
      details: { agentId: rootAgentId, requestedVersionIds: versionIds.join(', ') },
    });
  }
  return versionIds[0] ? { agentId: rootAgentId, versionId: versionIds[0] } : undefined;
}

/** @internal Merge exact legacy bridges from separate option/context sources. */
export function mergeLegacyContinuationRootPins(
  rootAgentId: string,
  ...pins: Array<ResolvedAgentVersionSelection | undefined>
): ResolvedAgentVersionSelection | undefined {
  const selected = pins.find((pin): pin is ResolvedAgentVersionSelection => pin !== undefined);
  if (!selected) return undefined;
  for (const pin of pins) {
    if (pin && pin.versionId !== selected.versionId) {
      assertContinuationSelectorMatchesPin({ versionId: pin.versionId }, selected);
    }
  }
  return selected;
}

/** @internal Validate every caller-supplied continuation override against frozen run state. */
export function assertContinuationVersionOverrides(
  overrides: VersionOverrides | undefined,
  pins: AgentVersionPins,
  rootAgentId: string,
): void {
  if (!overrides) return;

  const assertAgentSelector = (
    agentId: string,
    selector: VersionSelector | undefined,
    pin: ResolvedAgentVersionSelection | undefined,
  ) => {
    if (!selector) return;
    if (!pin) return unpinnedContinuationConflict(agentId, selector);
    assertContinuationSelectorMatchesPin(selector, pin);
  };

  assertAgentSelector(rootAgentId, overrides.self, pins.root);
  for (const [agentId, selector] of Object.entries(overrides.agents ?? {})) {
    assertAgentSelector(agentId, selector, agentId === rootAgentId ? pins.root : pins.agents?.[agentId]);
  }

  if (overrides.defaultStatus !== undefined && overrides.defaultStatus !== pins.defaultStatus) {
    throw new MastraError({
      id: 'PINNED_VERSION_CONFLICT',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent run dependency status is frozen and cannot change during continuation.`,
      details: {
        agentId: rootAgentId,
        ...(pins.defaultStatus ? { pinnedDefaultStatus: pins.defaultStatus } : {}),
        requestedDefaultStatus: overrides.defaultStatus,
      },
    });
  }
}
