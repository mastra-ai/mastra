import React from "react";
import styles from "./SidebarBadge.module.css";

type BadgeType = "new" | "advanced" | "experimental";

interface SidebarBadgeProps {
  type: BadgeType;
}

export function SidebarBadge({ type }: SidebarBadgeProps) {
  const getLabel = (type: BadgeType) => {
    switch (type) {
      case "new":
        return "NEW";
      case "advanced":
        return "ADVANCED";
      case "experimental":
        return "EXPERIMENTAL";
      default:
        return "";
    }
  };

  return (
    <span className={`${styles.badge} ${styles[`badge--${type}`]}`}>
      {getLabel(type)}
    </span>
  );
}

export default SidebarBadge;
