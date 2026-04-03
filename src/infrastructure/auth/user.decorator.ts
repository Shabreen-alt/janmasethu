import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserMetadata {
  id: string;
  role: string;
}

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserMetadata => {
    const request = ctx.switchToHttp().getRequest();
    return {
      id: request.headers['x-user-id'] || 'system',
      role: request.headers['x-role'] || 'GUEST',
    };
  },
);
