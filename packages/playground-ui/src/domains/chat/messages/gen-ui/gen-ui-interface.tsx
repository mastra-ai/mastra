import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer, buildSpecFromParts, defineRegistry } from '@json-render/react';
import type { DataPart } from '@json-render/react';
import { studioCatalog } from '@mastra/json-render/studio';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  /** Disables the interface's controls, e.g. while the reply is still streaming. */
  disabled?: boolean;
}

/**
 * Renders the interface an agent composed in its reply with `studioCatalog`. The interface keeps
 * its own state (form values); its `sendMessage` action passes that state back to the agent.
 */
export function GenUiInterface({ parts, onSend, disabled = false }: GenUiInterfaceProps) {
  // buildSpecFromParts mutates nested objects of the parts it reads.
  const spec = useMemo(() => buildSpecFromParts(structuredClone(parts)), [parts]);
  const [store] = useState(() => createStateStore(spec?.state ?? {}));

  // A streaming spec can declare its state after the store was created: seed what's still missing.
  useEffect(() => {
    const initial = spec?.state;
    if (!initial) return;
    const current = store.getSnapshot();
    const missing = Object.fromEntries(
      Object.entries(initial)
        .filter(([key]) => !(key in current))
        .map(([key, value]) => [`/${key}`, value]),
    );
    if (Object.keys(missing).length > 0) store.update(missing);
  }, [spec?.state, store]);

  const sendRef = useRef(onSend);
  useEffect(() => {
    sendRef.current = onSend;
  }, [onSend]);

  const { registry, handlers } = useMemo(
    () =>
      defineRegistry(studioCatalog, {
        components: studioComponents,
        actions: {
          sendMessage: async (params, _setState, state) => {
            if (params?.message) sendRef.current?.(params.message, state);
          },
        },
      }),
    [],
  );
  const actionHandlers = useMemo(() => handlers(() => undefined, store.getSnapshot), [handlers, store]);

  if (!spec) return null;

  return (
    <GenUiInteractiveContext.Provider value={Boolean(onSend) && !disabled}>
      <div data-slot="gen-ui-interface" className="@container min-w-0">
        <JSONUIProvider registry={registry} store={store} handlers={actionHandlers}>
          <Renderer spec={spec} registry={registry} />
        </JSONUIProvider>
      </div>
    </GenUiInteractiveContext.Provider>
  );
}
