import { SectionContent } from './section-content';
import { SectionDescription } from './section-description';
import { SectionDivider } from './section-divider';
import { SectionHeader } from './section-header';
import { SectionHeading } from './section-heading';
import { SectionRoot, type SectionRootProps } from './section-root';
import { SectionDestructiveRow, SectionRow, SectionViewOnlyRow } from './section-row';

export { type SectionVariant } from './section-context';
export { type SectionContentProps } from './section-content';
export { type SectionDescriptionProps } from './section-description';
export { type SectionDividerProps } from './section-divider';
export { type SectionHeaderProps } from './section-header';
export { type SectionHeadingProps } from './section-heading';
export { type SectionRootProps as SectionProps } from './section-root';
export { type SectionDestructiveRowProps, type SectionRowProps, type SectionViewOnlyRowProps } from './section-row';

export function Section(props: SectionRootProps) {
  return <SectionRoot {...props} />;
}

Section.Header = SectionHeader;
Section.Heading = SectionHeading;
Section.Description = SectionDescription;
Section.Content = SectionContent;
Section.Row = SectionRow;
Section.ViewOnlyRow = SectionViewOnlyRow;
Section.DestructiveRow = SectionDestructiveRow;
Section.Divider = SectionDivider;
