import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional() @IsUUID() sessionId?: string;
  @IsString() @MinLength(1) @MaxLength(1000) message: string;
}
