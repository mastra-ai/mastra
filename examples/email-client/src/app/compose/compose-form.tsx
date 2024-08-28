'use client';

import { useRef } from 'react';

import { useToast } from '@/components/ui/use-toast';

import { sendEmailAction } from './actions/form-action';
import { SendButton } from './send-button';

export default function ComposeForm() {
  const { toast } = useToast();
  const ref = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const res = await sendEmailAction(formData);
    if (res.success) {
      toast({
        title: 'Email sent',
        description: 'Your email has been sent',
      });
      ref.current?.reset();
    }
  };

  return (
    <form ref={ref} action={handleSubmit as any} className="space-y-4">
      <div>
        <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
          To (separate multiple emails with commas)
        </label>
        <input
          type="text"
          id="to"
          name="to"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
          Subject
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <div>
        <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={10}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          required
        ></textarea>
      </div>
      <div>
        <SendButton />
      </div>
    </form>
  );
}
