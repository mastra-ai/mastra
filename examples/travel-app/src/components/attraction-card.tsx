'use client';

import { Clock, MapPin } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

/* eslint-disable @next/next/no-img-element */
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
    <Card className="w-full rounded-none border-black border-4 h-full flex flex-col">
      <div className="relative w-full h-[200px]">
        <img
          src={imageUrl || '/placeholder.svg?height=300&width=200'}
          width={300}
          height={200}
          alt={name}
          className="object-cover w-full h-full"
        />
      </div>
      <CardHeader className="pb-2">
        <div>
          <h2 className="text-xl font-bold line-clamp-1">{name}</h2>
          <div className="flex items-center space-x-1 mt-1">
            <MapPin className="h-4 w-4 " />
            <span className="text-sm ">{location}</span>
          </div>
          {duration && (
            <div className="flex items-center space-x-1 mt-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{duration}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <p className="text-sm  line-clamp-3 flex-1">{description}</p>

        <div className="bg-[var(--brut-red)] px-3 py-1 border-2 border-black inline-block transform -rotate-2">
          <span className="font-bold">${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="text-sm"> per person</span>
        </div>
      </CardContent>
    </Card>
  );
}
