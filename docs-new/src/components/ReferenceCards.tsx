import React from 'react';
import { CardItems } from './CardItems';
import { referenceSections, sectionTitles } from './reference-data';

export function ReferenceCards() {
  return <CardItems titles={sectionTitles} items={referenceSections} />;
}
