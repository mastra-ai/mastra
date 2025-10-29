import React from "react";

export interface AudioPlaybackProps {
  audio: string;
}

export const AudioPlayback = ({ audio }: AudioPlaybackProps) => {
  return <audio src={audio} controls />;
};
