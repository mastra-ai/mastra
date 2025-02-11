import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

export function CardItem({
  title,
  links,
}: {
  title: string;
  links: Array<{ title: string; href: string }>;
}) {
  return (
    <Card className="dark:border-[#404040] px-0 rounded-none border-none shadow-none transition-colors">
      <CardContent className="space-y-2 px-0">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex border-b-[0.5px] dark:border-[#343434] items-center rounded-t-md group justify-between p-2 px-0 pl-2 text-sm"
          >
            {item.title}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function CardItems({
  titles,
  items,
}: {
  titles: string[];
  items: Record<string, Array<{ title: string; href: string }>>;
}) {
  const [activeTab, setActiveTab] = useState(titles[0]);
  return (
    <div>
      <CardTitle
        titles={titles}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <div className="mt-6">
        <CardItem title={activeTab} links={items[activeTab] || []} />
      </div>
    </div>
  );
}

export function CardTitle({
  titles,
  activeTab,
  setActiveTab,
}: {
  titles: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="flex mt-6 items-center gap-2">
      {titles?.map((title) => (
        <button
          onClick={() => setActiveTab(title)}
          key={title}
          className={cn(
            "capitalize  rounded-full text-sm bg-gray-100 dark:bg-[#1a1a1a] px-3 py-1",
            activeTab === title &&
              "dark:bg-gray-100 text-white bg-slate-800 dark:text-black",
          )}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
