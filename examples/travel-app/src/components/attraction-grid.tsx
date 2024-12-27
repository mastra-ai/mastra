"use client";

import { AttractionCard } from "./attraction-card";

interface Attraction {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  description: string;
  price: number;
  duration?: string;
}

interface AttractionGridProps {
  attractions: Attraction[];
  onBook?: (attractionId: string) => void;
}

export function AttractionGrid({ attractions }: AttractionGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {attractions.map((attraction) => (
        <AttractionCard key={attraction.id} {...attraction} />
      ))}
    </div>
  );
}
