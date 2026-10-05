import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed';
export type AppointmentSource = 'chat' | 'form';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'business_id', type: 'char', length: 36 }) businessId: string;
  @Column({ name: 'user_id', type: 'char', length: 36 }) userId: string;
  @Column({ type: 'varchar' }) service: string;
  @Column({ name: 'starts_at', type: 'datetime', precision: 3 }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'datetime', precision: 3 }) endsAt: Date;
  @Column({ type: 'varchar', default: 'confirmed' }) status: AppointmentStatus;
  @Column({ type: 'varchar' }) source: AppointmentSource;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
