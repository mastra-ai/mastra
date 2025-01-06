import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CardItem({
  title,
  links,
}: {
  title: string;
  links: Array<{ title: string; href: string }>;
}) {
  return (
    <Card className="dark:border-[#404040] rounded-md border-gray-300 shadow-none transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="capitalize">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center group justify-between rounded-md p-2 hover:!bg-gray-100 dark:hover:!bg-[rgba(41,41,41,0.5)] text-sm"
          >
            {item.title}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function CardItems({ children }: { children: React.ReactNode }) {
  return <div className="grid mt-4 gap-6 md:grid-cols-2 ">{children}</div>;
}
