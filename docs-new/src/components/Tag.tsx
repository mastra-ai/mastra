import React from "react";
import styles from "./Tag.module.css";

export interface TagProps {
  text: string;
  children: React.ReactNode;
}

export function Tag({ text, children }: TagProps) {
  return (
    <span className={styles.tagWrapper}>
      {children}
      <span className={styles.tag}>{text}</span>
    </span>
  );
}
