import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { toUtc, toView } from './booking-rules';
import { AvailabilityQueryDto, CreateAppointmentDto } from './appointments.dto';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.appointments.listForUser(user)).map(toView);
  }

  @Get('services')
  services() {
    return this.appointments.services();
  }

  @Get('availability')
  async availability(@CurrentUser() user: AuthUser, @Query() q: AvailabilityQueryDto) {
    return { date: q.date, slots: await this.appointments.availability(user.businessId, q.date) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    const startsAt = toUtc(dto.date, dto.time);
    return toView(await this.appointments.create(user, { service: dto.service, startsAt, notes: dto.notes }, 'form'));
  }

  @Patch(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return toView(await this.appointments.cancel(user, id));
  }
}
