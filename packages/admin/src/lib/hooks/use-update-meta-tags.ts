'use client';

import { useEffect } from 'react';

export const useUpdateMetaTags = ({ title, description }: { title: string; description?: string }) => {
  useEffect(() => {
    document.title = title;

    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      }
    }
  }, [title, description]);

  return {};
};
