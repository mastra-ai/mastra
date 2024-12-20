"use client";

import { format } from "date-fns";
import { Plane, Clock, Calendar, Coffee } from "lucide-react";
import { z } from "zod";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { flightSchema } from "@/app/utils";

export function isObjectEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

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
  layover,
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
        {/*depatureToLayover duration */}
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
          <div className="flex flex-col gap-2 items-center justify-center py-4">
            <Plane className="mx-2 h-4 w-4 rotate-90" />
            <div className="flex items-center font-medium space-x-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="text-black font-semibold font-mono">
                {layover ? layover.depatureToLayoverDuration : duration}
              </span>
            </div>
          </div>

          {/* Arrival Info */}
          {layover && !isObjectEmpty(layover) ? (
            <div className="space-y-2 text-right">
              <div className="text-sm text-gray-600">Arrival</div>
              {layover.arrivalTime && (
                <div className="text-3xl font-bold">
                  {format(layover.arrivalTime, "HH:mm")}
                </div>
              )}
              <div className="font-bold text-black">{layover.airport}</div>
              <div className="text-sm text-gray-600">{layover.city}</div>
              <div className="flex items-center justify-end text-black text-sm space-x-2">
                <Calendar className="h-4 w-4" />
                {layover.arrivalTime && (
                  <span className=" text-black text-sm">
                    {format(layover.arrivalTime, "EEE, MMM d")}
                  </span>
                )}
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {/* duration signifier */}
        {layover && !isObjectEmpty(layover) && (
          <div className="my-4 py-4 border-y-2 border-dashed border-black">
            <div className="flex items-center justify-center gap-2 font-mono">
              <Coffee className="w-4 h-4" />
              <span className="font-bold">
                {layover ? layover.durationAtLayover : duration} layover
              </span>
              <span>in</span>
              <span className="font-bold">
                {layover ? `${layover.city} (${layover.airport})` : ""}
              </span>
            </div>
          </div>
        )}

        {/* layoverToDestination duration */}
        {layover && !isObjectEmpty(layover) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Departure Info */}
            {layover && !isObjectEmpty(layover) ? (
              <div className="space-y-2 text-left">
                <div className="text-sm text-gray-600">Departure</div>
                {layover.departureTime && (
                  <div className="text-3xl font-bold">
                    {format(layover.departureTime, "HH:mm")}
                  </div>
                )}
                <div className="font-bold text-black">{layover.airport}</div>
                <div className="text-sm text-gray-600">{layover.city}</div>
                <div className="flex items-center justify-start text-black text-sm space-x-2">
                  <Calendar className="h-4 w-4" />
                  {layover.departureTime && (
                    <span className=" text-black text-sm">
                      {format(layover.departureTime, "EEE, MMM d")}
                    </span>
                  )}
                </div>
              </div>
            ) : (
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
            )}

            {/* Flight Duration */}
            <div className="flex flex-col gap-2 items-center justify-center py-4">
              <Plane className="mx-2 h-4 w-4 rotate-90" />
              <div className="flex items-center font-medium space-x-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="text-black font-semibold font-mono">
                  {layover ? layover.layoverToDestinationDuration : duration}
                </span>
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
        )}

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
