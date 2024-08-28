'use client';

import { format } from 'date-fns';
import { useState, useMemo, useEffect } from 'react';

import Link from 'next/link';

export interface Email {
  to: string[];
  date: string;
  from: string;
  subject: string;
  html: string;
  snippet: string;
  emailId: string;
}

interface EmailsClientLayoutProps {
  emails: Email[];
}

export default function EmailsClientLayout({ emails }: EmailsClientLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const truncateHtml = (html: string, maxLength: number) => {
    const truncated = html?.slice(0, maxLength);
    return truncated?.slice(0, truncated.lastIndexOf(' ')) + '...';
  };

  const toggleEmailExpansion = (emailId: string) => {
    setExpandedEmailId(expandedEmailId === emailId ? null : emailId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'h:mm a');
    } else if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'MMM d');
    } else {
      return format(date, 'MM/dd/yyyy');
    }
  };

  return (
    <div className="container mx-auto p-4 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-gray-800">Inbox</h1>
        <Link
          href="/compose"
          className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition duration-300 ease-in-out transform hover:scale-105"
        >
          Compose
        </Link>
      </div>
      <div className="space-y-4">
        {emails.map(email => (
          <div
            key={email.emailId}
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {email.from.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-800">{email.from}</p>
                  <p className="text-sm text-gray-500">To: {email.to.join(', ')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">{formatDate(email.date)}</p>
            </div>
            <p className="font-semibold text-xl mb-3 text-gray-700">{email.subject}</p>
            {mounted && (
              <>
                <div
                  className={`text-gray-600 mb-4 ${
                    expandedEmailId !== email.emailId ? 'line-clamp-3' : ''
                  } overflow-hidden`}
                  dangerouslySetInnerHTML={{
                    __html: expandedEmailId === email.emailId ? email.html : truncateHtml(email.html, 200),
                  }}
                />
                <button
                  onClick={() => toggleEmailExpansion(email.emailId)}
                  className="text-blue-500 hover:text-blue-700 font-medium transition duration-300 ease-in-out"
                >
                  {expandedEmailId === email.emailId ? 'Show less' : 'Read more'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
