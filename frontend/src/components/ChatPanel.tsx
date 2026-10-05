import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Booking, type ChatMessage } from '../lib/api';

const GREETING: ChatMessage = {
  role: 'assistant',
  at: '',
  content: 'Hi, I can book your appointment. Tell me what you need and when, for example "a checkup next Tuesday morning".',
};
const SUGGESTIONS = ['Book a checkup tomorrow at 10', 'I need a follow-up on Friday afternoon'];

interface Props {
  onBooked: () => void;
  onOpenForm: (booking: Booking) => void;
}

export default function ChatPanel({ onBooked, onOpenForm }: Props) {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOffer, setFormOffer] = useState<Booking | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Resume the in-progress conversation after a refresh.
  useEffect(() => {
    let cancelled = false;
    api.currentChat().then((s) => {
      if (cancelled || !s) return;
      setSessionId(s.sessionId);
      setMessages([GREETING, ...s.messages]);
    }).catch(() => { /* a fresh conversation is a fine fallback */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setFormOffer(null);
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message, at: new Date().toISOString() }]);
    try {
      const r = await api.sendMessage({ sessionId, message });
      setSessionId(r.appointment ? undefined : r.sessionId); // a finished booking ends the conversation
      setMessages((m) => [...m, { role: 'assistant', content: r.reply, at: new Date().toISOString() }]);
      if (r.appointment) onBooked();
      if (r.requiresForm) setFormOffer(r.booking);
    } catch (e) {
      // Take the optimistic message back so retrying doesn't duplicate it.
      setMessages((m) => m.slice(0, -1));
      setInput(message);
      setError(e instanceof Error ? e.message : 'Message not sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void send(input); };
  const fresh = messages.length === 1;

  return (
    <section className="panel chat" aria-label="Booking assistant">
      <div className="panel-head">
        <h2>Chat with the assistant</h2>
        {!fresh && (
          <button className="link" onClick={() => { setSessionId(undefined); setMessages([GREETING]); setFormOffer(null); setError(null); }}>
            New conversation
          </button>
        )}
      </div>

      <div className="messages" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
        {sending && <div className="bubble assistant typing" aria-label="Assistant is typing"><i /><i /><i /></div>}
        {formOffer && (
          <div className="offer">
            <button className="secondary" onClick={() => onOpenForm(formOffer)}>Open the booking form</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {fresh && (
        <div className="chips">
          {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => void send(s)}>{s}</button>)}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <form className="composer" onSubmit={onSubmit}>
        <input
          value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000}
          placeholder="Type your request" aria-label="Message" disabled={sending}
        />
        <button className="primary" disabled={sending || !input.trim()}>Send</button>
      </form>
    </section>
  );
}
