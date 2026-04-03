import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { JanmasethuRepository, Lead, Patient, Appointment, Thread, Message } from './janmasethu.repository';
import { EncryptionService } from '../security/encryption.service';
import { AuditService } from '../audit/audit.service';

// Mock data
const mockLead: Lead = { id: 'uuid-lead-1', name: 'John Doe', phone: '1234567890', status: 'Pending' };
const mockPatient: Patient = { id: 'uuid-patient-1', name: 'Jane Doe', email: 'jane@example.com', medicalHistory: 'Hypertension' };
const mockAppointment: Appointment = { id: 'uuid-appt-1', patientId: 'uuid-patient-1', date: new Date().toISOString(), reason: 'Checkup' };
const testUserId = 'doc-123';

describe('JanmasethuRepository', () => {
  let repository: JanmasethuRepository;
  let supabaseMock: any;
  let encryptionMock: any;
  let auditMock: any;

  beforeEach(async () => {
    const mockSingle = jest.fn().mockResolvedValue({ data: {}, error: null });

    supabaseMock = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: mockSingle,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    };

    encryptionMock = {
      encrypt: jest.fn(text => `encrypted:${text}`),
      decrypt: jest.fn(text => typeof text === 'string' ? text.replace('encrypted:', '') : text),
    };

    auditMock = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JanmasethuRepository,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabaseMock,
        },
        {
          provide: EncryptionService,
          useValue: encryptionMock,
        },
        {
          provide: AuditService,
          useValue: auditMock,
        }
      ],
    }).compile();

    repository = module.get<JanmasethuRepository>(JanmasethuRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('Leads', () => {
    it('should create a lead with encrypted fields and audit log', async () => {
      supabaseMock.from().insert().select().single.mockResolvedValueOnce({ data: { ...mockLead, id: 'L1' }, error: null });

      const result = await repository.createLead(mockLead, testUserId);

      expect(encryptionMock.encrypt).toHaveBeenCalledWith(mockLead.name);
      expect(auditMock.log).toHaveBeenCalledWith(testUserId, 'CREATE', 'LEAD', 'L1', expect.any(String));
      expect(result.id).toBe('L1');
    });

    it('should audit lead read access', async () => {
      supabaseMock.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({ data: [mockLead], error: null })
      });

      await repository.getLeads(testUserId);
      expect(auditMock.log).toHaveBeenCalledWith(testUserId, 'READ', 'LEAD', undefined, expect.any(String));
    });
  });

  describe('Patients', () => {
    it('should encrypt medical history on creation', async () => {
      supabaseMock.from().insert().select().single.mockResolvedValueOnce({ data: { ...mockPatient, id: 'P1' }, error: null });
      
      await repository.createPatient(mockPatient, testUserId);
      
      expect(encryptionMock.encrypt).toHaveBeenCalledWith(mockPatient.medicalHistory);
      expect(auditMock.log).toHaveBeenCalledWith(testUserId, 'CREATE', 'PATIENT', 'P1', expect.any(String));
    });

    it('should decrypt patient fields on retrieval', async () => {
      const encryptedData = { ...mockPatient, medical_history: 'encrypted:Hypertension' };
      supabaseMock.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({ data: [encryptedData], error: null })
      });

      const result = await repository.getPatients(testUserId);
      expect(result[0].medicalHistory).toBe('Hypertension');
      expect(encryptionMock.decrypt).toHaveBeenCalled();
    });
  });

  describe('Appointments', () => {
    it('should encrypt appointment reason', async () => {
      supabaseMock.from().insert().select().single.mockResolvedValueOnce({ data: { ...mockAppointment, id: 'A1' }, error: null });
      
      await repository.createAppointment(mockAppointment, testUserId);
      
      expect(encryptionMock.encrypt).toHaveBeenCalledWith(mockAppointment.reason);
      expect(auditMock.log).toHaveBeenCalledWith(testUserId, 'CREATE', 'APPOINTMENT', 'A1', expect.any(String));
    });
  });

  describe('Messages', () => {
    it('should encrypt message content', async () => {
      const mockMsg: Message = { threadId: 'T1', senderType: 'PATIENT', content: 'Help' };
      supabaseMock.from().insert().select().single.mockResolvedValueOnce({ data: { ...mockMsg, id: 'M1' }, error: null });

      await repository.createMessage(mockMsg, testUserId);
      
      expect(encryptionMock.encrypt).toHaveBeenCalledWith('Help');
      expect(auditMock.log).toHaveBeenCalledWith(testUserId, 'CREATE', 'MESSAGE', 'M1', expect.any(String));
    });
  });
});
