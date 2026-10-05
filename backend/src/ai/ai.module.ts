import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiInteractionLog } from './ai-log.entity';
import { AiService } from './ai.service';

@Module({ imports: [TypeOrmModule.forFeature([AiInteractionLog])], providers: [AiService], exports: [AiService] })
export class AiModule {}
