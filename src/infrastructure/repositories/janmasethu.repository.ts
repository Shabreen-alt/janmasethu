import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { EncryptionService } from '../security/encryption.service';
import { AuditService } from '../audit/audit.service';

export interface Lead {
  id?: string;
  name: string;
  phone: string;
  status: string;
}

export interface Patient {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  medicalHistory?: string;
}

export interface Appointment {
  id?: string;
  patientId: string;
  date: string;
  reason?: string;
}

export interface Thread {
  id?: string;
  patientId: string;
  assignedClinicianId?: string;
  queue: string;
  status: string;
  severity: string;
  ownershipType: string;
  clinicalNotes?: string;
  created_at?: string;
}

export interface MessageTemplate {
  id?: string;
  name: string;
  content: string;
  created_at?: string;
}

export interface Message {
  id?: string;
  threadId: string;
  senderType: 'AI' | 'PATIENT' | 'CLINICIAN';
  senderId?: string;
  content: string;
  created_at?: string;
}

export interface OwnershipAudit {
  id?: string;
  threadId: string;
  fromOwner: string;
  toOwner: string;
  reason?: string;
  severityScore?: number;
  created_at?: string;
}

@Injectable()
export class JanmasethuRepository {
  private readonly logger = new Logger(JanmasethuRepository.name);

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService
  ) {}

  // ==========================================
  // LEADS
  // ==========================================
  async createLead(lead: Lead, userId: string = 'system'): Promise<Lead | null> {
    const payload = {
      ...lead,
      name: this.encryption.encrypt(lead.name),
      phone: lead.phone ? this.encryption.encrypt(lead.phone) : lead.phone,
    };

    const { data, error } = await this.supabase
      .from('leads')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating lead: ${error.message}`);
      throw new Error(`Could not create lead: ${error.message}`);
    }

    if (data) {
      this.audit.log(userId, 'CREATE', 'LEAD', data.id, 'Encrypted lead created');
      data.name = this.encryption.decrypt(data.name);
      data.phone = data.phone ? this.encryption.decrypt(data.phone) : data.phone;
    }
    return data;
  }

  async getLeads(userId: string = 'system'): Promise<Lead[]> {
    const { data, error } = await this.supabase.from('leads').select('*');
    if (error) {
      this.logger.error(`Error fetching leads: ${error.message}`);
      throw new Error(`Could not fetch leads: ${error.message}`);
    }

    this.audit.log(userId, 'READ', 'LEAD', undefined, 'Bulk lead access');

    return (data || []).map(lead => ({
      ...lead,
      name: this.encryption.decrypt(lead.name),
      phone: lead.phone ? this.encryption.decrypt(lead.phone) : lead.phone,
    }));
  }

  // ==========================================
  // PATIENTS
  // ==========================================
  async createPatient(patient: Patient, userId: string = 'system'): Promise<Patient | null> {
    const payload = {
      name: this.encryption.encrypt(patient.name),
      phone: patient.phone ? this.encryption.encrypt(patient.phone) : patient.phone,
      email: patient.email ? this.encryption.encrypt(patient.email) : patient.email,
      medical_history: patient.medicalHistory ? this.encryption.encrypt(patient.medicalHistory) : null,
    };

    const { data, error } = await this.supabase
      .from('patients')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating patient: ${error.message}`);
      throw new Error(`Could not create patient: ${error.message}`);
    }

    if (data) {
      this.audit.log(userId, 'CREATE', 'PATIENT', data.id, 'Sensitive patient record created');
    }

    return data ? this.mapPatient(data) : null;
  }

  async getPatients(userId: string = 'system'): Promise<Patient[]> {
    const { data, error } = await this.supabase.from('patients').select('*');
    if (error) {
      this.logger.error(`Error fetching patients: ${error.message}`);
      throw new Error(`Could not fetch patients: ${error.message}`);
    }

    this.audit.log(userId, 'READ', 'PATIENT', undefined, 'Authorized bulk patient access');

    return (data || []).map(p => this.mapPatient(p));
  }

  private mapPatient(data: any): Patient {
    return {
      id: data.id,
      name: this.encryption.decrypt(data.name),
      phone: data.phone ? this.encryption.decrypt(data.phone) : data.phone,
      email: data.email ? this.encryption.decrypt(data.email) : data.email,
      medicalHistory: data.medical_history ? this.encryption.decrypt(data.medical_history) : data.medical_history,
    };
  }

  // ==========================================
  // APPOINTMENTS
  // ==========================================
  async createAppointment(appointment: Appointment, userId: string = 'system'): Promise<Appointment | null> {
    const payload = {
      ...appointment,
      reason: appointment.reason ? this.encryption.encrypt(appointment.reason) : appointment.reason,
    };

    const { data, error } = await this.supabase
      .from('appointments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating appointment: ${error.message}`);
      throw new Error(`Could not create appointment: ${error.message}`);
    }

    if (data) {
      this.audit.log(userId, 'CREATE', 'APPOINTMENT', data.id, 'Appointment created with encrypted reason');
    }

    return data ? this.mapAppointment(data) : null;
  }

  async getAppointments(userId: string = 'system'): Promise<Appointment[]> {
    const { data, error } = await this.supabase.from('appointments').select('*');
    if (error) {
      this.logger.error(`Error fetching appointments: ${error.message}`);
      throw new Error(`Could not fetch appointments: ${error.message}`);
    }

    this.audit.log(userId, 'READ', 'APPOINTMENT', undefined, 'Bulk appointment view');

    return (data || []).map(apt => this.mapAppointment(apt));
  }

  private mapAppointment(data: any): Appointment {
    return {
      ...data,
      reason: data.reason ? this.encryption.decrypt(data.reason) : data.reason,
    };
  }

  // ==========================================
  // THREADS
  // ==========================================
  async getThreads(userId: string = 'system'): Promise<Thread[]> {
    const { data, error } = await this.supabase.from('threads').select('*');
    if (error) {
      this.logger.error(`Error fetching threads: ${error.message}`);
      throw new Error(`Could not fetch threads: ${error.message}`);
    }

    this.audit.log(userId, 'READ', 'THREAD', undefined, 'Bulk thread access');
    return (data || []).map(thread => this.mapThread(thread));
  }

  async createThread(thread: Partial<Thread>, userId: string = 'system'): Promise<Thread | null> {
    const payload = {
      patient_id: thread.patientId,
      assigned_clinician_id: thread.assignedClinicianId,
      queue: thread.queue || 'GENERAL',
      status: thread.status || 'PENDING',
      severity: thread.severity || 'GREEN',
      ownership_type: thread.ownershipType || 'AI',
    };

    const { data, error } = await this.supabase
      .from('threads')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating thread: ${error.message}`);
      throw new Error(`Could not create thread: ${error.message}`);
    }

    if (data) {
      this.audit.log(userId, 'CREATE', 'THREAD', data.id, 'New clinical thread initialized');
    }

    return data ? this.mapThread(data) : null;
  }

  async getThreadById(id: string): Promise<Thread | null> {
    const { data, error } = await this.supabase.from('threads').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') {
       this.logger.error(`Error fetching thread: ${error.message}`);
       return null;
    }
    return data ? this.mapThread(data) : null;
  }

  async updateThread(id: string, updates: Partial<Thread>, userId: string = 'system'): Promise<Thread | null> {
    const payload: any = {};
    if (updates.patientId) payload.patient_id = updates.patientId;
    if (updates.assignedClinicianId) payload.assigned_clinician_id = updates.assignedClinicianId;
    if (updates.queue) payload.queue = updates.queue;
    if (updates.status) payload.status = updates.status;
    if (updates.severity) payload.severity = updates.severity;
    if (updates.ownershipType) payload.ownership_type = updates.ownershipType;
    if (updates.clinicalNotes) {
      payload.clinical_notes = this.encryption.encrypt(updates.clinicalNotes);
    }

    const { data, error } = await this.supabase.from('threads').update(payload).eq('id', id).select().single();
    if (error) {
      this.logger.error(`Error updating thread: ${error.message}`);
      throw new Error(`Could not update thread: ${error.message}`);
    }

    if (data) {
      this.audit.log(userId, 'UPDATE', 'THREAD', id, 'Thread clinical notes or status updated');
    }

    return data ? this.mapThread(data) : null;
  }

  private mapThread(data: any): Thread {
    return {
      id: data.id,
      patientId: data.patient_id,
      assignedClinicianId: data.assigned_clinician_id,
      queue: data.queue,
      status: data.status,
      severity: data.severity,
      ownershipType: data.ownership_type,
      clinicalNotes: data.clinical_notes ? this.encryption.decrypt(data.clinical_notes) : data.clinical_notes,
      created_at: data.created_at,
    };
  }

  // ==========================================
  // MESSAGE TEMPLATES
  // ==========================================
  async getTemplates(): Promise<MessageTemplate[]> {
    const { data, error } = await this.supabase.from('message_templates').select('*');
    if (error) {
      this.logger.error(`Error fetching templates: ${error.message}`);
      throw new Error(`Could not fetch templates: ${error.message}`);
    }
    return data || [];
  }

  // ==========================================
  // MESSAGES (ENCRYPTED)
  // ==========================================
  async createMessage(message: Message, userId: string = 'system'): Promise<Message | null> {
    const payload = {
      thread_id: message.threadId,
      sender_type: message.senderType,
      sender_id: message.senderId,
      content: this.encryption.encrypt(message.content),
    };

    const { data, error } = await this.supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating message: ${error.message}`);
      throw new Error(`Could not create message: ${error.message}`);
    }

    if (data) {
      this.audit.log(userId, 'CREATE', 'MESSAGE', data.id, `Encrypted message sent by ${message.senderType}`);
    }

    return data ? this.mapMessage(data) : null;
  }

  async getMessagesByThread(threadId: string, userId: string = 'system'): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Error fetching messages: ${error.message}`);
      throw new Error(`Could not fetch messages: ${error.message}`);
    }

    this.audit.log(userId, 'READ', 'MESSAGE', threadId, 'Conversation history accessed');

    return (data || []).map(msg => this.mapMessage(msg));
  }

  private mapMessage(data: any): Message {
    return {
      id: data.id,
      threadId: data.thread_id,
      senderType: data.sender_type,
      senderId: data.sender_id,
      content: this.encryption.decrypt(data.content),
      created_at: data.created_at,
    };
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  async createAuditLog(audit: OwnershipAudit): Promise<OwnershipAudit | null> {
    const payload = {
      thread_id: audit.threadId,
      from_owner: audit.fromOwner,
      to_owner: audit.toOwner,
      reason: audit.reason,
      severity_score: audit.severityScore,
    };

    const { data, error } = await this.supabase
      .from('ownership_audits')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating audit log: ${error.message}`);
      throw new Error(`Could not create audit log: ${error.message}`);
    }
    
    return data ? {
      id: data.id,
      threadId: data.thread_id,
      fromOwner: data.from_owner,
      toOwner: data.to_owner,
      reason: data.reason,
      severityScore: data.severity_score,
      created_at: data.created_at,
    } : null;
  }
}
