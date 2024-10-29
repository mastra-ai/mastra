import { Metadata } from 'next';

import LogsClientLayout from './client-layout';

export const metadata: Metadata = {
  title: 'Logs',
  description: 'Logs ...',
};

export default function Logs() {
  return <LogsClientLayout />;
}
