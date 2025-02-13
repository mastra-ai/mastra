import { cn } from '@/lib/utils';

export function ScoreIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const getScoreColor = (score: number) => {
    if (score < 0.6) return 'bg-red-500';
    if (score < 0.8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2.5 h-2.5 rounded-full', getScoreColor(score))} aria-label={`Score: ${percentage}%`} />
      <span className="text-sm text-mastra-el-4">{percentage}%</span>
    </div>
  );
}
