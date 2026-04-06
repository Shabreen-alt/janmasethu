import { ConsentRepository } from './consent.repository';
import { SupabaseClient } from '@supabase/supabase-js';
import { EncryptionService } from '../../infrastructure/security/encryption.service';
import { ConsentPreferences } from './consent.schema';
import { Logger } from '@nestjs/common';

describe('ConsentRepository', () => {
  let repository: ConsentRepository;
  let mockSupabase: Partial<SupabaseClient>;
  let mockEncryption: Partial<EncryptionService>;

  const patientId = '550e8400-e29b-41d4-a716-446655440000';
  const mockPrefs: ConsentPreferences = {
    allowed_channels: { sms: true, whatsapp: true, email: false, call: false },
    allowed_message_types: ['alert'],
    quiet_hours: { start_time: '22:00', end_time: '07:00' }
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { preferences_encrypted: 'encrypted-json' }, error: null }),
      upsert: jest.fn().mockReturnThis(),
    } as any;

    mockEncryption = {
      encrypt: jest.fn().mockReturnValue('encrypted-json'),
      decrypt: jest.fn().mockReturnValue(JSON.stringify(mockPrefs)),
    };

    repository = new ConsentRepository(
      mockSupabase as SupabaseClient,
      mockEncryption as EncryptionService
    );
  });

  describe('getConsentByPatientId', () => {
    it('should return decrypted and parsed preferences', async () => {
      const result = await repository.getConsentByPatientId(patientId);

      expect(result).toEqual(mockPrefs);
      expect(mockEncryption.decrypt).toHaveBeenCalledWith('encrypted-json');
    });

    it('should return null if supabase returns no data', async () => {
      (mockSupabase as any).maybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await repository.getConsentByPatientId(patientId);

      expect(result).toBeNull();
    });

    it('should return null if decryption fails', async () => {
      (mockEncryption.decrypt as jest.Mock).mockImplementation(() => { throw new Error('Decryption Failed'); });

      const result = await repository.getConsentByPatientId(patientId);

      expect(result).toBeNull();
    });
  });

  describe('saveConsent', () => {
    it('should encrypt and upsert preferences', async () => {
      (mockSupabase as any).upsert.mockResolvedValue({ error: null });

      const result = await repository.saveConsent(patientId, mockPrefs);

      expect(result).toBe(true);
      expect(mockEncryption.encrypt).toHaveBeenCalledWith(JSON.stringify(mockPrefs));
      expect(mockSupabase.from).toHaveBeenCalledWith('patient_consents');
    });

    it('should return false on supabase error', async () => {
      (mockSupabase as any).upsert.mockResolvedValue({ error: { message: 'DB Error' } });

      const result = await repository.saveConsent(patientId, mockPrefs);

      expect(result).toBe(false);
    });
  });
});
