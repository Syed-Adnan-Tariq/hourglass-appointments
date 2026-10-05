import { useState } from 'react';
import { api, type Appointment } from '../lib/api';

interface Props {
  items: Appointment[] | null;
  error: string | null;
  onChanged: () => void;
}

export default function AppointmentList({ items, error, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel(id: string) {
    setBusyId(id); setActionError(null);
    try { await api.cancel(id); onChanged(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Could not cancel. Please try again.'); }
    finally { setBusyId(null); }
  }

  return (
    <section className="panel" aria-label="Your appointments">
      <div className="panel-head"><h2>Your appointments</h2></div>
      {error && <p className="error" role="alert">{error}</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {items === null && !error && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="muted">Nothing booked yet. Ask the assistant or use the form.</p>}
      <ul className="appts">
        {items?.map((a) => (
          <li key={a.id} className={a.status === 'cancelled' ? 'cancelled' : ''}>
            <div>
              <strong>{a.service}</strong>
              <span className="when">{a.date} at {a.time}</span>
              {a.notes && <span className="muted">{a.notes}</span>}
            </div>
            {a.status === 'confirmed'
              ? <button className="link danger" disabled={busyId === a.id} onClick={() => void cancel(a.id)}>{busyId === a.id ? 'Cancelling…' : 'Cancel'}</button>
              : <span className="tag">{a.status}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
