'use client';

import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

import { useSidebar } from '@/lib/sidebar-context';
import { PLACES, FLIGHT_TIMES, HOTEL_PRICE_RANGES, INTERESTS } from '@/lib/types';
import { cn } from '@/lib/utils';

import { runAgent, runWorkflow } from './actions';
import { TravelResults } from './travel-results';
import { TravelSchemaProps } from './utils';

interface TravelFormProps {
  executor: 'agent' | 'workflow';
  sidebarContent: {
    initial: React.ReactNode;
    submitted: React.ReactNode;
  };
}

const LOADING_MESSAGES = [
  'Planning your Trip',
  'Looking up Flight info',
  'Selecting your Flight',
  'Looking up accommodations',
  'Selecting your accommodation',
  'Finding things to do',
  'Putting together your trip plan',
];

export default function TravelForm({ executor, sidebarContent }: TravelFormProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState<Date>(new Date('5/12/25'));
  const [endDate, setEndDate] = useState<Date>(new Date('5/16/25'));
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [flightPriority, setFlightPriority] = useState([50]);
  const [submitting, setSubmitting] = useState(false);
  const [accommodationType, setAccommodationType] = useState<'hotel' | 'airbnb'>('hotel');
  const [showResults, setShowResults] = useState(false);
  const { setContent } = useSidebar();
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [showForm, setShowForm] = useState(true);
  const [travelData, setTravelData] = useState<TravelSchemaProps | null>(null);

  const runLoadingSequence = useCallback(async () => {
    for (let i = 0; i < LOADING_MESSAGES.length - 1; i++) {
      setLoadingMessage(LOADING_MESSAGES[i]);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    setLoadingMessage(LOADING_MESSAGES[LOADING_MESSAGES.length - 1]);
  }, []);

  // Create a client-side submit handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowForm(false);
    setSubmitting(true);
    setShowResults(false);

    // Start the loading sequence
    runLoadingSequence();

    // Get form data and add the dates
    const formData = new FormData(e.currentTarget);

    // Add the dates to formData in YYYY-MM-DD format if they exist
    if (startDate) {
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      formData.append('startDate', formattedStartDate);
    }
    if (endDate) {
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      formData.append('endDate', formattedEndDate);
    }

    try {
      if (executor === 'agent') {
        const result = await runAgent(formData);
        console.log(result.message);
        console.log(result.message);
        setTravelData(result.message);
      } else {
        const { results } = await runWorkflow({ userId: 'SYSTEM', formData });
        // console.log(result)
        // Need polling or some kind of way to get the workflow result
        // console.log(result.message);
        // setTravelData(result.message);

        setTravelData({
          flights: {
            outbound: results?.outboundFlight?.payload?.outboundFlightSelection?.typeSelection?.[0],
            return: results?.returnFlight?.payload?.returnFlightSelection?.typeSelection?.[0],
          },
          attractions: results?.attraction?.payload?.attractionSelection?.typeSelection || [],
          hotel: results?.hotel?.payload?.hotelSelection?.typeSelection?.[0],
        });
      }
      setShowResults(true);
      setContent(sidebarContent.submitted);
      router.refresh();
    } catch (error) {
      toast.error("An error occured, I can't plan trip");
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // When component mounts, set initial sidebar content
  useEffect(() => {
    setContent(sidebarContent.initial);
  }, [setContent, sidebarContent.initial]);

  return (
    <div className="container mx-auto py-8">
      {showResults && travelData ? (
        <TravelResults travelData={travelData} />
      ) : showForm ? (
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Travel Info Section */}
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Travel Info</CardTitle>
                <CardDescription>Select your travel dates and locations</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
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
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={date => setStartDate(date as Date)}
                        initialFocus
                        disabled={date => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                      />
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
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={date => {
                          if (date) {
                            const maxDate = new Date(startDate);
                            maxDate.setDate(startDate.getDate() + 90);

                            if (date > maxDate) {
                              toast.error('End date cannot be more than 90 days from start date');
                              return;
                            }

                            if (date < startDate) {
                              toast.error('End date cannot be before start date');
                              return;
                            }

                            setEndDate(date);
                          }
                        }}
                        initialFocus
                      />
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
                      {PLACES.map(airport => (
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
                      {PLACES.map(airport => (
                        <SelectItem key={airport.value} value={airport.value}>
                          {airport.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Trip Goals Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Trip Goals</CardTitle>
                <CardDescription>What are your goals for this trip?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  id="tripGoals"
                  name="tripGoals"
                  placeholder="Tell us about your trip goals..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            {/* Flight Preferences Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-medium">Flight Preferences</CardTitle>
                <CardDescription>Choose your preferred flight options</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Preferred Flight Times</Label>
                  <div className="grid grid-cols-1 md:flex gap-4">
                    {FLIGHT_TIMES.map(time => (
                      <div key={time.value} className="flex items-center space-x-2">
                        <Checkbox id={time.value} name="preferredFlightTimes" value={time.value} />
                        <Label htmlFor={time.value}>{time.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Price vs. Flight Time Priority</Label>
                  <div>
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
              </CardContent>
            </Card>

            {/* Accommodation Preferences Section */}
            <Card>
              <CardHeader className="text-xl font-medium">
                <CardTitle>Accommodation Preferences</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Accommodation Type</Label>
                  <RadioGroup
                    name="accommodationType"
                    value={accommodationType}
                    onValueChange={value => setAccommodationType(value as 'hotel' | 'airbnb')}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="hotel" id="hotel" />
                      <Label htmlFor="hotel">Hotel</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="airbnb" id="airbnb" />
                      <Label htmlFor="airbnb">AirBnB</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priceRange">Price Range</Label>
                  <Select name={`${accommodationType}PriceRange`}>
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

                {accommodationType === 'airbnb' && (
                  <div className="space-y-2">
                    <Label>Property Type</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="entirePlace" name="propertyType" value="entirePlace" />
                        <Label htmlFor="entirePlace">Entire Place</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="privateRoom" name="propertyType" value="privateRoom" />
                        <Label htmlFor="privateRoom">Private Room</Label>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attraction Preferences Section */}
            <Card>
              <CardHeader className="text-xl font-medium">
                <CardTitle>Attraction Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>

            <Button type="submit" className="w-full py-5" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Plan My Trip'}
            </Button>
          </form>
        </div>
      ) : (
        <Card className="min-h-[400px] max-w-2xl mx-auto grid place-items-center">
          <CardContent className="flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-2 mt-12">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground animate-fade-in">{loadingMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
