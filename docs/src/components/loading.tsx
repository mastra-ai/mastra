export const PulsingDots = () => {
  return (
    <div className="flex justify-center items-center space-x-1">
      <div
        className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse"
        style={{ animationDelay: "0ms" }}
      ></div>
      <div
        className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse"
        style={{ animationDelay: "150ms" }}
      ></div>
      <div
        className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse"
        style={{ animationDelay: "300ms" }}
      ></div>
    </div>
  );
};
