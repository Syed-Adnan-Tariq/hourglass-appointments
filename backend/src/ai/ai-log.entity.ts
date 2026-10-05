import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_interaction_logs')
export class AiInteractionLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id: string;
  @Column({ name: 'session_id', type: 'uuid' }) sessionId: string;
  @Column({ type: 'varchar' }) model: string;
  @Column({ type: 'jsonb' }) request: unknown;
  @Column({ type: 'jsonb', nullable: true }) response: unknown;
  @Column({ name: 'latency_ms', type: 'int' }) latencyMs: number;
  @Column({ type: 'boolean' }) success: boolean;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
