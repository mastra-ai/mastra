import { cn } from "@/lib/utils";

function Spinner({
  color = "#fff",
  className,
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg
      className={cn("animate-spin duration-700", className)}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke={color} />
    </svg>
  );
}

export default Spinner;
