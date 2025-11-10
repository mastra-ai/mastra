import { cn } from "@site/src/css/utils";

export const HeliconeLogo = ({
  className,
  ...rest
}: React.SVGProps<SVGSVGElement>) => (
  // Load from docs/static/svg/helicone.svg; replace the src if you prefer inline SVG
  <img
    src="/svg/helicone.svg"
    alt="Helicone"
    className={cn(className, "inline align-middle object-contain")}
    {...(rest as any)}
  />
);
