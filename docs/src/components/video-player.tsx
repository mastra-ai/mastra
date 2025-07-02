"use client";

import { useState, useRef } from "react";
import React from "react";

import Image from "next/image";
import { cn } from "@/lib/utils";

const PlayButton = ({ onPlay }: { onPlay: () => void }) => (
  <button
    onClick={onPlay}
    style={{
      background:
        "linear-gradient(243deg,hsla(0,0%,100%,.3),hsla(0,0%,100%,0))",
    }}
    className="group absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transform rounded-[20px] px-8 py-4 backdrop-blur transition-transform hover:scale-110 hover:!bg-white"
    aria-label="Play video"
  >
    <div className=" text-white transition-colors group-hover:text-black">
      <svg
        width="16"
        height="16"
        className="h-5 w-5 md:h-8 md:w-8"
        viewBox="0 0 16 16"
        fill="currentColor"
        role="img"
        focusable="false"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="m5.604 2.41 7.23 4.502a1.375 1.375 0 0 1-.02 2.345L5.585 13.6a1.375 1.375 0 0 1-2.083-1.18V3.576A1.375 1.375 0 0 1 5.604 2.41Z"></path>
      </svg>
    </div>
  </button>
);

interface VideoPlayerProps {
  src: string;
  thumbnailUrl?: string;
  className?: string;
  isVideo?: boolean;
  showThumbnail?: boolean;
}

export const isYouTubeUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ["youtube.com", "www.youtube.com", "youtu.be"];
    return allowedHosts.includes(parsedUrl.host);
  } catch (e) {
    // Invalid URL
    return false;
  }
};

export const getYouTubeEmbedUrl = (url: string): string => {
  let videoId: string;
  let timeParam: string = "";

  if (url.includes("youtu.be")) {
    // Handle youtu.be format: https://youtu.be/VIDEO_ID?t=TIME
    const urlParts = url.split("youtu.be/")[1];
    const [id, queryString] = urlParts.split("?");
    videoId = id;

    if (queryString) {
      const urlParams = new URLSearchParams(queryString);
      const time = urlParams.get("t");
      if (time) {
        timeParam = `&start=${time}`;
      }
    }
  } else {
    // Handle youtube.com format: https://www.youtube.com/watch?v=VIDEO_ID&t=TIME
    const urlParams = new URLSearchParams(url.split("?")[1] || "");
    videoId = urlParams.get("v") || "";
    const time = urlParams.get("t");
    if (time) {
      timeParam = `&start=${time}`;
    }
  }

  return `https://www.youtube.com/embed/${videoId}?autoplay=0&enablejsapi=1&rel=0${timeParam}`;
};

export const VideoPlayer = ({
  src,
  thumbnailUrl,
  className,
  isVideo = true,
  showThumbnail = true,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showPlayButton, setShowPlayButton] = useState(showThumbnail);
  const isYouTube = isYouTubeUrl(src);

  const handlePlay = () => {
    if (isYouTube && iframeRef.current) {
      iframeRef.current.src = getYouTubeEmbedUrl(src);
      setShowPlayButton(false);
    } else if (videoRef.current) {
      videoRef.current.play();
      setShowPlayButton(false);
    }
  };

  return (
    <div className="relative min-h-[400px] h-full w-full">
      {showPlayButton && (
        <>
          <Image
            quality={100}
            loading="eager"
            src={thumbnailUrl || "/video-preview.png"}
            className={cn(
              "absolute h-full w-full rounded-xl object-cover md:object-cover",
              className,
            )}
            alt="Video thumbnail"
            width={1000}
            height={1000}
            priority
          />
          {isVideo && <PlayButton onPlay={handlePlay} />}
        </>
      )}
      {isYouTube ? (
        <iframe
          ref={iframeRef}
          className={`relative z-10 h-full focus:outline-none  focus-visible:outline-[2px] focus-visible:outline-offset-[2px] focus-visible:outline-[var(--primary)] w-full rounded-xl ${showPlayButton ? "invisible" : "visible"}`}
          src={showPlayButton ? undefined : getYouTubeEmbedUrl(src)}
          title="Video player"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer;clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          className="relative z-10 h-full w-full rounded-xl"
          src={src}
          playsInline
          preload="metadata"
          onEnded={() => setShowPlayButton(true)}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
};
