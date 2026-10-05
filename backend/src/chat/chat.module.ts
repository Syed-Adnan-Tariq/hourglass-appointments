import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSession } from './chat-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession]), AiModule, AppointmentsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
