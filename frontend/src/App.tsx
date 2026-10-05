import { useCallback, useState } from 'react';
import { useAuth } from './lib/auth';
import type { Appointment, Booking } from './lib/api';
import AuthScreen from './components/AuthScreen';
import ChatPanel from './components/ChatPanel';
import BookingForm from './components/BookingForm';
import AppointmentList from './components/AppointmentList';
import { api } from './lib/api';
import { useEffect } from 'react';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // `nonce` lets the same prefill be applied again if the chat hands over the form twice.
  const [prefill, setPrefill] = useState<{ booking: Booking; nonce: number } | null>(null);

  const refresh = useCallback(async () => {
    try { setAppointments(await api.appointments()); setListError(null); }
    catch (e) { setListError(e instanceof Error ? e.message : 'Could not load appointments.'); }
  }, []);

  useEffect(() => { if (user) void refresh(); }, [user, refresh]);

  if (loading) return <p className="boot" role="status">Loading…</p>;
  if (!user) return <AuthScreen />;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Hourglass</h1>
        <div className="who">
          <span>{user.name}</span>
          <button className="link" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main className="layout">
        <ChatPanel
          onBooked={refresh}
          onOpenForm={(booking) => setPrefill({ booking, nonce: Date.now() })}
        />
        <div className="side">
          <BookingForm prefill={prefill} onBooked={refresh} />
          <AppointmentList items={appointments} error={listError} onChanged={refresh} />
        </div>
      </main>
    </div>
  );
}
