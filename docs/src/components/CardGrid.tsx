import React from "react";
import Link from "@docusaurus/Link";
import styles from "./CardGrid.module.css";
import { cn } from "../css/utils";

export interface CardGridItemProps {
  title: string;
  description?: string;
  href: string;
  children?: React.ReactNode;
  logo?: React.ReactNode | string;
}

export function CardGridItem({
  title,
  description,
  href,
  children,
  logo,
}: CardGridItemProps) {
  return (
    <Link
      to={href}
      className={cn(styles.cardGridItem, "!shadow-none !rounded-[10px]")}
    >
      {logo && (
        <div className="mb-3">
          {typeof logo === "string" ? (
            <img src={logo} alt={title} className="w-8 h-8 object-contain" />
          ) : (
            logo
          )}
        </div>
      )}
      <h3>{title}</h3>
      {children ||
        (description && <p className=" line-clamp-3">{description}</p>)}
    </Link>
  );
}

export interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return <div className={styles.cardGrid}>{children}</div>;
}
