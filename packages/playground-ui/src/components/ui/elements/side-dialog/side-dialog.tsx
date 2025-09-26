import { SideDialogRoot } from './side-dialog-root';
import { SideDialogCodeSection } from './side-dialog-code-section';
import { SideDialogHeading } from './side-dialog-heading';
import { SideDialogContent } from './side-dialog-content';
import { SideDialogHeader } from './side-dialog-header';
import { SideDialogTop } from './side-dialog-top';

export const SideDialog = Object.assign(SideDialogRoot, {
  Top: SideDialogTop,
  Header: SideDialogHeader,
  Heading: SideDialogHeading,
  Content: SideDialogContent,
  CodeSection: SideDialogCodeSection,
});
