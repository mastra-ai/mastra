export const AudioPlayback = ({ audio }: { audio: string }) => {
  return <audio src={audio} controls />;
};
