import React from "react";
import { CardItems } from "./CardItems";
import sidebars from "@site/src/content/en/reference/sidebars";

// Extract reference sections from sidebar config
function extractReferenceSections() {
  const sections: Record<string, Array<{ title: string; href: string }>> = {};
  const sectionOrder: string[] = [];

  const sidebar = sidebars.referenceSidebar;

  // Type guard to check if sidebar is an array
  if (!Array.isArray(sidebar)) {
    return { sections, sectionOrder };
  }

  sidebar.forEach((item: any) => {
    if (item.type === "doc") {
      // Skip the index/overview
      return;
    }

    if (item.type === "category" && item.label) {
      const label = item.label;
      sectionOrder.push(label);
      sections[label] = [];

      // Extract items from this category
      if (item.items && Array.isArray(item.items)) {
        item.items.forEach((subItem: any) => {
          if (subItem.type === "doc") {
            sections[label].push({
              title: subItem.label,
              href: `/reference/v1/${subItem.id}`,
            });
          } else if (subItem.type === "category") {
            // Handle nested categories by including their items
            if (subItem.items && Array.isArray(subItem.items)) {
              subItem.items.forEach((nestedItem: any) => {
                if (nestedItem.type === "doc") {
                  sections[label].push({
                    title: nestedItem.label,
                    href: `/reference/v1/${nestedItem.id}`,
                  });
                }
              });
            }
          }
        });
      }
    }
  });

  return { sections, sectionOrder };
}

export function ReferenceCards() {
  const { sections, sectionOrder } = extractReferenceSections();
  return <CardItems titles={sectionOrder} items={sections} />;
}
