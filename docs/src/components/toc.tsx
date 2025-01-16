"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TOCItem {
  value: string;
  id?: string;
  depth: number;
}

interface TOCProps {
  toc: TOCItem[];
  filePath: string;
}

export function TableOfContents(props: TOCProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [pageTitle, setPageTitle] = useState<string>("");
  const pathname = usePathname();

  useEffect(() => {
    const updateActiveId = () => {
      setActiveId(window.location.hash.slice(1));
    };

    const h1Element = document.querySelector("h1");
    if (h1Element) {
      setPageTitle(h1Element.textContent || "");
    }

    updateActiveId();
    window.addEventListener("hashchange", updateActiveId);
    return () => window.removeEventListener("hashchange", updateActiveId);
  }, [pathname]);

  return (
    <div className="fixed top-[4rem] w-64 hidden xl:block h-[calc(100vh-4rem)]">
      <div className="h-full overflow-y-auto px-4 py-8 flex flex-col">
        <div>
          <h3 className="text-xs font-semibold mb-4 text-white">
            On This Page
          </h3>
          <nav className="flex flex-col space-y-0.5">
            {pageTitle && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  history.replaceState(null, "", window.location.pathname);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  setActiveId("");
                }}
                className={cn(
                  "text-gray-200 hover:text-blue-400 transition-colors duration-200 text-sm font-semibold",
                  activeId === "" ? "text-blue-400" : "",
                )}
              >
                {pageTitle}
              </a>
            )}
            {props.toc.map((item) => {
              return (
                <a
                  key={item.id + item.value}
                  href={item.id ? `#${item.id}` : undefined}
                  className={cn("transition-colors duration-200 text-sm", {
                    "text-gray-200 hover:text-blue-400": item.depth === 2,
                    "text-gray-400 ml-3 hover:text-gray-200": item.depth > 2,
                    "text-blue-400 hover:text-blue-400": item.id === activeId,
                  })}
                >
                  {item.value}
                </a>
              );
            })}
          </nav>
        </div>
        <div className="mt-2 pt-4 border-t border-gray-800">
          <a
            href="https://github.com/mastra-ai/mastra/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-gray-400 hover:text-gray-200 text-xs"
          >
            Question? Give us feedback →
          </a>
          <a
            href={`https://github.com/mastra-ai/mastra/edit/main/docs/${props.filePath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-gray-400 hover:text-gray-200 text-xs"
          >
            Edit this page
          </a>
        </div>
      </div>
    </div>
  );
}
