import React, { useState } from 'react';
import { FormEvent } from 'react';

import { Spinner } from './ui/spinner';

interface ICreateTweet {
  sendMessage: (payload: { post: string }) => Promise<
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

export const CreateTweet: React.FC<ICreateTweet> = ({ sendMessage }) => {
  const [tweet, setTweet] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await sendMessage({ post: tweet });
    const { success, error } = res;
    setIsLoading(false);
    setSuccess(success);
    setError(error);
    if (success) setTweet('');
  };
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-72">
      <textarea
        placeholder="Enter tweet"
        rows={4}
        className="text-white text-xs bg-transparent w-full resize-none border border-[#353535] px-3 py-2 focus:border-blue-500 ring-offset-0 ring-offset-transparent ring-transparent focus-visible:ring-0 focus-visible:outline-none rounded"
        value={tweet}
        onChange={e => {
          const { value } = e.target;
          setTweet(value);
        }}
      />

      {error ? <p className="text-red-500 text-xs">{(error as { message: string })?.message}</p> : null}
      {success ? <p className="text-green-500 text-xs">Tweet sent successfully</p> : null}

      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex gap-1 items-center justify-center"
      >
        {isLoading ? <Spinner fillColor="blue-500" /> : null} Send tweet
      </button>
    </form>
  );
};
