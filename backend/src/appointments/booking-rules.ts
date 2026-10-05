/**
 * Pure business rules for booking. No framework imports, no I/O: easy to unit test,
 * and the single place that decides what a valid slot is.
 */
export const SERVICES = ['Consultation', 'Follow-up', 'Checkup'] as const;
export const SLOT_MINUTES = 30;
export const OPEN_HOUR = 9; // inclusive, business-local
export const CLOSE_HOUR = 17; // last slot ends at 17:00
const MIN_NOTICE_MINUTES = 30;

const offset = () => process.env.BUSINESS_UTC_OFFSET ?? '+00:00';

function offsetMinutes(): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset());
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** "2026-10-05" + "14:30" in business-local time -> UTC Date. */
export function toUtc(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${offset()}`);
}

/** Business-local calendar parts for a UTC instant. */
export function localParts(d: Date) {
  const shifted = new Date(d.getTime() + offsetMinutes() * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

export function matchService(input: string | undefined): (typeof SERVICES)[number] | undefined {
  if (!input) return undefined;
  const needle = input.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return SERVICES.find((s) => s.toLowerCase() === needle || s.toLowerCase().replace('-', '') === needle.replace('-', ''));
}

/** Returns a user-facing reason if the start time is not bookable, otherwise null. */
export function slotProblem(start: Date, now = new Date()): string | null {
  if (Number.isNaN(start.getTime())) return 'That date or time is not valid.';
  if (start.getTime() < now.getTime() + MIN_NOTICE_MINUTES * 60_000) return 'That time has already passed or is too soon to book.';
  const p = localParts(start);
  if (p.weekday === 0 || p.weekday === 6) return 'We are closed on weekends. Please choose a weekday.';
  if (p.minute % SLOT_MINUTES !== 0) return `Appointments start on the hour or half hour.`;
  const minutesOfDay = p.hour * 60 + p.minute;
  if (minutesOfDay < OPEN_HOUR * 60 || minutesOfDay + SLOT_MINUTES > CLOSE_HOUR * 60) {
    return `We take appointments between ${OPEN_HOUR}:00 and ${CLOSE_HOUR}:00.`;
  }
  return null;
}

/** All slot start times ("HH:mm") in a business day. */
export function daySlots(): string[] {
  const out: string[] = [];
  for (let m = OPEN_HOUR * 60; m + SLOT_MINUTES <= CLOSE_HOUR * 60; m += SLOT_MINUTES) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/** API shape for an appointment: UTC instants plus business-local date/time the UI can show as-is. */
export function toView(a: { id: string; service: string; status: string; source: string; notes: string | null; startsAt: Date; endsAt: Date }) {
  const p = localParts(a.startsAt);
  const time = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  return { id: a.id, service: a.service, status: a.status, source: a.source, notes: a.notes, startsAt: a.startsAt, endsAt: a.endsAt, date: p.date, time };
}
