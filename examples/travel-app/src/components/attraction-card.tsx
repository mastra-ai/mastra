'use client';

import { MapPin, Clock } from 'lucide-react';

import Image from 'next/image';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface AttractionCardProps {
  name: string;
  location: string;
  imageUrl: string;
  description: string;
  price: number;
  duration?: string;
}

export function AttractionCard({ name, location, imageUrl, description, price, duration }: AttractionCardProps) {
  return (
    <Card className="w-full h-full flex flex-col">
      <div className="relative w-full h-[200px]">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover rounded-t-lg"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <CardHeader className="pb-2">
        <div>
          <h2 className="text-xl font-bold line-clamp-1">{name}</h2>
          <div className="flex items-center space-x-1 mt-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{location}</span>
          </div>
          {duration && (
            <div className="flex items-center space-x-1 mt-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{duration}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{description}</p>

        <div className="flex justify-start items-center pt-4 mt-4 border-t">
          <div className="space-y-1">
            <div className="text-2xl font-bold">${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="text-sm text-muted-foreground">per person</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
