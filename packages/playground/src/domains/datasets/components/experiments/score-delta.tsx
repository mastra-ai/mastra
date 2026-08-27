import { Badge } from '@mastra/playground-ui/components/Badge';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

interface ScoreDeltaProps {
  delta: number;
}

function ScoreDeltaDirection({ delta }: ScoreDeltaProps) {
  if (delta > 0) {
    return <Badge aria-hidden="true" size="xs" variant="success" emphasis="muted" icon={<ArrowUpIcon />} />;
  }

  if (delta < 0) {
    return <Badge aria-hidden="true" size="xs" variant="error" emphasis="muted" icon={<ArrowDownIcon />} />;
  }

  return null;
}

function getDeltaSign(delta: number) {
  if (delta > 0) return '+ ';
  if (delta < 0) return '- ';
  return '';
}

export function ScoreDelta({ delta }: ScoreDeltaProps) {
  return (
    <span className="text-neutral4 min-w-20 font-mono text-sm">
      <span className="inline-block w-3">{getDeltaSign(delta)}</span>
      {Math.abs(delta).toFixed(2)}&nbsp;
      <ScoreDeltaDirection delta={delta} />
    </span>
  );
}
