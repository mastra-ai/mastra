import { useNavbarMobileSidebar } from "@docusaurus/theme-common/internal";
import { translate } from "@docusaurus/Translate";
import { Button } from "@site/src/components/ui/button";
import { cn } from "@site/src/css/utils";
import { type ReactNode } from "react";

export default function MobileSidebarToggle(): ReactNode {
  const { toggle, shown } = useNavbarMobileSidebar();
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      aria-label={translate({
        id: "theme.docs.sidebar.toggleSidebarButtonAriaLabel",
        message: "Toggle navigation bar",
        description:
          "The ARIA label for hamburger menu button of mobile navigation",
      })}
      type="button"
      aria-expanded={shown}
      className="grid rounded-full w-8  h-8 p-2 shrink-0 place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--mastra-green-accent) lg:hidden"
    >
      <span className="sr-only">Open main menu</span>
      <HamburgerDefault />
    </Button>
  );
}

function HamburgerDefault() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="7.5"
        width="14"
        height="1"
        rx="0.5"
        style={{
          transformOrigin: "center",
        }}
        className={cn(
          "transition-transform duration-150 ease-ease-out-quad",
          " translate-y-[-3.5px]",
        )}
      ></rect>
      <rect
        x="1"
        y="7.5"
        width="14"
        height="1"
        rx="0.5"
        style={{
          transformOrigin: "center",
        }}
        className={cn(
          "transition-transform duration-150 ease-ease-out-quad ",
          "translate-y-[3.5px]",
        )}
      ></rect>
    </svg>
  );
}
