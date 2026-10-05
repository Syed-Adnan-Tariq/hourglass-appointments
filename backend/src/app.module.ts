import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ChatModule } from './chat/chat.module';
import { User } from './users/user.entity';
import { Appointment } from './appointments/appointment.entity';
import { ChatSession } from './chat/chat-session.entity';
import { AiInteractionLog } from './ai/ai-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global baseline: 100 requests/min per IP. Auth and chat tighten this per route.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      url: process.env.DATABASE_URL,
      timezone: 'Z', // DATETIME columns hold UTC
      charset: 'utf8mb4',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      entities: [User, Appointment, ChatSession, AiInteractionLog],
      synchronize: false, // schema is owned by db/schema.sql
    }),
    AuthModule,
    AppointmentsModule,
    ChatModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
