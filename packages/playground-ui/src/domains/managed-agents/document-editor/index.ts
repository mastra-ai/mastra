import {
  DocumentEditorBodySkeleton,
  DocumentEditorDetails,
  DocumentEditorFact,
  DocumentEditorHeader,
  DocumentEditorMain,
  DocumentEditorRoot,
  DocumentEditorSection,
} from './document-editor';

export const DocumentEditor = Object.assign(DocumentEditorRoot, {
  Main: DocumentEditorMain,
  Header: DocumentEditorHeader,
  BodySkeleton: DocumentEditorBodySkeleton,
  Details: DocumentEditorDetails,
  Section: DocumentEditorSection,
  Fact: DocumentEditorFact,
});
export type {
  DocumentEditorDetailsProps,
  DocumentEditorFactProps,
  DocumentEditorHeaderProps,
  DocumentEditorMainProps,
  DocumentEditorProps,
  DocumentEditorSectionProps,
} from './document-editor';
