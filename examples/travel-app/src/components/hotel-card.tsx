'use client';

import { MapPin, Star, Wifi, Car, Coffee, Phone } from 'lucide-react';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface HotelCardProps {
  name: string;
  location: string;
  address: string;
  rating: number;
  pricePerNight: number;
  imageUrl: string;
  description: string;
  amenities: string[];
  phoneNumber: string;
}

const renderStars = (rating: number) => {
  return Array(5)
    .fill(0)
    .map((_, index) => (
      <Star key={index} className={`h-4 w-4 ${index < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
    ));
};

export function HotelCard({
  name,
  location,
  address,
  rating,
  pricePerNight,
  imageUrl,
  description,
  amenities,
  phoneNumber,
}: HotelCardProps) {
  console.log(rating);

  const renderAmenityIcon = (amenity: string) => {
    const amenityIcons: { [key: string]: JSX.Element } = {
      wifi: <Wifi className="h-4 w-4" />,
      parking: <Car className="h-4 w-4" />,
      breakfast: <Coffee className="h-4 w-4" />,
    };
    return amenityIcons[amenity.toLowerCase()] || null;
  };

  return (
    <Card className="w-full">
      <div className="relative w-full h-[200px]">
        <img src={imageUrl} alt={name} className="object-cover rounded-t-lg w-full h-full" />
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">{name}</h2>
            <div className="flex items-center space-x-1 mt-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{location}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex space-x-1">{renderStars(rating)}</div>
            <div className="text-sm text-muted-foreground mt-1">{rating} out of 5</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          <p className="text-sm">{address}</p>
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap gap-4">
          {amenities.map(amenity => (
            <div key={amenity} className="flex items-center gap-1 px-3 rounded-full p-1.5 bg-gray-100">
              {renderAmenityIcon(amenity)}
              <span className="text-sm">{amenity}</span>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="flex items-center space-x-2 text-sm">
          <Phone className="h-4 w-4" />
          <span>{phoneNumber !== '<UNKNOWN>' ? phoneNumber : 'N/A'}</span>
        </div>

        {/* Price only - remove Book Now button */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              ${pricePerNight.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">per night</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
