import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'business_id', type: 'uuid' }) businessId: string;
  @Column({ type: 'varchar' }) email: string;
  @Column({ name: 'password_hash', type: 'varchar' }) passwordHash: string;
  @Column({ type: 'varchar' }) name: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
