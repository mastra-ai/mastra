"use client";
import { useRef, useState } from "react";
import { CopilotChatInput, CopilotChatAssistantMessage } from "@copilotkit/react-core/v2";
import type {
  CopilotChatInputProps,
  CopilotChatAssistantMessageProps,
} from "@copilotkit/react-core/v2";
import { savedCardTurn } from "../workspace/contracts.ts";
import { useView } from "./view-context.tsx";
import { ResultCard } from "./result-card.tsx";

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
export function EarlierViews() {
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
export const ConversationInputSlot = Object.assign(ConversationInput, CopilotChatInput);
export const ConversationAnswerSlot = Object.assign(
  ConversationAnswer,
  CopilotChatAssistantMessage,
);
