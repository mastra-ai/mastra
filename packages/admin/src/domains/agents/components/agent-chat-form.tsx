'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import Icon from '@/app/components/icon';

export const AgentChatForm = () => {
  const [value, setValue] = useState('');
  return (
    <form className="mx-auto mt-auto mb-8">
      <label htmlFor="chat-with-agent"></label>
      <div className="flex gap-2 items-center">
        <Input
          autoComplete="off"
          autoCapitalize="off"
          id="chat-with-agent"
          className="w-[40rem] py-5 px-3"
          placeholder="Chat with Agent"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <Button type="submit" className="rounded w-10 p-0">
          <Icon name="send" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  );
};
