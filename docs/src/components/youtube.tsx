export default function YouTube({ id }: { id: string }) {
  return (
    <div className="my-4">
      <iframe
        className="aspect-video w-full rounded-lg"
        src={"https://www.youtube.com/embed/" + id + "?rel=0"}
        title="YouTube Video Player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
}
