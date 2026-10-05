import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SERVICES } from './booking-rules';

export class CreateAppointmentDto {
  @IsIn(SERVICES as unknown as string[], { message: `service must be one of: ${SERVICES.join(', ')}` })
  service: string;

  // Business-local date and time: the server owns timezone conversion, so clients never guess it.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }) date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' }) time: string;

  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class AvailabilityQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }) date: string;
}
