import { useState } from 'react'
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

function YouTubePoster({ videoId, onClick }: { videoId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-lg border-0 bg-(--mastra-surface-2) p-0"
      aria-label="Play video"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* YouTube play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 68 48" className="h-12 w-[68px] drop-shadow-lg" aria-hidden>
          <path
            d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
            fill="#FF0000"
          />
          <path d="M45 24 27 14v20" fill="#fff" />
        </svg>
      </div>
    </button>
  )
}

function ActivePlayer({
  videoId,
  savedSeconds,
  onTimeUpdate,
  onAutoComplete,
}: {
  videoId: string
  savedSeconds: number
  onTimeUpdate: (seconds: number) => void
  onAutoComplete: () => void
}) {
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
    <>
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
    </>
  )
}

export function YouTubePlayerWithResume({
  videoId,
  savedSeconds,
  onTimeUpdate,
  onAutoComplete,
  className,
}: YouTubePlayerWithResumeProps) {
  const [activated, setActivated] = useState(false)

  return (
    <div className={cn('mb-6', className)}>
      {activated ? (
        <ActivePlayer
          videoId={videoId}
          savedSeconds={savedSeconds}
          onTimeUpdate={onTimeUpdate}
          onAutoComplete={onAutoComplete}
        />
      ) : (
        <>
          <YouTubePoster videoId={videoId} onClick={() => setActivated(true)} />
          {savedSeconds > 10 && (
            <p className="mt-2 text-sm text-(--mastra-text-tertiary)">You left off at {formatSeconds(savedSeconds)}</p>
          )}
        </>
      )}
    </div>
  )
}
