import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService, AiUnavailableError, BookingFields } from '../ai/ai.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { localParts, toUtc, toView } from '../appointments/booking-rules';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { ChatSession, SessionState, StoredMessage } from './chat-session.entity';

const MAX_UNCLEAR_TURNS = 3;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ChatReply {
  sessionId: string;
  reply: string;
  booking: BookingFields;
  appointment?: unknown;
  /** True when the UI should offer the structured form (AI down, or conversation is going nowhere). */
  requiresForm: boolean;
}

/**
 * Orchestrates one conversation turn. The AI proposes; this service disposes:
 * every booking passes through the same AppointmentsService rules as the form.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession) private readonly sessions: Repository<ChatSession>,
    private readonly ai: AiService,
    private readonly appointments: AppointmentsService,
  ) {}

  async current(user: AuthUser) {
    const s = await this.sessions.findOne({
      where: { userId: user.id, businessId: user.businessId, status: 'active' },
      order: { lastMessageAt: 'DESC' },
    });
    return s ? { sessionId: s.id, messages: s.messages, booking: this.state(s).booking } : null;
  }

  async send(user: AuthUser, dto: { sessionId?: string; message: string }): Promise<ChatReply> {
    const session = dto.sessionId ? await this.load(user, dto.sessionId) : await this.create(user);
    const state = this.state(session);
    this.push(session, 'user', dto.message.trim());

    let reply: string;
    let appointment: unknown;
    let requiresForm = false;

    try {
      const now = localParts(new Date());
      const result = await this.ai.extractBooking(
        session.id,
        session.messages.map(({ role, content }) => ({ role, content })),
        state.booking,
        { today: now.date, weekday: WEEKDAYS[now.weekday] },
      );

      const fieldsFound = Object.keys(result.fields).length > 0;
      const before = JSON.stringify(state.booking);
      state.booking = { ...state.booking, ...result.fields };
      const changed = before !== JSON.stringify(state.booking);
      state.misses = fieldsFound || changed ? 0 : state.misses + 1;
      reply = result.reply;

      const { service, date, time } = state.booking;
      if (service && date && time) {
        const startsAt = toUtc(date, time);
        try {
          if (result.confirmed && !changed) {
            const appt = await this.appointments.create(user, { service, startsAt, notes: state.booking.notes }, 'chat');
            appointment = toView(appt);
            session.status = 'completed';
            reply = `You're booked: ${service} on ${date} at ${time}. You can see it in your appointments.`;
          } else {
            // Check early so the user hears "that slot is taken" before they confirm.
            await this.appointments.assertBookable(user.businessId, startsAt);
          }
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
          reply = `${this.messageOf(e)} Which other date or time works for you?`;
          state.booking = { ...state.booking, date: undefined, time: undefined };
        }
      }

      if (!appointment && state.misses >= MAX_UNCLEAR_TURNS) {
        requiresForm = true;
        reply = `${reply} If it's easier, you can finish with the booking form instead.`;
      }
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
      requiresForm = true;
      reply = "I'm having trouble understanding right now. You can book with the form instead, and I've kept the details we have so far.";
    }

    session.extractedState = state;
    this.push(session, 'assistant', reply);
    await this.sessions.save(session);
    return { sessionId: session.id, reply, booking: this.clean(state.booking), appointment, requiresForm };
  }

  private async load(user: AuthUser, id: string) {
    const s = await this.sessions.findOne({ where: { id, userId: user.id, businessId: user.businessId } });
    if (!s) throw new NotFoundException('Conversation not found.');
    return s;
  }

  private create(user: AuthUser) {
    return this.sessions.save(this.sessions.create({ userId: user.id, businessId: user.businessId, messages: [], extractedState: {}, lastMessageAt: new Date() }));
  }

  private state(s: ChatSession): SessionState {
    return { booking: s.extractedState?.booking ?? {}, misses: s.extractedState?.misses ?? 0 };
  }

  private push(s: ChatSession, role: StoredMessage['role'], content: string) {
    const at = new Date();
    s.messages = [...s.messages, { role, content, at: at.toISOString() }];
    s.lastMessageAt = at;
  }

  private clean(b: BookingFields): BookingFields {
    return Object.fromEntries(Object.entries(b).filter(([, v]) => v)) as BookingFields;
  }

  private messageOf(e: HttpException): string {
    const body = e.getResponse() as any;
    return typeof body === 'string' ? body : [body.message].flat().join(' ');
  }
}
