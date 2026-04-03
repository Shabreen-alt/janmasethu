import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import * as crypto from 'crypto';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const testKey = 'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2';

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = testKey;
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should encrypt a string into iv:authTag:encrypted format', () => {
      const plaintext = 'Sensitive Patient Data';
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // IV should be 16 bytes (32 hex chars)
      expect(parts[0]).toHaveLength(32);
      // AuthTag should be 16 bytes (32 hex chars)
      expect(parts[1]).toHaveLength(32);
    });

    it('should produce different ciphertexts for the same plaintext (non-deterministic)', () => {
      const plaintext = 'Secret';
      const enc1 = service.encrypt(plaintext);
      const enc2 = service.encrypt(plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('should return the input if it is empty', () => {
      expect(service.encrypt('')).toBe('');
      //@ts-ignore
      expect(service.encrypt(null)).toBe(null);
    });
  });

  describe('decrypt', () => {
    it('should correctly decrypt a valid encrypted string', () => {
      const plaintext = 'Hello Janmasethu';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw or return original if data is corrupted', () => {
      // Mock logger to avoid the RED error text in console
      const loggerSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => {});
      
      const encrypted = service.encrypt('Original');
      const parts = encrypted.split(':');
      // Corrupt the encrypted data part
      parts[2] = '00'.repeat(parts[2].length / 2);
      const corrupted = parts.join(':');
      
      // The current implementation returns original text on failure for legacy support
      const result = service.decrypt(corrupted);
      expect(result).toBe(corrupted);

      loggerSpy.mockRestore();
    });

    it('should return input if not in expected format', () => {
      const plain = 'unencrypted-data';
      expect(service.decrypt(plain)).toBe(plain);
    });
  });

  describe('Key Initialization', () => {
    it('should throw if ENCRYPTION_KEY is missing', () => {
      // Mock logger to avoid the RED error text in console
      const loggerSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => {});
      
      delete process.env.ENCRYPTION_KEY;
      const uninitializedService = new EncryptionService();
      expect(() => uninitializedService.onModuleInit()).toThrow('Missing ENCRYPTION_KEY');

      loggerSpy.mockRestore();
    });

    it('should derive key via scrypt if not 64-char hex', () => {
      // Mock logger to avoid the YELLOW warning text in console
      const loggerSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation(() => {});
      
      process.env.ENCRYPTION_KEY = 'short-key';
      const scryptService = new EncryptionService();
      scryptService.onModuleInit();
      const enc = scryptService.encrypt('test');
      expect(scryptService.decrypt(enc)).toBe('test');

      loggerSpy.mockRestore();
    });
  });
});
