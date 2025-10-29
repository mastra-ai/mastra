import React from "react";
import styles from "./Steps.module.css";

export interface StepsProps {
  children: React.ReactNode;
}

export function Steps({ children }: StepsProps) {
  return (
    <ol role="list" className={styles.container}>
      {children}
    </ol>
  );
}

export default Steps;
