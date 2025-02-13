export function ScoreIndicator({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-mastra-el-4">{score.toFixed(2)}</span>
    </div>
  );
}
