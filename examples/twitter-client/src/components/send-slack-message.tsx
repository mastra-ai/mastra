import React, { useState } from 'react';
import { FormEvent } from 'react';

import { useSlackConnection } from '@/lib/hooks/use-connection';

import { Spinner } from './ui/spinner';

interface ISendSlackMessage {
  sendMessage: (payload: { message: string; channelId: string }) => Promise<
    | {
        success: boolean;
        error?: undefined;
        data: unknown;
      }
    | {
        success: boolean;
        error: unknown;
        data?: undefined;
      }
  >;
}

export const SendSlackMessage: React.FC<ISendSlackMessage> = ({ sendMessage }) => {
  const [message, setMessage] = useState('');
  const [channelId, setChannelId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState(false);

  const { channels, isLoading: loadingChannels } = useSlackConnection();
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await sendMessage({ message, channelId });
    const { success, error } = res;
    setIsLoading(false);
    setSuccess(success);
    setError(error);
    if (success) {
      setMessage('');
      setChannelId('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-72">
      <select
        className="text-white text-xs bg-transparent w-full border border-[#353535] px-3 py-2 focus:border-[#4a154b] ring-offset-0 ring-offset-transparent ring-transparent focus-visible:ring-0 focus-visible:outline-none rounded"
        name="channel"
        title="Select channel"
        value={channelId}
        onChange={e => {
          const { value } = e.target;
          setChannelId(value);
        }}
      >
        <option value="">Select channel</option>
        {loadingChannels ? <option value="">Loading channels...</option> : null}
        {channels?.map(({ id, name }) => (
          <option value={id} key={id}>
            {name}
          </option>
        ))}
      </select>

      <textarea
        placeholder="Enter message"
        rows={4}
        className="text-white text-xs bg-transparent w-full resize-none border border-[#353535] px-3 py-2 focus:border-[#4a154b] ring-offset-0 ring-offset-transparent ring-transparent focus-visible:ring-0 focus-visible:outline-none rounded"
        value={message}
        onChange={e => {
          const { value } = e.target;
          setMessage(value);
        }}
      />

      {error ? <p className="text-red-500 text-xs">{(error as { message: string })?.message}</p> : null}
      {success ? <p className="text-green-500 text-xs">Message sent successfully</p> : null}

      <button
        type="submit"
        className="bg-[#4a154b] hover:bg-[#2c0d2d] text-white font-bold py-2 px-4 rounded flex gap-1 items-center justify-center"
      >
        {isLoading ? <Spinner fillColor="[#4a154b]" /> : null} Send Message
      </button>
    </form>
  );
};
