import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';
export type ResourceType = 'PATIENT' | 'LEAD' | 'MESSAGE' | 'THREAD' | 'APPOINTMENT' | 'AUDIT';

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: string;
}

/**
 * AuditService — writes every sensitive data access and mutation to the
 * `data_access_audit` table for HIPAA-style compliance traceability.
 *
 * All writes are fire-and-forget (non-blocking) so they never slow down
 * the primary request path. Failures are logged but not propagated.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient
  ) {}

  /**
   * Log a data access or mutation event.
   * Non-blocking — does NOT throw on failure.
   */
  log(
    userId: string,
    action: AuditAction,
    resourceType: ResourceType,
    resourceId?: string,
    details?: string,
  ): void {
    // Fire-and-forget — intentionally not awaited
    this.writeAuditEntry({ userId, action, resourceType, resourceId, details })
      .catch(err =>
        this.logger.error(`[AUDIT] Failed to write audit log: ${err?.message}`, err),
      );
  }

  private async writeAuditEntry(entry: AuditEntry): Promise<void> {
    const { error } = await this.supabase.from('data_access_audit').insert({
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      details: entry.details ?? null,
    });

    if (error) {
      this.logger.error(
        `[AUDIT] Supabase write failed for ${entry.action} on ${entry.resourceType}: ${error.message}`,
      );
    }
  }

  /**
   * Query audit history for a specific resource (for compliance dashboards).
   */
  async getAuditHistory(resourceType: ResourceType, resourceId?: string) {
    let query = this.supabase
      .from('data_access_audit')
      .select('*')
      .eq('resource_type', resourceType)
      .order('created_at', { ascending: false })
      .limit(100);

    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`[AUDIT] Failed to fetch audit history: ${error.message}`);
      return [];
    }
    return data || [];
  }
}
