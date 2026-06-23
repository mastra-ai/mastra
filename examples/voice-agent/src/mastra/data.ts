/**
 * In-memory "CRM" for the BrightSmile Dental demo. Resets on every worker restart,
 * which is exactly what you want for a smoke test.
 */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  insurancePlan: string;
  notes: string;
}

export interface Appointment {
  id: string;
  confirmationCode: string;
  customerId: string;
  service: ServiceId;
  date: string; // ISO date, e.g. 2026-06-12
  time: string; // 24h, e.g. 14:00
  status: 'confirmed' | 'cancelled';
}

export const SERVICES = {
  cleaning: { label: 'teeth cleaning', durationMinutes: 60 },
  checkup: { label: 'checkup and exam', durationMinutes: 30 },
  whitening: { label: 'teeth whitening', durationMinutes: 90 },
  filling: { label: 'cavity filling', durationMinutes: 60 },
} as const;

export type ServiceId = keyof typeof SERVICES;

export const customers: Customer[] = [
  {
    id: 'cus_001',
    name: 'Shane Thomas',
    phone: '555-0142',
    email: 'shane@example.com',
    insurancePlan: 'DeltaCare Premium',
    notes: 'Prefers morning appointments. Sensitive to cold.',
  },
  {
    id: 'cus_002',
    name: 'Sam Bhagwat',
    phone: '555-0177',
    email: 'sam@example.com',
    insurancePlan: 'BlueShield Basic',
    notes: 'New patient as of this year.',
  },
  {
    id: 'cus_003',
    name: 'Abhi Aiyer',
    phone: '555-0163',
    email: 'abhi@example.com',
    insurancePlan: 'No insurance on file',
    notes: 'Asked about whitening pricing last visit.',
  },
];

export const appointments: Appointment[] = [];

const OPEN_HOURS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

function toIsoDate(date: Date): string {
  // Build from local components: upcomingBusinessDays() filters weekdays with the local
  // getDay(), so a UTC toISOString() here could shift the day and desync the two.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function describeDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** The next `count` weekdays starting tomorrow. */
export function upcomingBusinessDays(count: number): string[] {
  const days: string[] = [];
  const cursor = new Date();
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) days.push(toIsoDate(cursor));
  }
  return days;
}

export function openSlots(date: string): string[] {
  const booked = appointments
    .filter(appointment => appointment.date === date && appointment.status === 'confirmed')
    .map(appointment => appointment.time);
  return OPEN_HOURS.filter(time => !booked.includes(time));
}

let nextAppointmentNumber = 1000;

export function createAppointment(input: Omit<Appointment, 'id' | 'confirmationCode' | 'status'>): Appointment {
  nextAppointmentNumber += 1;
  const appointment: Appointment = {
    ...input,
    id: `apt_${nextAppointmentNumber}`,
    confirmationCode: `BSD-${nextAppointmentNumber}`,
    status: 'confirmed',
  };
  appointments.push(appointment);
  return appointment;
}

export function findAppointmentByCode(confirmationCode: string): Appointment | undefined {
  const normalized = confirmationCode.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return appointments.find(
    appointment => appointment.confirmationCode.replace(/[^a-z0-9]/gi, '').toLowerCase() === normalized,
  );
}

/** Simulates a slow backend so the voice tool-feedback filler is audible. */
export function simulateBackendLatency(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 600));
}

// Seed one existing appointment for Maya so lookups have something to find.
const seedDate = upcomingBusinessDays(5)[2]!;
createAppointment({ customerId: 'cus_001', service: 'cleaning', date: seedDate, time: '10:00' });
