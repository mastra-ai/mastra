'use server';

import { randomUUID } from 'crypto';

import { cookies } from 'next/headers';

export const setSession = async () => {
  return cookies().set('session', randomUUID());
};

export const getSession = async () => {
  return cookies().get('session')?.value;
};

export const clearSession = async () => {
  return cookies().delete('session');
};
