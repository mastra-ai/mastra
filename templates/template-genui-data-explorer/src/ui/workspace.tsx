"use client";
import { useState, useSyncExternalStore, useEffect } from "react";
import {
  CopilotKit,
  CopilotChat,
  useAgent,
  useCopilotKit,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import { workspaceSchema, threadId } from "../workspace/contracts.ts";
import type { WorkspaceAction, WorkspaceSnapshot } from "../workspace/contracts.ts";
import { compositionSchema, components } from "./catalog.ts";
import type { ComponentDeclaration } from "./catalog.ts";
import { RegisteredView } from "./renderers.tsx";

const snapshotSchema = z.strictObject({
  workspace: workspaceSchema,
  status: z.enum(["saved", "working", "incomplete", "recovery-required"]),
  message: z.string(),
  catalog: z
    .array(
      z.strictObject({
        id: z.string(),
        version: z.string(),
        defaults: z.strictObject({ pageSize: z.number().int() }),
      }),
    )
    .optional(),
});
interface Bootstrap {
  state: { snapshot?: WorkspaceSnapshot; error?: string };
  subscribers: Set<() => void>;
  load: () => Promise<void>;
}
const bootstrap: Bootstrap = {
  state: {},
  subscribers: new Set<() => void>(),
  load: async () => {
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (!response.ok) throw new Error();
      bootstrap.state = { snapshot: snapshotSchema.parse(await response.json()) };
    } catch {
      bootstrap.state = {
        error:
          "Could not load the saved workspace. Check the local agent and storage, then retry; saved data is preserved.",
      };
    }
    for (const subscriber of bootstrap.subscribers) subscriber();
  },
};
function subscribe(subscriber: () => void) {
  bootstrap.subscribers.add(subscriber);
  return () => {
    bootstrap.subscribers.delete(subscriber);
  };
}
const initialBootstrap: Bootstrap["state"] = {};
function value() {
  return bootstrap.state;
}
function unavailable() {
  return initialBootstrap;
}
export default function WorkspaceClient() {
  const loaded = useSyncExternalStore(subscribe, value, unavailable);
  const snapshot = loaded.snapshot;
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    void bootstrap.load();
  }, [retry]);
  if (!snapshot)
    return (
      <header>
        <h1>Mastra GenUI Data Explorer</h1>
        <p role="status">{loaded.error ?? "Loading the saved local workspace…"}</p>
        <button onClick={() => setRetry(retry + 1)}>Retry connection</button>
      </header>
    );
  return (
    <CopilotKit
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
function Explorer({ initial }: { initial: WorkspaceSnapshot }) {
  const { agent, isReady } = useAgent({
    agentId: "workspace-agent",
    runtimeAgentId: "dataExplorer",
    threadId,
  });
  const { copilotkit } = useCopilotKit();
  const [notice, setNotice] = useState<string>();
  const [correction, setCorrection] = useState<{ componentId: string; reason: string }>();
  useEffect(() => {
    const subscription = agent.subscribe({
      onStateChanged: ({ state }) => {
        const parsed = snapshotSchema.safeParse(state);
        if (parsed.success) {
          copilotkit.setProperties({ baseRevision: parsed.data.workspace.revision });
          setCorrection(undefined);
        }
      },
    });
    if (isReady) {
      agent.setMessages(initial.workspace.messages);
      agent.setState(initial);
    }
    return () => subscription.unsubscribe();
  }, [agent, isReady, copilotkit, initial]);
  const parsed = snapshotSchema.safeParse(agent.state);
  const snapshot = parsed.success ? parsed.data : initial;
  useRenderTool({
    name: "compose",
    parameters: compositionSchema,
    render: ({ status }) => (
      <p role="status">
        {status === "complete"
          ? "Composition prepared; only saved cards appear in the workspace."
          : "Validating composition…"}
      </p>
    ),
  });
  useRenderTool({ name: "*", render: () => <p>Reading and verifying source data…</p> });
  useEffect(() => {
    if (snapshot.status !== "saved") return;
    const frame = requestAnimationFrame(() => {
      for (const binding of snapshot.workspace.components) {
        const card = document.querySelector<HTMLElement>(
          `[data-result="${CSS.escape(binding.resultId)}"]`,
        );
        if (!card || !card.getBoundingClientRect().width) continue;
        void fetch("/api/workspace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: snapshot.workspace.revision,
            resultId: binding.resultId,
            componentId: binding.id,
          }),
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot]);
  const act = async (action: WorkspaceAction) => {
    setNotice(undefined);
    try {
      if (agent.isRunning) await copilotkit.stopAgent({ agent });
      await copilotkit.runAgent({
        agent,
        runId: crypto.randomUUID(),
        forwardedProps: { baseRevision: snapshot.workspace.revision, action },
      });
    } catch {
      setNotice("The interaction did not save. Reload the last accepted revision or retry.");
    }
  };
  const correct = (componentId: string, reason: string) => {
    const correction = { componentId, reason };
    setCorrection(correction);
    copilotkit.setProperties({ baseRevision: snapshot.workspace.revision, correction });
  };
  const declaration = (id: string): ComponentDeclaration | undefined => {
    const registered = components.find((entry) => entry.id === id);
    const configured = snapshot.catalog?.find((entry) => entry.id === id);
    return registered
      ? { ...registered, enabled: true, ...(configured ? { defaults: configured.defaults } : {}) }
      : undefined;
  };
  return (
    <>
      <header>
        <h1>Mastra GenUI Data Explorer</h1>
        <p>
          Ask about synthetic SaaS Sales. Mastra chooses registered views from verified source data.
          Completed cards and context survive reload and restart.
        </p>
      </header>
      <main>
        <section className="workspace" aria-label="Analytics workspace">
          <div role="status" className="notice" data-status={snapshot.status}>
            {notice ?? snapshot.message}
            <p>
              Revision {snapshot.workspace.revision} ·{" "}
              {snapshot.status === "saved" ? "Saved locally" : "Last complete revision preserved"}
            </p>
            <button onClick={() => location.reload()}>Reload saved workspace</button>
            {correction && (
              <label>
                Correction reason
                <input
                  aria-label="Correction reason"
                  maxLength={300}
                  value={correction.reason}
                  onChange={(event) => correct(correction.componentId, event.target.value)}
                />
                <p>
                  Ask a follow-up that replaces this accepted view. The reason is saved with an
                  accepted correction.
                </p>
              </label>
            )}
          </div>
          {snapshot.status === "recovery-required" ? (
            <p role="alert">
              Saved results are unavailable until the matching dataset is restored.
            </p>
          ) : snapshot.workspace.components.length === 0 ? (
            <div className="empty">
              <h2>Your workspace starts with a question</h2>
              <p>
                Try monthly bookings, a ranked segment comparison, or closed-opportunity records.
              </p>
            </div>
          ) : (
            snapshot.workspace.components.map((binding) => {
              const result = snapshot.workspace.results.find(
                (result) => result.resultId === binding.resultId,
              );
              const entry = declaration(binding.component);
              if (!result || !entry)
                return (
                  <article className="card" key={binding.id}>
                    <p role="alert">
                      This saved component is unavailable. Restore its configuration.
                    </p>
                  </article>
                );
              const filters =
                Object.entries(result.data.request.filters ?? {})
                  .map(([key, value]) => `${key}=${value}`)
                  .join(", ") || "None";
              return (
                <article
                  className="card"
                  key={`${binding.id}-${binding.resultId}`}
                  data-component={binding.component}
                  data-result={binding.resultId}
                >
                  <h2>{binding.properties.title}</h2>
                  {binding.properties.scenario && (
                    <p>Illustrative scenario · not guaranteed revenue</p>
                  )}
                  <RegisteredView
                    binding={binding}
                    result={result}
                    declaration={entry}
                    act={(action) => {
                      void act(action);
                    }}
                  />
                  <div className="controls">
                    <button
                      onClick={() =>
                        correct(binding.id, "Correct the interpretation of this accepted view.")
                      }
                    >
                      Correct this view
                    </button>
                    {entry.actions.includes("filter") && (
                      <label>
                        Segment filter
                        <select
                          aria-label={`Segment filter ${binding.properties.title}`}
                          value={String(result.data.request.filters?.segment ?? "")}
                          onChange={(event) => {
                            void act({
                              type: "filter",
                              componentId: binding.id,
                              field: "segment",
                              ...(event.target.value ? { value: event.target.value } : {}),
                            });
                          }}
                        >
                          <option value="">All segments</option>
                          <option>SMB</option>
                          <option>Mid-market</option>
                          <option>Enterprise</option>
                        </select>
                      </label>
                    )}
                    {entry.actions.includes("compare") && (
                      <button
                        onClick={() => {
                          void act({
                            type: "compare",
                            componentId: binding.id,
                            segment: "Enterprise",
                          });
                        }}
                      >
                        Compare Enterprise
                      </button>
                    )}
                  </div>
                  <div className="provenance">
                    <p>{result.explanation}</p>
                    <p>
                      Filters: {filters} · Source {result.data.provenance.sourceId} · Dataset{" "}
                      {result.data.provenance.datasetVersion} · Definition{" "}
                      {result.data.provenance.metricVersion} · Request {result.requestId}
                    </p>
                    {result.data.period && (
                      <p>
                        UTC coverage {result.data.period.start} to {result.data.period.end}{" "}
                        (exclusive). No categories omitted.
                      </p>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
        <aside className="chat" aria-label="Copilot conversation">
          <CopilotChat
            agentId="workspace-agent"
            threadId={threadId}
            labels={{ chatInputPlaceholder: "Ask about Sales…" }}
          />
        </aside>
      </main>
    </>
  );
}
