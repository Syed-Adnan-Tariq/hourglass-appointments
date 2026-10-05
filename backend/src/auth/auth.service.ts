import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { LoginDto, SignupDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>, private readonly jwt: JwtService) {}

  private get businessId() {
    return process.env.DEFAULT_BUSINESS_ID!;
  }

  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.findOne({ where: { email, businessId: this.businessId } })) {
      throw new ConflictException('An account with this email already exists.');
    }
    const user = await this.users.save(
      this.users.create({
        businessId: this.businessId,
        email,
        name: dto.name.trim(),
        passwordHash: await bcrypt.hash(dto.password, 10),
      }),
    );
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email.toLowerCase(), businessId: this.businessId } });
    // Same message for unknown email and wrong password: don't reveal which accounts exist.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.session(user);
  }

  profile(userId: string) {
    return this.users.findOneByOrFail({ id: userId }).then((u) => this.publicUser(u));
  }

  private publicUser(u: User) {
    return { id: u.id, name: u.name, email: u.email };
  }

  private async session(user: User) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, businessId: user.businessId, email: user.email });
    return { accessToken, user: this.publicUser(user) };
  }
}
