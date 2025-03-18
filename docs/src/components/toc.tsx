"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { SubscribeForm } from "./subscribe-form";
import { toast } from "sonner";

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
    <div className="sticky top-[4rem] w-64 hidden xl:block h-[calc(100vh-4rem)]">
      <div className="overflow-y-auto px-4 py-8 flex flex-col">
        <div>
          <h3 className="text-xs font-semibold mb-2 pl-4 text-[#6b7280] dark:text-white">
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
                  "dark:text-gray-200 text-black py-1 hover:text-blue-400 transition-colors duration-200 text-sm",
                  activeId === "" ? "dark:text-[#1aa3ff] font-medium" : "",
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
                  className={cn("transition-colors py-1 duration-200 text-sm", {
                    "text:black dark:text-gray-200 hover:text-[#1aa3ff]":
                      item.depth === 2,
                    "dark:text-gray-400 dark:hover:text-white text-gray-500 ml-3 hover:text-gray-900":
                      item.depth > 2,
                    "dark:text-[#1aa3ff] text-[#004ca3] dark:hover:text-blue-[#1aa3ff]":
                      item.id === activeId,
                  })}
                >
                  {item.value}
                </a>
              );
            })}
          </nav>
        </div>
        <div className="mt-2 pt-4 border-t  dark:border-neutral-700">
          <a
            href="https://github.com/mastra-ai/mastra/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[#6b7280] dark:text-gray-400 hover:text-black dark:hover:text-gray-200 text-xs"
          >
            Question? Give us feedback →
          </a>
          <a
            href={`https://github.com/mastra-ai/mastra/edit/main/docs/${props.filePath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[#6b7280] dark:text-gray-400 hover:text-black dark:hover:text-gray-200 text-xs"
          >
            Edit this page
          </a>
        </div>
      </div>
      <div className="p-4 border dark:border-[0.5px] rounded-md dark:border-neutral-700">
        <h3 className="text-xl font-semibold">
          Subscribe to the Weekly changelog
        </h3>
        <SubscribeForm
          className="md:flex-col md:items-start"
          inputClassName="md:w-full md:min-w-full pl-2 truncate"
          buttonClassName="md:w-full md:min-w-full"
          showLabel={false}
        />
      </div>
    </div>
  );
}
