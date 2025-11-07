import React from "react";
import { useLocation } from "@docusaurus/router";
import Link from "@docusaurus/Link";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown";
import { Button } from "./ui/button";
import { cn } from "@site/src/css/utils";

const docsTabs = [
  {
    id: "Docs",
    label: "Docs",
    href: "/docs/v1",
    basePath: "/docs/v1",
  },
  {
    id: "Models",
    label: "Models",
    href: "/models/v1",
    basePath: "/models/v1",
  },
  {
    id: "Examples",
    label: "Examples",
    href: "/examples/v1",
    basePath: "/examples/v1",
  },
  {
    id: "Guides",
    label: "Guides & Migrations",
    href: "/guides/v1",
    basePath: "/guides/v1",
  },
  {
    id: "Reference",
    label: "Reference",
    href: "/reference/v1",
    basePath: "/reference/v1",
  },
  {
    id: "Showcase",
    label: "Showcase",
    href: "/showcase",
    basePath: "/showcase",
  },
];

export function MobileDocsDropdown() {
  const location = useLocation();
  const pathname = location.pathname;
  const [open, setOpen] = React.useState(false);

  const activeTab =
    docsTabs.find((tab) => {
      if (
        pathname.startsWith(tab.basePath + "/") ||
        pathname === tab.basePath
      ) {
        if (tab.basePath === "/docs/v1") {
          const otherTabPaths = docsTabs
            .filter((t) => t.id !== "Docs")
            .map((t) => t.basePath);
          return !otherTabPaths.some(
            (path) => pathname.startsWith(path + "/") || pathname === path,
          );
        }
        return true;
      }
      return false;
    }) || docsTabs[0];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="w-full shadow-none justify-between bg-(--mastra-surface-4) dark:bg-(--ifm-background-color) border border-(--border)/50 text-(--mastra-text-secondary) hover:bg-(--mastra-surface-3) hover:text-(--mastra-text-primary) rounded-xl px-4 py-2.5 text-sm font-medium"
        >
          <span>{activeTab.label}</span>
          <ChevronDown
            className={cn(
              "size-4 text-(--mastra-text-quaternary) transition-transform duration-200",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-200"
        style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
      >
        {docsTabs.map((tab) => {
          const isActive = tab.id === activeTab.id;
          return (
            <DropdownMenuItem key={tab.id} asChild>
              <Link
                to={tab.href}
                className={cn(
                  "flex items-center justify-between w-full no-underline",
                  isActive && "text-(--mastra-text-primary) font-medium",
                )}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <Check className="size-4 text-(--mastra-green-accent-2)" />
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
