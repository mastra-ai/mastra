"use client";

import Link from "@docusaurus/Link";
import { Card, CardContent } from "../ui/card";
import { useLocation } from "@docusaurus/router";

export function CardItem({
  links,
}: {
  links: Array<{ title: string; href: string }>;
}) {
  const location = useLocation();
  const locale = location.pathname.split("/")[1] || "en";
  return (
    <Card className="dark:border-[#404040] w-full px-0 rounded-none border-none shadow-none transition-colors">
      <CardContent className="w-full px-0 gap-3 grid md:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <Link
            key={`${item.title}-${item.href}`}
            to={`/${locale}${item.href}`}
            style={{
              textDecoration: "none",
            }}
            className="flex-1 flex text-center bg-[var(--light-color-surface-3)] dark:bg-[#1a1a1a]/50 mb-0 border-[0.5px] rounded-md dark:border-[#343434] border-[var(--light-border-muted)] items-center group justify-center p-2 px-4 text-sm"
          >
            {item.title}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
