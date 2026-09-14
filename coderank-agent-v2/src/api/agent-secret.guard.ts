import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { config } from '../config';

@Injectable()
export class AgentSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const secret = req.headers['x-agent-secret'];
    if (!config.AGENT_SECRET_TOKEN || secret !== config.AGENT_SECRET_TOKEN) {
      throw new ForbiddenException({
        success: false,
        error: 'Unauthorized: invalid agent secret',
      });
    }
    return true;
  }
}
