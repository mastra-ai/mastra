import { Badge } from '@mastra/playground-ui/components/Badge';

function getBadgeVariant(label: string): 'success' | 'info' | 'default' {
  if (label === 'production') return 'success';
  if (label === 'latest') return 'info';
  return 'default';
}

export interface AgentVersionLabelBadgeProps {
  label: string;
}

export function AgentVersionLabelBadge({ label }: AgentVersionLabelBadgeProps) {
  return (
    <Badge
      role="listitem"
      aria-label={`${label} version label`}
      title={label}
      size="xs"
      variant={getBadgeVariant(label)}
      className="min-w-0"
    >
      <span className="truncate">{label}</span>
    </Badge>
  );
}
