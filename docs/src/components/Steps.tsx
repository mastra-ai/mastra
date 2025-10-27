import React from "react";

export interface StepsProps {
  children: React.ReactNode;
}

export function Steps({ children }: StepsProps) {
  return <div className="steps-container">{children}</div>;
}

export default Steps;
