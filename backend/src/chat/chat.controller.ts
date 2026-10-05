import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { SendMessageDto } from './chat.dto';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('sessions/current')
  current(@CurrentUser() user: AuthUser) {
    return this.chat.current(user);
  }

  // Each message costs an LLM call, so this is the tightest limit: 20/min per IP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('messages')
  send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.chat.send(user, dto);
  }
}
