import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly algorithm = 'aes-256-gcm';
  private key: Buffer;
  private readonly logger = new Logger(EncryptionService.name);

  onModuleInit() {
    const rawKey = process.env.ENCRYPTION_KEY;
    
    if (!rawKey) {
      this.logger.error('CRITICAL: ENCRYPTION_KEY is not defined in environment variables.');
      throw new Error('Missing ENCRYPTION_KEY. Application cannot start securely.');
    }

    try {
      // We expect a 64-character hex string (32 bytes)
      if (rawKey.length === 64) {
        this.key = Buffer.from(rawKey, 'hex');
      } else {
        // Fallback: Derive key if not hex-encoded, but log a warning
        this.logger.warn('ENCRYPTION_KEY is not a 64-char hex string. Deriving key via scrypt (Less ideal).');
        this.key = crypto.scryptSync(rawKey, 'janmasethu-salt', 32);
      }

      if (this.key.length !== 32) {
        throw new Error(`Invalid encryption key length: ${this.key.length} bytes (expected 32)`);
      }
    } catch (err) {
      this.logger.error('Failed to initialize encryption key', err);
      throw err;
    }
  }

  encrypt(text: string): string {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      // Format: iv:authTag:encryptedData
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (e) {
      this.logger.error(`Encryption failed`, e);
      throw new Error('Data encryption failed');
    }
  }

  decrypt(text: string): string {
    if (!text || !text.includes(':')) return text;
    try {
      const parts = text.split(':');
      if (parts.length !== 3) return text; // Assume it's unencrypted or legacy

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      this.logger.error(`Decryption failed. Data might be corrupted or key was changed.`, e);
      // Return original text if decryption fails to avoid breaking the UI for legacy/unencrypted data
      return text; 
    }
  }
}
