import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser { id: string; businessId: string; email: string }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Sign in to continue.');
    try {
      const p = await this.jwt.verifyAsync(token);
      req.user = { id: p.sub, businessId: p.businessId, email: p.email } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }
  }
}
