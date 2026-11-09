/* eslint-disable react-refresh/only-export-components -- the provider and its hook share one context */
import { nanoid } from 'nanoid';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import type { AnnotationSource } from './annotatable-selection';
import { normalizeAnnotationText } from './format-annotated-message';

export interface ChatAnnotation {
  id: string;
  text: string;
  source: AnnotationSource;
  comment?: string;
}

export const visibleComment = (annotation: ChatAnnotation) => annotation.comment?.trim() || undefined;

export type NewChatAnnotation = Pick<ChatAnnotation, 'text' | 'source'>;

export interface ChatAnnotationsApi {
  /** In the order they were added: an annotation's number is its position. */
  annotations: ChatAnnotation[];
  /** Ignores blank text and a passage already waiting. */
  addAnnotation: (annotation: NewChatAnnotation) => void;
  removeAnnotation: (id: string) => void;
  setAnnotationComment: (id: string, comment: string) => void;
  /** Hands every waiting annotation to the message being sent and clears them from the chat. */
  takeAnnotations: () => ChatAnnotation[];
  /** Puts the annotations of a message that failed to send back, ahead of any added since. */
  restoreAnnotations: (annotations: readonly ChatAnnotation[]) => void;
}

const ChatAnnotationsContext = createContext<ChatAnnotationsApi | undefined>(undefined);

const samePassage = (a: AnnotationSource, b: AnnotationSource) =>
  a.element === b.element && a.start === b.start && a.end === b.end;

/** Mount it below whatever remounts when the thread changes, so annotations stay with their thread. */
export function ChatAnnotationsProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<ChatAnnotation[]>([]);

  const value: ChatAnnotationsApi = {
    annotations,
    addAnnotation: ({ text, source }) => {
      const annotation = { text: normalizeAnnotationText(text), source };
      if (!annotation.text) return;
      setAnnotations(current =>
        current.some(waiting => samePassage(waiting.source, source))
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
      const taken = new Set(annotations.map(annotation => annotation.id));
      setAnnotations(current => current.filter(annotation => !taken.has(annotation.id)));
      return annotations;
    },
    restoreAnnotations: restored =>
      setAnnotations(current => {
        const kept = new Set(current.map(annotation => annotation.id));
        return [...restored.filter(annotation => !kept.has(annotation.id)), ...current];
      }),
  };

  return <ChatAnnotationsContext.Provider value={value}>{children}</ChatAnnotationsContext.Provider>;
}

export function useChatAnnotations(): ChatAnnotationsApi {
  const value = useContext(ChatAnnotationsContext);
  if (!value) throw new Error('useChatAnnotations must be used within a ChatAnnotationsProvider');
  return value;
}
