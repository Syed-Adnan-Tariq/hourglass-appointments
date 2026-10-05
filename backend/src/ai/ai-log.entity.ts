import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_interaction_logs')
export class AiInteractionLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id: string;
  @Column({ name: 'session_id', type: 'char', length: 36 }) sessionId: string;
  @Column({ type: 'varchar' }) model: string;
  @Column({ type: 'json' }) request: unknown;
  @Column({ type: 'json', nullable: true }) response: unknown;
  @Column({ name: 'latency_ms', type: 'int' }) latencyMs: number;
  @Column({ type: 'boolean' }) success: boolean;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
