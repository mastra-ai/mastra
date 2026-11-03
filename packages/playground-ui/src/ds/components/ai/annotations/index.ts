// Wired to ChatAnnotationsProvider: what Studio and Factory render.
export { ChatAnnotationsProvider, useChatAnnotations } from './chat-annotations';
export type { AnnotationSource, ChatAnnotation, ChatAnnotationsApi, NewChatAnnotation } from './chat-annotations';
export { TranscriptAnnotations } from './transcript-annotations';
export type { TranscriptAnnotationsProps } from './transcript-annotations';
export { ComposerAnnotations } from './composer-annotations';
export { formatAnnotatedMessage, normalizeAnnotationText } from './format-annotated-message';
export type { AnnotatedPassage } from './format-annotated-message';

// The parts, driven by props, for a layout the wired pieces do not fit.
export { AnnotationMarkers } from './annotation-markers';
export type { AnnotationMarkersProps } from './annotation-markers';
export { AnnotationSelectionToolbar } from './annotation-selection-toolbar';
export type { AnnotationSelectionToolbarProps } from './annotation-selection-toolbar';
export { ComposerAnnotationList } from './composer-annotation-list';
export type { ComposerAnnotationListProps } from './composer-annotation-list';
