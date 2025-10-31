import { CardItemsInner } from "./card-items-inner";

export function CardItems(props: {
  titles: string[];
  items: Record<string, Array<{ title: string; href: string }>>;
}) {
  return <CardItemsInner {...props} />;
}
