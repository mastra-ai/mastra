import { SideDialogCodeSection } from './side-dialog-code-section';
import { SideDialogContent } from './side-dialog-content';
import { SideDialogHeader } from './side-dialog-header';
import { SideDialogHeading } from './side-dialog-heading';
import { SideDialogNav } from './side-dialog-nav';
import { SideDialogRoot } from './side-dialog-root';
import { SideDialogTop } from './side-dialog-top';

export { type SideDialogRootProps } from './side-dialog-root';

export const SideDialog = Object.assign(SideDialogRoot, {
  Top: SideDialogTop,
  Header: SideDialogHeader,
  Heading: SideDialogHeading,
  Content: SideDialogContent,
  CodeSection: SideDialogCodeSection,
  Nav: SideDialogNav,
});
