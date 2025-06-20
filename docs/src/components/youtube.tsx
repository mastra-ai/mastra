interface YouTubeProps {
  id: string;
  startTime?: number;
}

export default function YouTube({ id, startTime }: YouTubeProps) {
  const src = `https://www.youtube.com/embed/${id}?rel=0${startTime ? `&start=${startTime}` : ""}`;

  return (
    <div className="my-4">
      <iframe
        className="aspect-video w-full rounded-lg"
        src={src}
        title="YouTube Video Player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
}
