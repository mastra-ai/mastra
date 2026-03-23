import { MetricsCardDescription } from './metrics-card-description';
import { MetricsCardTitle } from './metrics-card-title';
import type { ReactNode } from 'react';

type PropsWithTitleDescription = {
  title: string;
  description?: string;
  children?: never;
  className?: string;
};

type PropsWithChildren = {
  title?: never;
  description?: never;
  children: ReactNode;
  className?: string;
};

export function MetricsCardTitleAndDescription(props: PropsWithTitleDescription | PropsWithChildren) {
  if ('children' in props) {
    return <div className={props.className}>{props.children}</div>;
  }

  const { title, description } = props;

  return (
    <div className={props.className}>
      <MetricsCardTitle>{title}</MetricsCardTitle>
      {description && <MetricsCardDescription>{description}</MetricsCardDescription>}
    </div>
  );
}
