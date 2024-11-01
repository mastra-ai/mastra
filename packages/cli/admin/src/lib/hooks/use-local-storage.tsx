'use client';

import { useLayoutEffect, useState } from 'react';

const localStorageCacheVersion = 2.1;

const useLocalStorage = <T,>(
  key: string,
  initialValue: T,
  // eslint-disable-next-line no-unused-vars
): [T, (value: T) => void, () => void, string] => {
  const [storedValue, setStoredValue] = useState(initialValue);

  useLayoutEffect(() => {
    // Retrieve from localStorage
    const item = window.localStorage.getItem(key);
    if (item) {
      try {
        setStoredValue(JSON.parse(item));
      } catch (err) {
        // Stored item is not JSON
        setStoredValue(item as T);
      }
    }
  }, [key]);

  const setValue = (value: T) => {
    // Save state
    setStoredValue(value);
    // Save to localStorage
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  const clearValue = () => {
    // Clear state
    setStoredValue(initialValue);
    // Remove from localStorage
    window.localStorage.removeItem(key);
  };

  return [storedValue, setValue, clearValue, key];
};

export const clearLocalStorage = () => {
  window.localStorage.clear();
  window.localStorage.setItem('LOCAL_STORAGE_CACHE_VERSION', String(localStorageCacheVersion));
};

if (typeof window !== 'undefined') {
  // Clear local storage if the version is different
  // Useful for clearing local storage when breaking changes are deployed
  const savedVersionStr = window.localStorage.getItem('LOCAL_STORAGE_CACHE_VERSION');
  const savedVersion = Number(savedVersionStr || 0);
  if (localStorageCacheVersion > savedVersion) clearLocalStorage();
}

export default useLocalStorage;
