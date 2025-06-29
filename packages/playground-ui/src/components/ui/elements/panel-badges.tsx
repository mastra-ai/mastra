import { Badge } from '@/ds/components/Badge/Badge';

type PanelBadgesProps = {
  badges?: { name: string; icon?: React.ReactNode }[];
  className?: string;
  style?: React.CSSProperties;
};

export function PanelBadges({ badges }: PanelBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2 text-[12px] text-icon3">
      {badges && badges.length > 0
        ? badges?.map(badge => (
            <Badge key={badge.name} icon={badge.icon}>
              {badge.name}
            </Badge>
          ))
        : 'Not defined'}
    </div>
  );
}
