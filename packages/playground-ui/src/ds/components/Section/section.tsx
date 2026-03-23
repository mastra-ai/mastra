import { SectionHeader } from './section-header';
import { SectionHeading } from './section-heading';
import { SectionRoot } from './section-root';

export { type SectionRootProps as SectionProps } from './section-root';

export const Section = Object.assign(SectionRoot, {
  Header: SectionHeader,
  Heading: SectionHeading,
});
