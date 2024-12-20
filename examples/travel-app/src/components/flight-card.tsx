"use client";

import { format } from "date-fns";
import { Plane, Clock, Calendar } from "lucide-react";
import { z } from "zod";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { flightSchema } from "@/app/utils";

type FlightCardProps = z.infer<typeof flightSchema>;

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
    <Card className="border-4 space-y-6 rounded-none border-black w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="font-bold text-lg font-mono">{airline}</div>
          <div className="text-sm font-mono">Flight {flightNumber}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Departure Info */}
          <div className="space-y-1">
            <div className="text-sm text-gray-600">Departure</div>
            {departureTime && (
              <div className="text-3xl font-bold">
                {format(departureTime, "HH:mm")}
              </div>
            )}
            <div className="font-bold text-black">{departureAirport}</div>
            <div className="text-sm text-gray-600">{departureCity}</div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              {departureTime && (
                <span className="text-black text-sm">
                  {format(departureTime, "EEE, MMM d")}
                </span>
              )}
            </div>
          </div>

          {/* Flight Duration */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="my-4 w-full flex items-center justify-center">
              <Plane className="mx-2 h-4 w-4 rotate-90" />
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>{duration}</span>
            </div>
          </div>

          {/* Arrival Info */}
          <div className="space-y-2 text-right">
            <div className="text-sm text-gray-600">Arrival</div>

            {arrivalTime && (
              <div className="text-3xl font-bold">
                {format(arrivalTime, "HH:mm")}
              </div>
            )}
            <div className="font-bold text-black">{arrivalAirport}</div>
            <div className="text-sm text-gray-600">{arrivalCity}</div>
            <div className="flex items-center justify-end text-black text-sm space-x-2">
              <Calendar className="h-4 w-4" />
              {arrivalTime && (
                <span className=" text-black text-sm">
                  {format(arrivalTime, "EEE, MMM d")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Price only - remove Book Now button */}
        <div className="mt-6 flex justify-end items-center">
          <div className="inline-block bg-[var(--brut-green)] px-4 py-2 border-2 border-black font-mono font-bold transform -rotate-1">
            ${price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
