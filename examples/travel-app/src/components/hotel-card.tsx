"use client";

import { Car, Coffee, MapPin, Star, Wifi } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { JSX } from "react";

/* eslint-disable @next/next/no-img-element */

interface HotelCardProps {
  name: string;
  location: string;
  address: string;
  rating: number;
  pricePerNight: number;
  imageUrl: string;
  description: string;
  amenities: string[];
}

export function HotelCard({
  name,
  location,
  address,
  rating,
  pricePerNight,
  imageUrl,
  description,
  amenities,
}: HotelCardProps) {
  const renderAmenityIcon = (amenity: string) => {
    const amenityIcons: { [key: string]: JSX.Element } = {
      wifi: <Wifi className="h-4 w-4" />,
      parking: <Car className="h-4 w-4" />,
      breakfast: <Coffee className="h-4 w-4" />,
    };
    return amenityIcons[amenity.toLowerCase()] || null;
  };

  return (
    <Card className="rounded-none border-black border-4 bg-white">
      <div className="relative bg-white border-b-4 border-black w-full h-[300px]">
        <img
          src={imageUrl || "/placeholder.svg?height=300"}
          alt={name}
          className="object-cover w-full h-full"
        />
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold">{name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              {location}
            </div>
          </div>
          <div className="bg-[#FF3366] px-3 py-1 border-2 border-black transform rotate-2">
            <div className="flex items-center gap-2">
              <Star className="fill-black w-4 h-4 text-black" />
              <div className="text-sm font-medium text-black mt-1">
                {rating} / 5
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-black line-clamp-2">{description}</p>
          <p className="text-sm font-semibold">
            Address: <span className="font-normal"> {address}</span>
          </p>
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap gap-4">
          {amenities?.map((amenity) => (
            <div
              key={amenity}
              className="flex items-center gap-1 px-3 rounded-full p-1.5 bg-gray-100"
            >
              {renderAmenityIcon(amenity)}
              <span className="text-sm">{amenity}</span>
            </div>
          ))}
        </div>

        {/* Price only - remove Book Now button */}
        <div className="bg-[#00FF7F] ml-auto w-fit px-4 py-2 border-2 border-black font-bold transform -rotate-2">
          $
          {pricePerNight?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          <span className="text-sm block">per night</span>
        </div>
      </CardContent>
    </Card>
  );
}
