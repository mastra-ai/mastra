import React, { useState, useEffect } from "react";
import Link from "@docusaurus/Link";
import { cn } from "../css/utils";

const sluggify = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface CardItemsProps {
  titles: string[];
  items: Record<string, Array<{ title: string; href: string }>>;
}

export function CardItems({ titles, items }: CardItemsProps) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return sluggify(titles[0]);
    const params = new URLSearchParams(window.location.search);
    return params.get("list") || sluggify(titles[0]);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("list", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(sluggify(tab));
  };

  const currentItems =
    items[titles.find((tab) => sluggify(tab) === activeTab) ?? ""] ?? [];

  return (
    <div className="card__grid">
      <div className="flex flex-wrap mt-6 items-center gap-2">
        {titles.map((title) => (
          <button
            onClick={() => handleTabChange(title)}
            key={title}
            className={cn(
              "capitalize w-fit text-[var(--mastra-text-quaternary)] rounded-full text-sm bg-(--mastra-surface-3) px-3 py-1 transition-colors",
              activeTab === sluggify(title) &&
                "dark:bg-gray-100 text-white bg-[var(--mastra-text-primary)] dark:text-black",
            )}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="mt-6 w-full gap-3 grid md:grid-cols-2 lg:grid-cols-3">
        {currentItems.map((item) => (
          <Link
            key={`${item.title}-${item.href}`}
            to={item.href}
            style={{
              textDecoration: "none",
            }}
            className="flex-1 flex text-center bg-(--mastra-surface-3) mb-0 border-[0.5px] rounded-[10px] dark:border-[#343434] border-(--border) items-center group justify-center p-2 px-4 text-sm hover:opacity-80 transition-opacity"
          >
            {item.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
