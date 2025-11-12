import { cn } from "@site/src/lib/utils";
import { sluggify } from "./card-items-inner";

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
    <div className="flex flex-wrap mt-6 items-center gap-2">
      {titles.map((title) => (
        <button
          onClick={() => setActiveTab(title)}
          key={title}
          className={cn(
            "capitalize w-fit text-[var(--light-color-text-4)] rounded-full text-sm bg-[var(--light-color-surface-3)] dark:bg-[#121212] dark:text-[var(--color-el-3)] px-3 py-1",
            activeTab === sluggify(title) &&
              "dark:bg-gray-100 text-white bg-[var(--light-color-text-6)] dark:text-black",
          )}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
