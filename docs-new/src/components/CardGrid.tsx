import React from 'react';
import Link from '@docusaurus/Link';
import styles from './CardGrid.module.css';
import { cn } from '../css/utils';

export interface CardGridItemProps {
  title: string;
  description: string;
  href: string;
}

export function CardGridItem({ title, description, href }: CardGridItemProps) {
  return (
    <Link to={href} className={cn(styles.cardGridItem, '!shadow-none !rounded-[10px]')}>
      <h3>{title}</h3>
      <p className=" line-clamp-3">{description}</p>
    </Link>
  );
}

export interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return <div className={styles.cardGrid}>{children}</div>;
}
