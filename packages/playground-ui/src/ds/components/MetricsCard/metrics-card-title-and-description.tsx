import type { ReactNode } from 'react';

import { MetricsCardDescription } from './metrics-card-description';
import { MetricsCardTitle } from './metrics-card-title';

type PropsWithTitleDescription = {
  title: string;
  description?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
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

  const { title, description, titleAs } = props;

  return (
    <div className={props.className}>
      <MetricsCardTitle as={titleAs}>{title}</MetricsCardTitle>
      {description && <MetricsCardDescription>{description}</MetricsCardDescription>}
    </div>
  );
}
