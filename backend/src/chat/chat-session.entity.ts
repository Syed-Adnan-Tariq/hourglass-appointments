import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { BookingFields } from '../ai/ai.service';

export interface StoredMessage { role: 'user' | 'assistant'; content: string; at: string }
export interface SessionState { booking: BookingFields; misses: number }

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'business_id', type: 'uuid' }) businessId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', default: 'active' }) status: 'active' | 'completed';
  @Column({ type: 'jsonb', default: () => `'[]'` }) messages: StoredMessage[];
  @Column({ name: 'extracted_state', type: 'jsonb', default: () => `'{}'` }) extractedState: Partial<SessionState>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'last_message_at', type: 'timestamptz', default: () => 'now()' }) lastMessageAt: Date;
}
