'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

import { MAJOR_AIRPORTS, FLIGHT_TIMES, HOTEL_PRICE_RANGES, INTERESTS } from '@/lib/types';
import { cn } from '@/lib/utils';

import { submitTravelForm } from './actions';

export default function TravelForm() {
  const router = useRouter();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [flightPriority, setFlightPriority] = useState([50]);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await submitTravelForm(formData);
      console.log(result.message);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Plan Your Trip</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="space-y-8">
            {/* Travel Info Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Travel Info</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departureLocation">Departure Location</Label>
                  <Select name="departureLocation">
                    <SelectTrigger>
                      <SelectValue placeholder="Select airport" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAJOR_AIRPORTS.map(airport => (
                        <SelectItem key={airport.value} value={airport.value}>
                          {airport.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrivalLocation">Arrival Location</Label>
                  <Select name="arrivalLocation">
                    <SelectTrigger>
                      <SelectValue placeholder="Select airport" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAJOR_AIRPORTS.map(airport => (
                        <SelectItem key={airport.value} value={airport.value}>
                          {airport.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Trip Goals Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Trip Goals</h3>
              <div className="space-y-2">
                <Label htmlFor="tripGoals">What are your goals for this trip?</Label>
                <Textarea
                  id="tripGoals"
                  name="tripGoals"
                  placeholder="Tell us about your trip goals..."
                  className="min-h-[100px]"
                />
              </div>
            </div>

            {/* Flight Preferences Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Flight Preferences</h3>

              <div className="space-y-2">
                <Label>Preferred Flight Times</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {FLIGHT_TIMES.map(time => (
                    <div key={time.value} className="flex items-center space-x-2">
                      <Checkbox id={time.value} name="preferredFlightTimes" value={time.value} />
                      <Label htmlFor={time.value}>{time.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>Price vs. Flight Time Priority</Label>
                <div className="px-2">
                  <Slider
                    name="flightPriority"
                    value={flightPriority}
                    onValueChange={setFlightPriority}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>Prioritize Price</span>
                    <span>Prioritize Convenience</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hotel Preferences Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Hotel Preferences</h3>
              <div className="space-y-2">
                <Label htmlFor="hotelPriceRange">Price Range</Label>
                <Select name="hotelPriceRange">
                  <SelectTrigger>
                    <SelectValue placeholder="Select price range" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOTEL_PRICE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attraction Preferences Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Attraction Preferences</h3>
              <div className="space-y-2">
                <Label>Interests</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {INTERESTS.map(interest => (
                    <div key={interest.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={interest.value}
                        name="interests"
                        value={interest.value}
                        checked={selectedInterests.includes(interest.value)}
                        onCheckedChange={checked => {
                          setSelectedInterests(
                            checked
                              ? [...selectedInterests, interest.value]
                              : selectedInterests.filter(i => i !== interest.value),
                          );
                        }}
                      />
                      <Label htmlFor={interest.value}>{interest.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Plan My Trip'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
