"use client";

import { useState } from "react";

import { AttractionCard } from "@/components/attraction-card";
import { FlightCard } from "@/components/flight-card";
import { HotelCard } from "@/components/hotel-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TravelSchemaProps } from "./utils";
import { Card, CardContent } from "@/components/ui/card";
import { Frown } from "lucide-react";

interface TravelResultsProps {
  travelData: TravelSchemaProps;
  goBack: () => void;
}

export function TravelResults({ travelData, goBack }: TravelResultsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const noData =
    !travelData?.flights.outbound.airline ||
    !travelData?.flights.return.airline;

  if (
    !travelData?.flights.outbound.airline ||
    !travelData?.flights.return.airline
  ) {
    return (
      <div className="space-y-8">
        <div className="space-y-6 max-w-2xl mx-auto">
          <h2 className="inline-block bg-black text-white px-8 py-4 text-2xl font-bold shadow-[8px_8px_0px_0px_#000000] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all">
            Your Travel Itinerary
          </h2>
          <Card className="bg-white rounded-none border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000000] max-w-2xl mx-auto transform -rotate-1 hover:rotate-0 transition-transform">
            <CardContent className="flex flex-col items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <Frown className="h-8 w-8" />
                <p className="text-xl font-bold">I could not plan your trip</p>
              </div>
            </CardContent>
          </Card>
          <Button
            onClick={() => {
              goBack();
            }}
            size={"lg"}
            className="bg-[var(--brut-red)] text-xl text-white p-8 w-full border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all font-mono font-bold transform rotate-1 hover:rotate-0"
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6 max-w-2xl mx-auto">
        <h2 className="inline-block bg-black text-white px-8 py-4 text-2xl font-bold shadow-[8px_8px_0px_0px_#000000] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all">
          Your Travel Itinerary
        </h2>

        <div className="space-y-6">
          <div className="grid gap-4">
            <div className="bg-[var(--brut-pink)] p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000000] transform rotate-1 hover:rotate-0 transition-transform">
              <h2 className="text-2xl font-bold mb-6 bg-black text-white inline-block px-4 py-2 -rotate-2">
                Outbound Flight
              </h2>
              {travelData?.flights.outbound.airline ? (
                <FlightCard {...travelData.flights.outbound} />
              ) : (
                <div className="text-xl text-black">
                  <p>No outbound flights found</p>
                </div>
              )}
            </div>
            <div className="bg-[#FF9ECD] p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000000] transform rotate-1 hover:rotate-0 transition-transform">
              <h2 className="text-2xl font-bold mb-6 bg-black text-white inline-block px-4 py-2 -rotate-2">
                Return Flight
              </h2>

              {travelData.flights.return.airline ? (
                <FlightCard {...travelData.flights.return} />
              ) : (
                <div className="text-xl text-black">
                  <p>No return flights found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[var(--brut-blue)] p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000000] transform -rotate-1 hover:rotate-0 transition-transform">
          <h2 className="text-xl font-bold mb-6 bg-black text-white inline-block px-4 py-2 rotate-2">
            Accommodation
          </h2>
          {travelData?.accommodation.name ? (
            <HotelCard {...travelData.accommodation} />
          ) : (
            <div className="text-xl text-black">
              <p>No accommodation found</p>
            </div>
          )}
        </div>

        <div className="bg-[var(--brut-light-green)] p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000000] transform rotate-1 hover:rotate-0 transition-transform">
          <h3 className="text-xl font-bold mb-6 bg-black text-white inline-block px-4 py-2 -rotate-2">
            Recommended Attractions
          </h3>
          {travelData?.attractions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {travelData.attractions.map((attraction, index) => (
                <AttractionCard key={index} {...attraction} />
              ))}
            </div>
          ) : (
            <div className="text-xl text-black">
              <p>No attraction centers found</p>
            </div>
          )}
        </div>

        <div className="pt-8">
          <Button
            onClick={() => {
              if (noData) {
                goBack();
              } else {
                setShowDialog(true);
              }
            }}
            size={"lg"}
            className="bg-[var(--brut-red)] text-xl text-white p-8 w-full border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all font-mono font-bold transform rotate-1 hover:rotate-0"
          >
            {noData ? "Try again" : "Book Trip now"}
          </Button>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="bg-[var(--brut-bg)] rounded-none p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000000] transform -rotate-1 hover:rotate-0 transition-all font-mono">
            <DialogHeader className="bg-black w-fit text-white px-4 py-2 inline-block mb-6 transform rotate-1">
              <DialogTitle className="text-xl font-bold">
                Booking Information
              </DialogTitle>
            </DialogHeader>

            <div className="bg-white p-4 border-4 border-black">
              <p className="leading-relaxed">
                Booking is disabled in this example app. You can book these
                travel plans on Booking.com (which is where the data comes
                from).
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
