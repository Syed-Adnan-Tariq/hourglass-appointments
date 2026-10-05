import { useEffect, useState, type FormEvent } from 'react';
import { api, type Booking } from '../lib/api';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the browser's zone

interface Props {
  prefill: { booking: Booking; nonce: number } | null;
  onBooked: () => void;
}

export default function BookingForm({ prefill, onBooked }: Props) {
  const [services, setServices] = useState<string[]>([]);
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.services().then(setServices).catch(() => setError('Could not load services. Refresh to try again.')); }, []);

  // The chat hands over whatever it understood so nobody retypes it.
  useEffect(() => {
    if (!prefill) return;
    const b = prefill.booking;
    setService(b.service ?? ''); setDate(b.date ?? ''); setTime(b.time ?? ''); setNotes(b.notes ?? '');
    setDone(null); setError(null);
  }, [prefill]);

  useEffect(() => {
    if (!date) { setSlots(null); return; }
    let cancelled = false;
    setSlots(null);
    api.availability(date)
      .then((r) => { if (!cancelled) setSlots(r.slots); })
      .catch((e) => { if (!cancelled) { setSlots([]); setError(e.message); } });
    return () => { cancelled = true; };
  }, [date]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!service || !date || !time) { setError('Choose a service, a date and a time.'); return; }
    setBusy(true); setError(null); setDone(null);
    try {
      await api.book({ service, date, time, notes: notes || undefined });
      setDone(`Booked: ${service} on ${date} at ${time}.`);
      setTime(''); setNotes('');
      onBooked();
      setSlots((await api.availability(date)).slots); // that slot is gone now
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book. Please try again.');
      if (date) api.availability(date).then((r) => setSlots(r.slots)).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} aria-label="Booking form">
      <div className="panel-head"><h2>Book with the form</h2></div>

      <label>Service
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">Choose a service</option>
          {services.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>

      <label>Date
        <input type="date" min={today()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
      </label>

      {date && (
        <fieldset className="slots">
          <legend>Available times</legend>
          {slots === null && <p className="muted">Checking availability…</p>}
          {slots?.length === 0 && <p className="muted">No times are free on this date. Try another day.</p>}
          <div className="slot-grid">
            {slots?.map((s) => (
              <button type="button" key={s} className={`slot ${s === time ? 'on' : ''}`} aria-pressed={s === time} onClick={() => setTime(s)}>{s}</button>
            ))}
          </div>
        </fieldset>
      )}

      <label>Notes <span className="muted">(optional)</span>
        <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="success" role="status">{done}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Booking…' : 'Book appointment'}</button>
    </form>
  );
}
