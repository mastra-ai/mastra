import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const CardGrid = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-4">{children}</div>
  );
};

export const CardGridItem = ({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) => {
  return (
    <Card className="h-full shadow-none dark:border-[var(--border)] border-[var(--light-border-muted)]">
      <Link href={href}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      </Link>
      <CardContent className="text-sm">{description}</CardContent>
    </Card>
  );
};
