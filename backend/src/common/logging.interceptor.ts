import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`),
        error: (e) => this.logger.warn(`${req.method} ${req.originalUrl} ${e?.status ?? 500} ${Date.now() - started}ms`),
      }),
    );
  }
}
