import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  TRADES,
  appointments,
  createAppointment,
  customers,
  describeDate,
  findAppointmentByCode,
  openSlots,
  simulateBackendLatency,
  upcomingBusinessDays,
} from '../data';
import type { TradeId } from '../data';

const tradeSchema = z.enum(['plumbing', 'electrical', 'roofing', 'carpentry', 'painting']);

function appointmentSummary(appointmentId: string) {
  const appointment = appointments.find(a => a.id === appointmentId);
  if (!appointment) return undefined;
  return {
    confirmationCode: appointment.confirmationCode,
    trade: TRADES[appointment.trade].label,
    date: appointment.date,
    dateSpoken: describeDate(appointment.date),
    time: appointment.time,
    status: appointment.status,
  };
}

export const lookupCustomer = createTool({
  id: 'lookupCustomer',
  description:
    'Look up a customer record by phone number or name. Returns the profile, property type, notes, and any upcoming site visits.',
  inputSchema: z.object({
    phone: z.string().optional().describe('Phone number, any format'),
    name: z.string().optional().describe('Full or partial name'),
  }),
  execute: async ({ phone, name }) => {
    await simulateBackendLatency();
    const digits = phone?.replace(/\D/g, '');
    const needle = name?.trim().toLowerCase();
    const customer = customers.find(c => {
      if (digits && c.phone.replace(/\D/g, '').endsWith(digits)) return true;
      if (needle && c.name.toLowerCase().includes(needle)) return true;
      return false;
    });
    if (!customer) {
      return { found: false as const, message: 'No customer matched that phone number or name.' };
    }
    const upcoming = appointments
      .filter(a => a.customerId === customer.id && a.status === 'confirmed')
      .map(a => appointmentSummary(a.id));
    return { found: true as const, customer, upcomingVisits: upcoming };
  },
});

export const checkAvailability = createTool({
  id: 'checkAvailability',
  description:
    'Check open site-visit slots for a trade. Without a date it returns the next three business days; dates are ISO format with a spoken label.',
  inputSchema: z.object({
    trade: tradeSchema,
    date: z.string().optional().describe('ISO date like 2026-06-12. Omit to see the next few days.'),
  }),
  execute: async ({ trade, date }) => {
    await simulateBackendLatency();
    const days = date ? [date] : upcomingBusinessDays(3);
    return {
      trade: TRADES[trade as TradeId].label,
      durationMinutes: TRADES[trade as TradeId].durationMinutes,
      availability: days.map(day => ({
        date: day,
        dateSpoken: describeDate(day),
        openTimes: openSlots(day),
      })),
    };
  },
});

export const bookAppointment = createTool({
  id: 'bookAppointment',
  description:
    'Book a site visit for a customer. Requires the customer id from lookupCustomer and a slot from checkAvailability. Returns a confirmation code.',
  inputSchema: z.object({
    customerId: z.string(),
    trade: tradeSchema,
    date: z.string().describe('ISO date like 2026-06-12'),
    time: z.string().describe('24-hour time like 14:00'),
  }),
  execute: async ({ customerId, trade, date, time }) => {
    await simulateBackendLatency();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      return { booked: false as const, message: `Unknown customer id ${customerId}. Look the customer up first.` };
    }
    if (!openSlots(date).includes(time)) {
      return {
        booked: false as const,
        message: `${time} on ${describeDate(date)} is not available.`,
        openTimes: openSlots(date),
      };
    }
    const appointment = createAppointment({ customerId, trade: trade as TradeId, date, time });
    return {
      booked: true as const,
      confirmationCode: appointment.confirmationCode,
      summary: appointmentSummary(appointment.id),
    };
  },
});

export const rescheduleAppointment = createTool({
  id: 'rescheduleAppointment',
  description: 'Move an existing site visit to a new date and time using its confirmation code.',
  inputSchema: z.object({
    confirmationCode: z.string().describe('Code like MT-1001'),
    date: z.string().describe('New ISO date'),
    time: z.string().describe('New 24-hour time'),
  }),
  execute: async ({ confirmationCode, date, time }) => {
    await simulateBackendLatency();
    const appointment = findAppointmentByCode(confirmationCode);
    if (!appointment || appointment.status !== 'confirmed') {
      return { rescheduled: false as const, message: 'No active site visit found for that confirmation code.' };
    }
    // openSlots(date) excludes this visit's own slot (it's booked by it), so a no-op
    // move to the same date/time would otherwise read as unavailable.
    const isSameSlot = appointment.date === date && appointment.time === time;
    const availableTimes = openSlots(date);
    if (!isSameSlot && !availableTimes.includes(time)) {
      return {
        rescheduled: false as const,
        message: `${time} on ${describeDate(date)} is not available.`,
        openTimes: availableTimes,
      };
    }
    appointment.date = date;
    appointment.time = time;
    return { rescheduled: true as const, summary: appointmentSummary(appointment.id) };
  },
});

export const cancelAppointment = createTool({
  id: 'cancelAppointment',
  description: 'Cancel a site visit using its confirmation code.',
  inputSchema: z.object({
    confirmationCode: z.string().describe('Code like MT-1001'),
  }),
  execute: async ({ confirmationCode }) => {
    await simulateBackendLatency();
    const appointment = findAppointmentByCode(confirmationCode);
    if (!appointment || appointment.status !== 'confirmed') {
      return { cancelled: false as const, message: 'No active site visit found for that confirmation code.' };
    }
    appointment.status = 'cancelled';
    return { cancelled: true as const, summary: appointmentSummary(appointment.id) };
  },
});
