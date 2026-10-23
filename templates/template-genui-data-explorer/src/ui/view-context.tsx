"use client";
import { createContext, useContext } from "react";
import type { WorkspaceSnapshot, WorkspaceAction } from "../workspace/contracts.ts";

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
export const ViewContext = createContext<ViewState | undefined>(undefined);
export function useView() {
  const view = useContext(ViewContext);
  if (!view) throw new Error("Conversation views require a workspace.");
  return view;
}
