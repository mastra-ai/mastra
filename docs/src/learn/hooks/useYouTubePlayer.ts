import { useEffect, useRef, useState, useCallback } from 'react'

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
    YT?: typeof YT
  }
}

type UseYouTubePlayerOptions = {
  videoId: string
  startSeconds?: number
  onTimeUpdate?: (seconds: number) => void
  onAutoComplete?: () => void
}

let apiLoadPromise: Promise<void> | null = null

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise
  if (window.YT?.Player) return Promise.resolve()

  apiLoadPromise = new Promise<void>(resolve => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiLoadPromise
}

export function useYouTubePlayer({ videoId, startSeconds = 0, onTimeUpdate, onAutoComplete }: UseYouTubePlayerOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const lastSaveRef = useRef(0)
  const autoCompletedRef = useRef(false)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onAutoCompleteRef = useRef(onAutoComplete)

  onTimeUpdateRef.current = onTimeUpdate
  onAutoCompleteRef.current = onAutoComplete

  useEffect(() => {
    if (!containerRef.current) return

    let player: YT.Player | null = null
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let destroyed = false

    const init = async () => {
      try {
        await loadYouTubeAPI()
      } catch {
        return
      }
      if (destroyed || !containerRef.current || !window.YT) return

      const playerDiv = document.createElement('div')
      containerRef.current.appendChild(playerDiv)

      player = new window.YT.Player(playerDiv, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          autoplay: 1,
        },
        events: {
          onReady: () => {
            if (destroyed) return
            playerRef.current = player
            setIsReady(true)
            setDuration(player!.getDuration())
            if (startSeconds > 0) {
              player!.seekTo(startSeconds, true)
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (destroyed) return
            const time = player!.getCurrentTime()
            if (event.data === window.YT!.PlayerState.PAUSED) {
              onTimeUpdateRef.current?.(time)
            }
            if (event.data === window.YT!.PlayerState.ENDED) {
              onTimeUpdateRef.current?.(time)
              if (!autoCompletedRef.current) {
                autoCompletedRef.current = true
                onAutoCompleteRef.current?.()
              }
            }
          },
        },
      })

      pollInterval = setInterval(() => {
        if (!player || destroyed) return
        try {
          const time = player.getCurrentTime()
          const dur = player.getDuration()
          setCurrentTime(time)
          if (dur > 0) setDuration(dur)

          // Throttle save to every 5s
          if (time - lastSaveRef.current >= 5) {
            lastSaveRef.current = time
            onTimeUpdateRef.current?.(time)
          }

          // Auto-complete when within last 15s
          if (dur > 0 && dur - time <= 15 && !autoCompletedRef.current) {
            autoCompletedRef.current = true
            onAutoCompleteRef.current?.()
          }
        } catch {
          // Player might not be ready yet
        }
      }, 1000)
    }

    init()

    return () => {
      destroyed = true
      if (pollInterval) clearInterval(pollInterval)
      try {
        player?.destroy()
      } catch {
        // ignore
      }
      playerRef.current = null
    }
  }, [videoId, startSeconds])

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true)
  }, [])

  const playVideo = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  return { containerRef, isReady, currentTime, duration, seekTo, playVideo, startSeconds }
}
