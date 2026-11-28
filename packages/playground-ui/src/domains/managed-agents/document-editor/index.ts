import { DocumentEditorBodySkeleton } from './document-editor-body-skeleton';
import { DocumentEditorDetails } from './document-editor-details';
import { DocumentEditorFact } from './document-editor-fact';
import { DocumentEditorHeader } from './document-editor-header';
import { DocumentEditorMain } from './document-editor-main';
import { DocumentEditorRoot } from './document-editor-root';
import { DocumentEditorSection } from './document-editor-section';

export const DocumentEditor = Object.assign(DocumentEditorRoot, {
  Main: DocumentEditorMain,
  Header: DocumentEditorHeader,
  BodySkeleton: DocumentEditorBodySkeleton,
  Details: DocumentEditorDetails,
  Section: DocumentEditorSection,
  Fact: DocumentEditorFact,
});
export type { DocumentEditorProps } from './document-editor-root';
export type { DocumentEditorMainProps } from './document-editor-main';
export type { DocumentEditorHeaderProps } from './document-editor-header';
export type { DocumentEditorDetailsProps } from './document-editor-details';
export type { DocumentEditorSectionProps } from './document-editor-section';
export type { DocumentEditorFactProps } from './document-editor-fact';
