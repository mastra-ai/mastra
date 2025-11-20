import React from "react";

export interface StepsProps {
  children: React.ReactNode;
}

export function StepItem({ children }: StepsProps) {
  return <li className="step-item">{children}</li>;
}

export default StepItem;
