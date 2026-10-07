"use client";
import { useState, useRef, useEffect } from "react";
import { CopilotChat, useAgent, useCopilotKit, useRenderTool } from "@copilotkit/react-core/v2";
import { snapshotSchema } from "../workspace/contracts.ts";
import type { WorkspaceSnapshot, WorkspaceAction } from "../workspace/contracts.ts";
import { bootstrap } from "./session.ts";
import { ViewContext } from "./view-context.tsx";
import { ConversationInputSlot, ConversationAnswerSlot, EarlierViews } from "./conversation.tsx";

export function Explorer({ initial }: { initial: WorkspaceSnapshot }) {
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
