import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.headers['x-role']; // In standard production, this comes from a JWT token object. Simulated via HTTP Headers for simplicity in testing.

    if (!userRole) {
      throw new ForbiddenException('Missing user role.');
    }

    // Admins bypass everything
    if (userRole === 'ADMIN') {
      return true;
    }

    return requiredRoles.includes(userRole);
  }
}
