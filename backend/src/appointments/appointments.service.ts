import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Not, Repository } from 'typeorm';
import { Appointment, AppointmentSource } from './appointment.entity';
import { SERVICES, SLOT_MINUTES, daySlots, matchService, slotProblem, toUtc } from './booking-rules';

interface Actor { id: string; businessId: string }

@Injectable()
export class AppointmentsService {
  constructor(@InjectRepository(Appointment) private readonly repo: Repository<Appointment>) {}

  services() {
    return SERVICES;
  }

  /** Validates a slot against rules and existing bookings without writing. */
  async assertBookable(businessId: string, startsAt: Date) {
    const problem = slotProblem(startsAt);
    if (problem) throw new BadRequestException(problem);
    const taken = await this.repo.exists({ where: { businessId, startsAt, status: Not('cancelled') } });
    if (taken) throw new ConflictException('That slot is already booked.');
  }

  async create(actor: Actor, input: { service: string; startsAt: Date; notes?: string | null }, source: AppointmentSource) {
    const service = matchService(input.service);
    if (!service) throw new BadRequestException(`Choose one of: ${SERVICES.join(', ')}.`);
    await this.assertBookable(actor.businessId, input.startsAt);
    try {
      return await this.repo.save(
        this.repo.create({
          businessId: actor.businessId,
          userId: actor.id,
          service,
          startsAt: input.startsAt,
          endsAt: new Date(input.startsAt.getTime() + SLOT_MINUTES * 60_000),
          source,
          notes: input.notes?.trim() || null,
        }),
      );
    } catch (e: any) {
      // Two people raced for the same slot: the unique index on the active slot caught it.
      if (e?.code === 'ER_DUP_ENTRY' || e?.driverError?.code === 'ER_DUP_ENTRY') throw new ConflictException('That slot is already booked.');
      throw e;
    }
  }

  listForUser(actor: Actor) {
    return this.repo.find({ where: { userId: actor.id, businessId: actor.businessId }, order: { startsAt: 'ASC' } });
  }

  async cancel(actor: Actor, id: string) {
    const appt = await this.repo.findOne({ where: { id, userId: actor.id, businessId: actor.businessId } });
    if (!appt) throw new NotFoundException('Appointment not found.');
    if (appt.status === 'cancelled') return appt;
    appt.status = 'cancelled';
    return this.repo.save(appt);
  }

  /** Free "HH:mm" slots for a business-local date. */
  async availability(businessId: string, date: string) {
    const dayStart = toUtc(date, '00:00');
    if (Number.isNaN(dayStart.getTime())) throw new BadRequestException('date must be YYYY-MM-DD');
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000 - 1);
    const booked = await this.repo.find({
      select: { startsAt: true },
      where: { businessId, status: Not('cancelled'), startsAt: Between(dayStart, dayEnd) },
    });
    const takenMs = new Set(booked.map((b) => b.startsAt.getTime()));
    return daySlots().filter((t) => {
      const start = toUtc(date, t);
      return !takenMs.has(start.getTime()) && !slotProblem(start);
    });
  }
}
