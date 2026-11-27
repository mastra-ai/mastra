import { DocumentEditorBodySkeleton } from './document-editor-body-skeleton';
import { DocumentEditorHeader } from './document-editor-header';
import { DocumentEditorMain } from './document-editor-main';
import { DocumentEditorRoot } from './document-editor-root';

export const DocumentEditor = Object.assign(DocumentEditorRoot, {
  Main: DocumentEditorMain,
  Header: DocumentEditorHeader,
  BodySkeleton: DocumentEditorBodySkeleton,
});
export type { DocumentEditorProps } from './document-editor-root';
export type { DocumentEditorMainProps } from './document-editor-main';
export type { DocumentEditorHeaderProps } from './document-editor-header';
