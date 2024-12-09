'use client';

import { Plane } from 'lucide-react';
import { useState } from 'react';

import { AttractionCard } from '@/components/attraction-card';
import { FlightCard } from '@/components/flight-card';
import { HotelCard } from '@/components/hotel-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TravelResultsProps {
  travelData: {
    flight: {
      airline: string;
      flightNumber: string;
      departureTime: string;
      arrivalTime: string;
      duration: string;
      price: number;
      stops: number;
      departureAirport: string;
      arrivalAirport: string;
      departureCity: string;
      arrivalCity: string;
    };
    hotel: {
      name: string;
      rating: number;
      pricePerNight: number;
      location: string;
      address: string;
      description: string;
      amenities: string[];
      imageUrl: string;
      phoneNumber: string;
    };
    attractions: Array<{
      name: string;
      description: string;
      rating: number;
      price: number;
      imageUrl: string;
      location: string;
    }>;
  };
}

export function TravelResults({ travelData }: TravelResultsProps) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Your Travel Itinerary</h2>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Flights</h3>
          <div className="grid gap-4">
            <FlightCard {...travelData.flight} />
            {/* Assuming return flight details are part of the structured output */}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Accommodation</h3>
          <HotelCard {...travelData.hotel} />
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Recommended Attractions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {travelData.attractions.map((attraction, index) => (
              <AttractionCard key={index} {...attraction} />
            ))}
          </div>
        </div>

        <div className="pt-8">
          <Button size="lg" className="w-full" onClick={() => setShowDialog(true)}>
            <Plane className="mr-2 h-5 w-5" />
            Book Trip Now
          </Button>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Booking Information</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-muted-foreground">
                Booking is disabled in this example app. You can book these travel plans on Booking.com (which is where
                the data comes from).
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
