"use client";
import { useState, useEffect, useSyncExternalStore } from "react";
import { CopilotKit } from "@copilotkit/react-core/v2";
import {
  bootstrap,
  selectionKey,
  selectedSession,
  subscribe,
  value,
  unavailable,
} from "./session.ts";
import { Explorer } from "./explorer.tsx";

export default function WorkspaceClient() {
  const loaded = useSyncExternalStore(subscribe, value, unavailable);
  const snapshot = loaded.snapshot;
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void bootstrap.load(selectedSession(), controller.signal).catch(() => {
      if (controller.signal.aborted) return;
      bootstrap.state = {
        error:
          "Could not open the saved chat. Check the local agent and storage, or open the initial chat.",
      };
      for (const subscriber of bootstrap.subscribers) subscriber();
    });
    return () => controller.abort();
  }, [retry]);
  if (!snapshot)
    return (
      <header>
        <h1>Mastra GenUI Data Explorer</h1>
        <p role="status">{loaded.error ?? "Loading the saved local workspace…"}</p>
        <button onClick={() => setRetry(retry + 1)}>Retry connection</button>
        <button
          onClick={() => {
            try {
              localStorage.removeItem(selectionKey);
            } catch {
              /* Storage may be disabled. */
            }
            setRetry(retry + 1);
          }}
        >
          Open initial chat
        </button>
      </header>
    );
  return (
    <CopilotKit
      key={snapshot.workspace.id}
      runtimeUrl="/api/copilotkit"
      agentId="dataExplorer"
      useSingleEndpoint={false}
      enableInspector={false}
      properties={{ baseRevision: snapshot.workspace.revision }}
    >
      <Explorer initial={snapshot} />
    </CopilotKit>
  );
}
