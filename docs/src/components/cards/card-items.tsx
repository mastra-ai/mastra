"use client";
import { Suspense } from "react";
import { CardItemsInner } from "./card-items-inner";

export function CardItems(props: {
  titles: string[];
  items: Record<string, Array<{ title: string; href: string }>>;
}) {
  return (
    <Suspense>
      <CardItemsInner {...props} />
    </Suspense>
  );
}
