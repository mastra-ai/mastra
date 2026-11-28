import { DetailsCardChips } from './details-card-chips';
import { DetailsCardFact } from './details-card-fact';
import { DetailsCardRoot } from './details-card-root';
import { DetailsCardSection } from './details-card-section';
import { DetailsCardStat } from './details-card-stat';
import { DetailsCardStats } from './details-card-stats';

export const DetailsCard = Object.assign(DetailsCardRoot, {
  Section: DetailsCardSection,
  Fact: DetailsCardFact,
  Chips: DetailsCardChips,
  Stats: DetailsCardStats,
  Stat: DetailsCardStat,
});
export type { DetailsCardChipsProps } from './details-card-chips';
export type { DetailsCardFactProps } from './details-card-fact';
export type { DetailsCardProps } from './details-card-root';
export type { DetailsCardSectionProps } from './details-card-section';
export type { DetailsCardStatProps } from './details-card-stat';
