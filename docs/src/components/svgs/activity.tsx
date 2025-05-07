import { cn } from "@/lib/utils";

export const ActivityIcon = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-1", className)}>
    <span
      className="copilotKitActivityDot"
      style={{ animationDelay: "0s" }}
    ></span>
    <span
      className="copilotKitActivityDot"
      style={{ animationDelay: "0.2s" }}
    ></span>
    <span
      className="copilotKitActivityDot"
      style={{ animationDelay: "0.4s" }}
    ></span>
  </div>
);
