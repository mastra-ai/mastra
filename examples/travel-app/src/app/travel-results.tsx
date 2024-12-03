'use client';

import { Plane } from 'lucide-react';
import { useState } from 'react';

import { AttractionCard } from '@/components/attraction-card';
import { FlightCard } from '@/components/flight-card';
import { HotelCard } from '@/components/hotel-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MOCK_FLIGHT = {
  airline: 'United Airlines',
  flightNumber: 'UA123',
  departureTime: new Date('2024-03-20T10:00:00'),
  arrivalTime: new Date('2024-03-20T13:30:00'),
  duration: '3h 30m',
  price: 299,
  stops: 0,
  departureAirport: 'SFO',
  arrivalAirport: 'JFK',
  departureCity: 'San Francisco',
  arrivalCity: 'New York',
};

const MOCK_HOTEL = {
  name: 'Grand Hotel',
  rating: 4.5,
  pricePerNight: 199,
  location: 'Downtown',
  address: '123 Main St, New York, NY 10001',
  description: 'Luxury hotel in the heart of the city',
  amenities: ['Pool', 'Spa', 'Restaurant'],
  imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
  phoneNumber: '+1 (555) 123-4567',
};

const MOCK_ATTRACTIONS = [
  {
    name: 'Historical Museum',
    description: 'Explore the rich history of the city',
    rating: 4.8,
    price: 15,
    imageUrl: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd',
    location: 'Downtown Manhattan',
  },
  {
    name: 'Botanical Gardens',
    description: 'Beautiful gardens with exotic plants',
    rating: 4.6,
    price: 12,
    imageUrl: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae',
    location: 'Central Park',
  },
  {
    name: 'City Tower',
    description: 'Panoramic views of the city',
    rating: 4.7,
    price: 20,
    imageUrl: 'https://images.unsplash.com/photo-1495562569060-2eec283d3391',
    location: 'Financial District',
  },
];

export function TravelResults() {
  const [showDialog, setShowDialog] = useState(false);

  const returnFlight = {
    ...MOCK_FLIGHT,
    departureTime: new Date('2024-03-27T15:00:00'),
    arrivalTime: new Date('2024-03-27T18:30:00'),
    departureAirport: 'JFK',
    arrivalAirport: 'SFO',
    departureCity: 'New York',
    arrivalCity: 'San Francisco',
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Your Travel Itinerary</h2>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Flights</h3>
          <div className="grid gap-4">
            <FlightCard {...MOCK_FLIGHT} />
            <FlightCard {...returnFlight} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Accommodation</h3>
          <HotelCard {...MOCK_HOTEL} />
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Recommended Attractions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MOCK_ATTRACTIONS.map((attraction, index) => (
              <AttractionCard key={index} {...attraction} />
            ))}
          </div>
        </div>

        <div className="pt-8 flex justify-center">
          <Button size="lg" className="w-full max-w-md" onClick={() => setShowDialog(true)}>
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
