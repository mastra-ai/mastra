import { createStateStore } from '@json-render/core';
import type { Spec } from '@json-render/core';
import { JSONUIProvider, Renderer, buildSpecFromParts, defineRegistry } from '@json-render/react';
import type { DataPart } from '@json-render/react';
import { studioCatalog } from '@mastra/json-render/studio';
import { useEffect, useRef, useState } from 'react';
import { GenUiInteractiveContext } from './interactive-context';
import { studioComponents } from './studio-components';

export const SPEC_PART_TYPE = 'data-spec';

/** Sends `message` as the user's next turn, with the interface's current state. */
export type GenUiSend = (message: string, state: Record<string, unknown>) => void;

export interface GenUiInterfaceProps {
  /** The reply's `data-spec` parts, in order. */
  parts: DataPart[];
  /** Omit to render the interface read-only. */
  onSend?: GenUiSend;
  /** Disables the interface's controls, e.g. while the chat is replying. */
  disabled?: boolean;
}

function studioRegistry(onSend?: GenUiSend) {
  return defineRegistry(studioCatalog, {
    components: studioComponents,
    actions: {
      sendMessage: async (params, _setState, state) => {
        if (params?.message) onSend?.(params.message, state);
      },
    },
  });
}

const readOnlyRegistry = studioRegistry().registry;

/**
 * Renders the interface an agent composed in its reply with `studioCatalog`. Once it can act, the
 * interface keeps its own state (form values) and its `sendMessage` action passes it back to the agent.
 */
export function GenUiInterface({ parts, onSend, disabled = false }: GenUiInterfaceProps) {
  // Once live, stays live: disabling it while the chat replies must not reset what the user entered.
  const [wentLive, setWentLive] = useState(false);
  if (onSend && !disabled && !wentLive) setWentLive(true);

  // buildSpecFromParts mutates nested objects of the parts it reads.
  const spec = buildSpecFromParts(structuredClone(parts));
  if (!spec) return null;

  return (
    <div data-slot="gen-ui-interface" className="@container min-w-0">
      {onSend && (wentLive || !disabled) ? (
        <LiveInterface spec={spec} onSend={onSend} disabled={disabled} />
      ) : (
        <ReadOnlyInterface spec={spec} />
      )}
    </div>
  );
}

function ReadOnlyInterface({ spec }: { spec: Spec }) {
  // Uncontrolled: the provider follows the state a streaming spec declares as it arrives.
  return (
    <JSONUIProvider registry={readOnlyRegistry} initialState={spec.state}>
      <Renderer spec={spec} registry={readOnlyRegistry} />
    </JSONUIProvider>
  );
}

/**
 * Mounts once the interface can act, so its state starts from the complete spec, and keeps that state
 * from then on. json-render keeps the action handlers it mounts with, so they send through a ref to
 * the latest `onSend`.
 */
function LiveInterface({ spec, onSend, disabled }: { spec: Spec; onSend: GenUiSend; disabled: boolean }) {
  const onSendRef = useRef(onSend);
  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  const [live] = useState(() => {
    const store = createStateStore(spec.state ?? {});
    const { registry, handlers } = studioRegistry((message, state) => onSendRef.current(message, state));
    return { store, registry, handlers: handlers(() => undefined, store.getSnapshot) };
  });

  return (
    <GenUiInteractiveContext.Provider value={!disabled}>
      <JSONUIProvider registry={live.registry} store={live.store} handlers={live.handlers}>
        <Renderer spec={spec} registry={live.registry} />
      </JSONUIProvider>
    </GenUiInteractiveContext.Provider>
  );
}
