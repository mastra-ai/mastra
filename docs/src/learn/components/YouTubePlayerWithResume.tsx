import { cn } from '@site/src/lib/utils'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import { formatSeconds } from '../utils'
import { Button } from '@site/src/components/ui/button'

type YouTubePlayerWithResumeProps = {
  videoId: string
  savedSeconds: number
  onTimeUpdate: (seconds: number) => void
  onAutoComplete: () => void
  className?: string
}

export function YouTubePlayerWithResume({
  videoId,
  savedSeconds,
  onTimeUpdate,
  onAutoComplete,
  className,
}: YouTubePlayerWithResumeProps) {
  const { containerRef, isReady, seekTo, playVideo } = useYouTubePlayer({
    videoId,
    startSeconds: savedSeconds,
    onTimeUpdate,
    onAutoComplete,
  })

  const handleResume = () => {
    seekTo(savedSeconds)
    playVideo()
  }

  return (
    <div className={cn('mb-6', className)}>
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-(--mastra-surface-2) [&_iframe]:!h-full [&_iframe]:!w-full [&>div]:!h-full [&>div]:!w-full"
      />
      {isReady && savedSeconds > 10 && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={handleResume}>
            Resume at {formatSeconds(savedSeconds)}
          </Button>
        </div>
      )}
      {!isReady && (
        <div className="mt-2">
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-(--mastra-text-tertiary) hover:text-(--mastra-text-secondary)"
          >
            Open on YouTube →
          </a>
        </div>
      )}
    </div>
  )
}
