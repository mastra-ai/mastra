/* eslint-disable react-refresh/only-export-components -- the provider and its hook share one context */
import { nanoid } from 'nanoid';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import type { AnnotationSource } from './annotatable-selection';
import { normalizeAnnotationText } from './format-annotated-message';

export type { AnnotationSource } from './annotatable-selection';

/** A passage waiting to go out with the next message. People see it as a numbered annotation. */
export interface ChatAnnotation {
  id: string;
  text: string;
  /** Where it was selected, so the transcript can mark it. */
  source?: AnnotationSource;
  /** What the person said about the passage; it goes out with it. */
  comment?: string;
}

export type NewChatAnnotation = Pick<ChatAnnotation, 'text' | 'source'>;

export interface ChatAnnotationsApi {
  /** Annotations waiting for the next message, in the order they were added. Their number is their position. */
  annotations: ChatAnnotation[];
  /** Adds an annotation. Blank text, and a passage already waiting, are ignored. */
  addAnnotation: (annotation: NewChatAnnotation) => void;
  removeAnnotation: (id: string) => void;
  setAnnotationComment: (id: string, comment: string) => void;
  /** Hands every waiting annotation to the message being sent and clears them from the chat. */
  takeAnnotations: () => ChatAnnotation[];
  /** Puts annotations from a message that failed to send back, ahead of any added since. */
  restoreAnnotations: (annotations: readonly ChatAnnotation[]) => void;
}

const ChatAnnotationsContext = createContext<ChatAnnotationsApi | undefined>(undefined);

const samePassage = (a: NewChatAnnotation, b: NewChatAnnotation) =>
  a.source && b.source
    ? a.source.element === b.source.element && a.source.start === b.source.start && a.source.end === b.source.end
    : a.text === b.text;

/**
 * Shares annotations between the transcript that adds them and the composer that sends them. Mount it
 * once per conversation, below whatever remounts when the thread changes, so annotations stay with
 * their thread.
 */
export function ChatAnnotationsProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<ChatAnnotation[]>([]);

  const value: ChatAnnotationsApi = {
    annotations,
    addAnnotation: ({ text, source }) => {
      const annotation = { text: normalizeAnnotationText(text), source };
      if (!annotation.text) return;
      setAnnotations(current =>
        current.some(waiting => samePassage(waiting, annotation))
          ? current
          : [...current, { id: nanoid(), ...annotation }],
      );
    },
    removeAnnotation: id => setAnnotations(current => current.filter(annotation => annotation.id !== id)),
    setAnnotationComment: (id, comment) =>
      setAnnotations(current =>
        current.map(annotation => (annotation.id === id ? { ...annotation, comment } : annotation)),
      ),
    takeAnnotations: () => {
      const taken = annotations;
      setAnnotations(current => current.filter(annotation => !taken.includes(annotation)));
      return taken;
    },
    restoreAnnotations: restored =>
      setAnnotations(current => [
        ...restored.filter(annotation => !current.some(kept => kept.id === annotation.id)),
        ...current,
      ]),
  };

  return <ChatAnnotationsContext.Provider value={value}>{children}</ChatAnnotationsContext.Provider>;
}

export function useChatAnnotations(): ChatAnnotationsApi {
  const value = useContext(ChatAnnotationsContext);
  if (!value) throw new Error('useChatAnnotations must be used within a ChatAnnotationsProvider');
  return value;
}
