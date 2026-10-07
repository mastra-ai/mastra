"use client";
import {
  useState,
  useRef,
  useId,
  useSyncExternalStore,
  useEffect,
  createContext,
  useContext,
} from "react";
import {
  CopilotKit,
  CopilotChat,
  CopilotChatInput,
  CopilotChatAssistantMessage,
  useAgent,
  useCopilotKit,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import {
  workspaceSchema,
  chatSessionSchema,
  sessionIdSchema,
  workspaceId,
  overviewFor,
  savedCardTurn,
} from "../workspace/contracts.ts";
import type { WorkspaceAction, WorkspaceSnapshot } from "../workspace/contracts.ts";
import { components } from "./catalog.ts";
import type { ComponentDeclaration } from "./catalog.ts";
import { RegisteredView } from "./renderers.tsx";
import { periodLabel, viewTitle } from "./format.ts";
import type {
  CopilotChatInputProps,
  CopilotChatAssistantMessageProps,
} from "@copilotkit/react-core/v2";

const snapshotSchema = z.strictObject({
  sessions: z.array(chatSessionSchema),
  lastRequest: z.strictObject({ question: z.string(), requestId: z.string() }).optional(),
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
const selectionKey = "explorer-chat";
function selectedSession() {
  try {
    return sessionIdSchema.parse(localStorage.getItem(selectionKey) ?? workspaceId);
  } catch {
    return workspaceId;
  }
}
interface BootstrapState {
  snapshot?: WorkspaceSnapshot;
  error?: string;
}
const bootstrap = {
  state: initialState(),
  subscribers: new Set<() => void>(),
  generation: 0,
  accept(snapshot: WorkspaceSnapshot) {
    bootstrap.generation++;
    bootstrap.state = { snapshot };
    try {
      localStorage.setItem(selectionKey, snapshot.workspace.id);
    } catch {
      /* Storage may be disabled. */
    }
    for (const subscriber of bootstrap.subscribers) subscriber();
  },
  async load(id = selectedSession(), signal?: AbortSignal) {
    const generation = ++bootstrap.generation;
    try {
      const response = await fetch(`/api/workspace?session=${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: signal ?? null,
      });
      if (!response.ok)
        throw new Error(
          "Could not open this saved chat. Check the local agent and storage, then retry.",
        );
      const snapshot = snapshotSchema.parse(await response.json());
      if (generation === bootstrap.generation && !signal?.aborted) bootstrap.accept(snapshot);
    } catch (error) {
      if (generation === bootstrap.generation && !signal?.aborted) throw error;
    }
  },
};
function subscribe(subscriber: () => void) {
  bootstrap.subscribers.add(subscriber);
  return () => {
    bootstrap.subscribers.delete(subscriber);
  };
}
function initialState(): BootstrapState {
  return {};
}
const initialBootstrap: BootstrapState = {};
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
function Explorer({ initial }: { initial: WorkspaceSnapshot }) {
  const { agent, isReady } = useAgent({
    agentId: "workspace-agent",
    runtimeAgentId: "dataExplorer",
    threadId: initial.workspace.threadId,
  });
  const { copilotkit } = useCopilotKit();
  const [notice, setNotice] = useState<string>();
  const [switching, setSwitching] = useState(false);
  const sessionTransition = useRef(false);
  const [dismissedFeedback, setDismissedFeedback] = useState<string>();
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const selected =
      localStorage.getItem("explorer-theme") ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(selected);
    document.documentElement.dataset.theme = selected;
    document.documentElement.classList.toggle("dark", selected === "dark");
  }, []);
  const [correction, setCorrection] = useState<{ componentId: string; reason: string }>();
  useEffect(() => {
    const subscription = agent.subscribe({
      onStateChanged: ({ state }) => {
        const parsed = snapshotSchema.safeParse(state);
        if (parsed.success) {
          copilotkit.setProperties({ baseRevision: parsed.data.workspace.revision });
          setCorrection(undefined);
          setNotice(undefined);
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
  useRenderTool({ name: "*", render: () => null });
  useEffect(() => {
    if (snapshot.status !== "working") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/workspace?session=${encodeURIComponent(snapshot.workspace.id)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (response.ok && !controller.signal.aborted && !agent.isRunning) {
          const latest = snapshotSchema.parse(await response.json());
          if (latest.status !== "working" && !controller.signal.aborted && !agent.isRunning) {
            agent.setMessages(latest.workspace.messages);
            agent.setState(latest);
            return;
          }
        }
      } catch {
        /* Keep the accepted view while the local server reconnects. */
      }
      if (!controller.signal.aborted)
        timer = setTimeout(() => {
          void refresh();
        }, 500);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [agent, snapshot.workspace.id, snapshot.status]);

  useEffect(() => {
    if (snapshot.status !== "saved") return;
    const frame = requestAnimationFrame(() => {
      for (const binding of snapshot.workspace.components) {
        const card = document.querySelector<HTMLElement>(
          `[data-result="${CSS.escape(binding.resultId)}"]`,
        );
        if (!card || !card.getBoundingClientRect().width) continue;
        void fetch(`/api/workspace?session=${encodeURIComponent(snapshot.workspace.id)}`, {
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
  const changeSession = async (id?: string) => {
    if (sessionTransition.current || id === snapshot.workspace.id) return;
    sessionTransition.current = true;
    setSwitching(true);
    setNotice(undefined);
    try {
      if (agent.isRunning) await copilotkit.stopAgent({ agent });
      if (id) await bootstrap.load(id);
      else {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        if (!response.ok) throw new Error();
        bootstrap.accept(snapshotSchema.parse(await response.json()));
      }
    } catch {
      setNotice(
        "Could not change chats. Your saved conversations are preserved. Check the local server and retry.",
      );
    } finally {
      sessionTransition.current = false;
      setSwitching(false);
    }
  };
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
    setNotice(undefined);
    setDismissedFeedback(undefined);
    const correction = { componentId, reason };
    setCorrection(correction);
    copilotkit.setProperties({ baseRevision: snapshot.workspace.revision, correction });
  };
  const feedbackKey = `${snapshot.workspace.revision}:${snapshot.status}:${snapshot.message}:${notice ?? ""}:${correction?.componentId ?? ""}`;
  const clearCorrection = () => {
    setCorrection(undefined);
    copilotkit.setProperties({ baseRevision: snapshot.workspace.revision });
  };
  return (
    <ViewContext.Provider
      value={{
        snapshot,
        act,
        correct,
        correction,
        notice,
        dismissFeedback: () => {
          setDismissedFeedback(feedbackKey);
          clearCorrection();
        },
        feedbackVisible:
          dismissedFeedback !== feedbackKey &&
          (Boolean(notice) ||
            Boolean(correction) ||
            snapshot.status !== "saved" ||
            snapshot.message.startsWith("A saved renderer changed.")),
        isRunning: agent.isRunning || switching,
        isSwitching: switching,
      }}
    >
      <header className="app-header">
        <div>
          <h1>Mastra GenUI Data Explorer</h1>
          <p>Ask about Sales. Explore the results with charts, comparisons and records.</p>
        </div>
        <div className="chat-session-actions">
          <label className="chat-history">
            Chat history
            <select
              aria-label="Chat history"
              value={snapshot.workspace.id}
              disabled={switching || !isReady}
              onChange={(event) => {
                void changeSession(event.target.value);
              }}
            >
              {snapshot.sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={switching || !isReady}
            onClick={() => {
              void changeSession();
            }}
          >
            {switching ? "Opening chat…" : "New chat"}
          </button>
          <button
            onClick={() => {
              const selected = theme === "dark" ? "light" : "dark";
              setTheme(selected);
              document.documentElement.dataset.theme = selected;
              document.documentElement.classList.toggle("dark", selected === "dark");
              localStorage.setItem("explorer-theme", selected);
            }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>
      <main>
        <section className="chat" aria-label="Copilot conversation">
          <div className="conversation-status" role="status">
            Revision {snapshot.workspace.revision} ·{" "}
            {snapshot.status === "saved" ? "Saved locally" : "Last complete revision preserved"}
          </div>
          <CopilotChat
            agentId="workspace-agent"
            threadId={initial.workspace.threadId}
            labels={{ chatInputPlaceholder: "Ask about Sales…" }}
            input={ConversationInputSlot}
            onSubmitMessage={() => {
              setNotice(undefined);
              setDismissedFeedback(undefined);
            }}
            onError={() =>
              setNotice(
                "The request could not finish. Check the local server and connection, then retry.",
              )
            }
            messageView={{
              assistantMessage: ConversationAnswerSlot,
              children: ({ messageElements }) => (
                <div className="conversation-messages">
                  <EarlierViews />
                  {snapshot.workspace.messages.length === 0 && (
                    <div className="empty">
                      <h2>Start with a question</h2>
                      <p>
                        Try “Show a chart of last month sales” or “Compare bookings by segment”.
                      </p>
                    </div>
                  )}
                  {messageElements}
                  {snapshot.status === "incomplete" && (
                    <div className="failed-turn" data-turn={snapshot.lastRequest?.requestId}>
                      {snapshot.lastRequest && (
                        <p className="failed-question">{snapshot.lastRequest.question}</p>
                      )}
                      <p role="alert">{snapshot.message}</p>
                    </div>
                  )}
                </div>
              ),
            }}
          />
        </section>
      </main>
    </ViewContext.Provider>
  );
}
interface ViewState {
  snapshot: WorkspaceSnapshot;
  act: (action: WorkspaceAction) => Promise<void>;
  correct: (componentId: string, reason: string) => void;
  correction?: { componentId: string; reason: string } | undefined;
  notice?: string | undefined;
  feedbackVisible: boolean;
  dismissFeedback: () => void;
  isRunning: boolean;
  isSwitching: boolean;
}
const ViewContext = createContext<ViewState | undefined>(undefined);
function useView() {
  const view = useContext(ViewContext);
  if (!view) throw new Error("Conversation views require a workspace.");
  return view;
}
function ConversationInput(props: CopilotChatInputProps) {
  const {
    snapshot,
    notice,
    correction,
    correct,
    feedbackVisible,
    dismissFeedback,
    isRunning,
    isSwitching,
  } = useView();
  const submitting = useRef(false);
  const [applying, setApplying] = useState(false);
  const busy = isRunning || applying;
  const applyCorrection = async () => {
    const reason = correction?.reason.trim();
    if (!correction || !reason || busy || submitting.current || !props.onSubmitMessage) return;
    submitting.current = true;
    setApplying(true);
    correct(correction.componentId, reason);
    try {
      await props.onSubmitMessage(reason);
    } finally {
      submitting.current = false;
      setApplying(false);
    }
  };
  return (
    <div className="composer-area">
      {isRunning && (
        <p className="run-status" role="status">
          Reading the source and preparing your view…
        </p>
      )}
      {feedbackVisible && (
        <div
          className="notice"
          role={snapshot.status === "incomplete" || notice ? "alert" : "status"}
          data-status={snapshot.status}
        >
          <button
            className="close-feedback"
            aria-label="Close feedback"
            disabled={busy}
            onClick={dismissFeedback}
          >
            ×
          </button>
          <p>
            {notice ??
              (correction
                ? "Describe what to change, then apply the correction to this view."
                : snapshot.message)}
          </p>
          {correction && (
            <form
              className="correction-form"
              onSubmit={(event) => {
                event.preventDefault();
                void applyCorrection();
              }}
            >
              <label>
                Correction reason
                <input
                  aria-label="Correction reason"
                  placeholder="For example, show bookings for last month"
                  maxLength={300}
                  disabled={busy}
                  value={correction.reason}
                  onChange={(event) => correct(correction.componentId, event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !correction.reason.trim() || !props.onSubmitMessage}
              >
                {busy ? "Applying correction…" : "Apply correction"}
              </button>
            </form>
          )}
          {snapshot.status !== "saved" && (
            <button onClick={() => location.reload()}>Reload saved workspace</button>
          )}
        </div>
      )}
      <CopilotChatInput
        {...props}
        isRunning={Boolean(props.isRunning) || busy}
        {...(props.onSubmitMessage
          ? {
              onSubmitMessage: (value: string) => {
                if (!submitting.current && !isSwitching) return props.onSubmitMessage?.(value);
              },
            }
          : {})}
      />
    </div>
  );
}
function ConversationAnswer(props: CopilotChatAssistantMessageProps) {
  const { snapshot } = useView();
  const turn = props.message.id.replace(/-answer$/, "");
  const bindings =
    snapshot.status === "recovery-required"
      ? []
      : snapshot.workspace.components.filter(
          (item) => savedCardTurn(snapshot.workspace, item.id) === turn,
        );
  if (!bindings.length) return <CopilotChatAssistantMessage {...props} toolbarVisible={false} />;
  return (
    <div className="visual-answer" data-turn={turn}>
      {bindings.map((binding) => (
        <ResultCard key={`${binding.id}-${binding.resultId}`} componentId={binding.id} />
      ))}
    </div>
  );
}
function EarlierViews() {
  const { snapshot } = useView();
  if (snapshot.status === "recovery-required")
    return (
      <p role="alert">Saved results are unavailable until the matching dataset is restored.</p>
    );
  const visibleTurns = new Set(
    snapshot.workspace.messages
      .filter((item) => item.role === "assistant")
      .map((item) => item.id.replace(/-answer$/, "")),
  );
  const earlier = snapshot.workspace.components.filter(
    (item) => !visibleTurns.has(savedCardTurn(snapshot.workspace, item.id) ?? ""),
  );
  return earlier.length ? (
    <section aria-label="Earlier saved views">
      <h2>Earlier saved views</h2>
      {earlier.map((item) => (
        <ResultCard key={`${item.id}-${item.resultId}`} componentId={item.id} />
      ))}
    </section>
  ) : null;
}
function ResultCard({ componentId }: { componentId: string }) {
  const { snapshot, act, correct, isRunning } = useView();
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();
  const binding = snapshot.workspace.components.find((item) => item.id === componentId);
  const result = snapshot.workspace.results.find((item) => item.resultId === binding?.resultId);
  const registered = components.find((item) => item.id === binding?.component);
  const configured = snapshot.catalog?.find((item) => item.id === binding?.component);
  if (!binding || !result || !registered)
    return <p role="alert">This saved view is unavailable. Restore its configuration.</p>;
  const capability = snapshot.workspace.source.capabilities.find(
    (item) => item.metric === result.data.metric,
  );
  const entry: ComponentDeclaration = {
    ...registered,
    actions: registered.actions.filter(
      (action) => action !== "drill" || capability?.fields.includes("records"),
    ),
    enabled: true,
    ...(configured ? { defaults: configured.defaults } : {}),
  };
  const title = viewTitle(result.data);
  const titled = { ...binding, properties: { ...binding.properties, title } };
  return (
    <article className="card" data-component={binding.component} data-result={binding.resultId}>
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p className="period">{periodLabel(result.data)}</p>
          {Object.keys(result.data.request.filters ?? {}).length > 0 && (
            <p className="cohort-label">
              {Object.entries(result.data.request.filters ?? {})
                .map(([field, value]) =>
                  field === "ownerId" ? `Sales representative ${value}` : String(value),
                )
                .join(" · ")}
            </p>
          )}
        </div>
        <button
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      <div id={bodyId} hidden={collapsed}>
        {binding.properties.scenario && <p>Illustrative scenario · not guaranteed revenue</p>}
        <RegisteredView
          binding={titled}
          result={result}
          declaration={entry}
          act={(action) => {
            void act(action);
          }}
        />
        <div className="controls">
          {overviewFor(snapshot.workspace, binding.id) && (
            <button
              disabled={isRunning}
              onClick={() => {
                void act({ type: "back", componentId: binding.id });
              }}
            >
              Back to overview
            </button>
          )}
          <button
            disabled={isRunning}
            title="Describe a change and apply it to update this view. Source records remain unchanged."
            onClick={() => correct(binding.id, "")}
          >
            Correct this view
          </button>
          {entry.actions.includes("filter") && capability?.filters.includes("segment") && (
            <label>
              Segment filter
              <select
                aria-label={`Segment filter ${title}`}
                disabled={isRunning}
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
          {entry.actions.includes("compare") && capability?.filters.includes("segment") && (
            <button
              disabled={isRunning}
              onClick={() => {
                void act({ type: "compare", componentId: binding.id, segment: "Enterprise" });
              }}
            >
              Compare Enterprise
            </button>
          )}
        </div>
        <details className="source-details">
          <summary>Source details</summary>
          <p>{capability?.description}</p>
          <p>Source: {snapshot.workspace.source.title}</p>
          {Object.keys(result.data.request.filters ?? {}).length > 0 && (
            <p>
              {Object.entries(result.data.request.filters ?? {})
                .map(([key, value]) => `${key}: ${value}`)
                .join(" · ")}
            </p>
          )}
        </details>
      </div>
    </article>
  );
}

const ConversationInputSlot = Object.assign(ConversationInput, CopilotChatInput);
const ConversationAnswerSlot = Object.assign(ConversationAnswer, CopilotChatAssistantMessage);
