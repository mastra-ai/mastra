import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const CardGrid = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 content-stretch gap-4 py-4">
      {children}
    </div>
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
    <div className="relative isolate">
      <Card className="h-full">
        <Link href={href}>
          <span className="absolute inset-0 z-10" />
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        </Link>
        <CardContent>{description}</CardContent>
      </Card>
    </div>
  );
};
