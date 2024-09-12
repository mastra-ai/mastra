'use client';

import React, { useState } from 'react';

import { useEvents } from '@/lib/hooks/use-connection';

import { Spinner } from './ui/spinner';

export const TriggerEventButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<unknown>();

  const { triggerEvent } = useEvents();

  const handleTriggerEvent = async () => {
    setIsLoading(true);
    const res = await triggerEvent({ payload: null, eventKey: 'BUTTON_CLICKED' });
    const { success, error } = res;
    setIsLoading(false);
    setSuccess(success);
    setError(error);
  };

  return (
    <div className="flex flex-col gap-4 w-72">
      {error ? <p className="text-red-500 text-xs">{(error as { message: string })?.message}</p> : null}
      {success ? <p className="text-green-500 text-xs">Event triggered successfully</p> : null}
      <button
        type="button"
        className="bg-blue-500 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded flex gap-1 items-center justify-center"
        onClick={handleTriggerEvent}
      >
        {isLoading ? <Spinner fillColor="[#4a154b]" /> : null} Trigger event
      </button>
    </div>
  );
};
