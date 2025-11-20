import React, { useState, useRef } from "react";

interface VideoPlayerProps {
  src: string;
}

export const VideoPlayer = ({ src }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPlayButton, setShowPlayButton] = useState(true);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setShowPlayButton(false);
    }
  };

  return (
    <div className="relative min-h-[400px] h-full w-full mb-6">
      {showPlayButton ? (
        <button
          onClick={handlePlay}
          style={{
            background:
              "linear-gradient(243deg,hsla(0,0%,100%,.3),hsla(0,0%,100%,0))",
          }}
          className="group cursor-pointer absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transform rounded-[12px] px-8 py-4 backdrop-blur transition-transform hover:scale-110 hover:!bg-white"
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
      ) : null}
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
    </div>
  );
};
