import { cn } from "@site/src/css/utils";

export const PulsingDots = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn("flex justify-center items-center space-x-1", className)}
    >
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
