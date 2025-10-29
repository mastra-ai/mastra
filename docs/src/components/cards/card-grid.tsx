import { Card, CardHeader, CardContent, CardTitle } from "../ui/card";
import Link from "@docusaurus/Link";

export const CardGrid = ({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) => {
  const gridCols = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  }[columns];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-4 py-4`}>
      {children}
    </div>
  );
};

export const CardGridItem = ({
  title,
  description,
  href,
  logo,
  preserveLogoColor = false,
  children,
}: {
  title: string;
  description?: string;
  href: string;
  logo?: string | React.ReactNode;
  preserveLogoColor?: boolean;
  children?: React.ReactNode;
}) => {
  return (
    <Link to={href} className="block h-full w-full">
      <Card className="h-full w-full shadow-none dark:border-[var(--border)] border-[var(--light-border-muted)] hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer">
        <CardHeader>
          <div className="flex items-center gap-3">
            {logo &&
              (typeof logo === "string" ? (
                <img
                  src={logo}
                  alt={`${title} logo`}
                  className={
                    preserveLogoColor
                      ? "w-8 h-8 object-contain"
                      : "w-8 h-8 object-contain dark:invert dark:brightness-0 dark:contrast-200"
                  }
                />
              ) : (
                <div
                  className={
                    preserveLogoColor
                      ? "w-8 h-8"
                      : "w-8 h-8 text-black dark:text-white"
                  }
                >
                  {logo}
                </div>
              ))}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm">{children || description}</CardContent>
      </Card>
    </Link>
  );
};
