'use client';

import { format } from 'date-fns';
import { Plane, Clock, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface FlightCardProps {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureCity: string;
  departureTime: Date;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalTime: Date;
  duration: string;
  price: number;
}

export function FlightCard({
  airline,
  flightNumber,
  departureAirport,
  departureCity,
  departureTime,
  arrivalAirport,
  arrivalCity,
  arrivalTime,
  duration,
  price,
}: FlightCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="font-semibold text-lg">{airline}</div>
          <div className="text-sm text-muted-foreground">Flight {flightNumber}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Departure Info */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Departure</div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{format(departureTime, 'EEE, MMM d')}</span>
            </div>
            <div className="text-2xl font-bold">{format(departureTime, 'HH:mm')}</div>
            <div className="font-medium">{departureAirport}</div>
            <div className="text-sm text-muted-foreground">{departureCity}</div>
          </div>

          {/* Flight Duration */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{duration}</span>
            </div>
            <div className="my-4 w-full flex items-center justify-center">
              <div className="h-[2px] flex-1 bg-border"></div>
              <Plane className="mx-2 h-4 w-4 rotate-90" />
              <div className="h-[2px] flex-1 bg-border"></div>
            </div>
          </div>

          {/* Arrival Info */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Arrival</div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{format(arrivalTime, 'EEE, MMM d')}</span>
            </div>
            <div className="text-2xl font-bold">{format(arrivalTime, 'HH:mm')}</div>
            <div className="font-medium">{arrivalAirport}</div>
            <div className="text-sm text-muted-foreground">{arrivalCity}</div>
          </div>
        </div>

        {/* Price only - remove Book Now button */}
        <div className="mt-6 flex justify-end items-center">
          <div className="text-2xl font-bold">${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </CardContent>
    </Card>
  );
}
