/* oxlint-disable react/only-export-components -- provider and its hooks intentionally share this module */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import type { ComposerAttachment } from './attachments/composer-attachments';

export interface AgentChatDraft {
  text: string;
  attachments: ComposerAttachment[];
}

export interface AgentChatDraftStatus {
  restoring?: boolean;
  saving?: boolean;
  error?: string;
}

export interface AgentChatThreadInput {
  threadInput: string;
  setThreadInput: Dispatch<SetStateAction<string>>;
  draft?: AgentChatDraft;
  updateDraft?: Dispatch<SetStateAction<AgentChatDraft>>;
  draftStatus?: AgentChatDraftStatus;
}

export interface AgentChatReadAloud {
  isSpeaking: boolean;
  readAloud: (text: string) => void;
  stop: () => void;
}

export interface AgentChatBrowser {
  hasSession: boolean;
  viewMode: string;
}

/**
 * Studio-only pieces. Nodes are pre-built by the host so this package never
 * imports voice, browser, or permission modules.
 */
export interface AgentChatSlots {
  LoadingSkeleton?: ComponentType;
  channelsCard?: (agentId: string) => ReactNode;
  browserThumbnail?: (agentName?: string) => ReactNode;
  modelWarning?: ReactNode;
  modelSwitcher?: ReactNode;
  modelSettings?: (agentId: string) => ReactNode;
  speechInput?: (props: { agentId?: string; onTranscript: (text: string) => void }) => ReactNode;
  voiceCallPanel?: ReactNode;
  voiceCallButton?: ReactNode;
}

export interface AgentChatObservationalMemory {
  setIsObservingFromStream: (value: boolean) => void;
  setIsReflectingFromStream: (value: boolean) => void;
  signalObservationsUpdated: () => void;
  setStreamProgress: (data: any) => void;
  markCycleIdActivated: (cycleId: string) => void;
}

export interface AgentChatFeatures {
  canExecute?: boolean;
  threadInput?: AgentChatThreadInput;
  readAloud?: AgentChatReadAloud;
  browser?: AgentChatBrowser;
  slots?: AgentChatSlots;
  observationalMemory?: AgentChatObservationalMemory;
  refreshWorkingMemory?: () => void | Promise<unknown>;
  modelOverride?: string;
}

const EMPTY_FEATURES: AgentChatFeatures = { canExecute: true };

const AgentChatFeaturesContext = createContext<AgentChatFeatures>(EMPTY_FEATURES);

export function AgentChatFeaturesProvider({ value, children }: { value: AgentChatFeatures; children: ReactNode }) {
  const parent = useContext(AgentChatFeaturesContext);
  const merged = useMemo(
    () => ({
      ...parent,
      ...value,
      slots: { ...parent.slots, ...value.slots },
    }),
    [parent, value],
  );
  return <AgentChatFeaturesContext.Provider value={merged}>{children}</AgentChatFeaturesContext.Provider>;
}

export function useAgentChatFeatures() {
  return useContext(AgentChatFeaturesContext);
}

const LocalThreadInputContext = createContext<AgentChatThreadInput | null>(null);

/** Shared composer state for hosts that do not persist drafts. */
export function FallbackThreadInputProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<AgentChatDraft>({ text: '', attachments: [] });
  const value = useMemo<AgentChatThreadInput>(
    () => ({
      threadInput: draft.text,
      setThreadInput: next => {
        setDraft(previous => ({
          ...previous,
          text: typeof next === 'function' ? next(previous.text) : next,
        }));
      },
      draft,
      updateDraft: setDraft,
    }),
    [draft],
  );
  return <LocalThreadInputContext.Provider value={value}>{children}</LocalThreadInputContext.Provider>;
}

export function useResolvedThreadInput(): AgentChatThreadInput {
  const { threadInput } = useAgentChatFeatures();
  const local = useContext(LocalThreadInputContext);
  if (threadInput) return threadInput;
  if (local) return local;
  throw new Error('Thread input is unavailable');
}

export const NOOP_OBSERVATIONAL_MEMORY: AgentChatObservationalMemory = {
  setIsObservingFromStream: () => {},
  setIsReflectingFromStream: () => {},
  signalObservationsUpdated: () => {},
  setStreamProgress: () => {},
  markCycleIdActivated: () => {},
};
