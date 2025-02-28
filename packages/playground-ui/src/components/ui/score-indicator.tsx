import { Badge } from './badge';

export function ScoreIndicator({ score }: { score: number }) {
  return <Badge variant="secondary">{score.toFixed(2)}</Badge>;
}
