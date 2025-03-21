"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SubscribeForm } from "./subscribe-form";
import { TocSvg } from "./svgs/toc-svg";
import { ThemeSwitch } from "nextra-theme-docs";

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

  let headingIndex = 0;

  return (
    <div className="sticky top-[4rem] w-64 hidden xl:block max-h-[calc(100vh-4rem)] overflow-y-auto pb-4 nextra-scrollbar">
      <div className="px-4 py-8 flex flex-col">
        {props.toc.length > 0 && (
          <div className="border-b-[0.5px] dark:border-[#343434] pb-9">
            <h3 className="text-xs font-medium mb-2 pl-4 text-[#6b7280] dark:text-[#939393] py-1.5 mb-3 text-[13px] flex flex-row gap-2 items-center">
              <TocSvg className="w-4 h-4 stroke-[#939393]" />
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
                    "text-gray-500 dark:text-[#939393] py-1 hover:text-black transition-colors duration-200 text-sm",
                    activeId === "" ? "dark:text-white font-medium" : "",
                  )}
                >
                  {pageTitle}
                </a>
              )}
              {props.toc.map((item) => {
                if (item.depth === 2) {
                  headingIndex++;
                }

                console.log(
                  "activeId",
                  item.id === activeId,
                  item.id,
                  activeId,
                );

                return (
                  <a
                    key={item.id + item.value}
                    href={item.id ? `#${item.id}` : undefined}
                    className={cn(
                      "transition-colors py-1 duration-200 text-sm",
                      {
                        "text-gray-500 dark:text-[#939393] hover:text-black dark:hover:text-white":
                          item.depth === 2,
                        "dark:text-[#939393] dark:hover:text-white text-gray-500 ml-3 hover:text-gray-900":
                          item.depth > 2,
                        "text-black dark:text-white": item.id === activeId,
                      },
                    )}
                  >
                    {item.depth === 2 && <span>{headingIndex}. </span>}
                    {item.value}
                  </a>
                );
              })}
            </nav>
          </div>
        )}

        <FeedbackSection filePath={props.filePath} />
      </div>
    </div>
  );
}

const FeedbackSection = (props: { filePath: string }) => {
  const buttonClass =
    "!text-[14px] !text-[#A9A9A9] w-full !bg-[#121212] block rounded-[6px] h-[32px] px-3 flex items-center";
  return (
    <div className="pt-5">
      <div className="space-y-2 pb-6">
        <ThemeSwitch className={buttonClass} />
        <a
          href="https://github.com/mastra-ai/mastra/issues"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          Give us feedback
        </a>
        <a
          href={`https://github.com/mastra-ai/mastra/edit/main/docs/${props.filePath}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          Edit this page
        </a>
      </div>

      <SubscribeForm label="Subscribe to weekly changelog" />
    </div>
  );
};
