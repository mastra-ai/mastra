import { useQueryState } from "nuqs";
import { CardItem } from "./card-item";
import { CardTitle } from "./card-title";

export const sluggify = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function CardItemsInner({
  titles,
  items,
}: {
  titles: string[];
  items: Record<string, Array<{ title: string; href: string }>>;
}) {
  const [activeTab, setActiveTab] = useQueryState("list", {
    defaultValue: sluggify(titles[0]),
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(sluggify(tab));
  };
  return (
    <div>
      <CardTitle
        titles={titles}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />
      <div className="mt-6">
        <CardItem
          links={
            items[titles.find((tab) => sluggify(tab) === activeTab) ?? ""] ?? []
          }
        />
      </div>
    </div>
  );
}
