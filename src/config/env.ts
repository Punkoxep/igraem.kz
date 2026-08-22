import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const rawPassword = process.env.TTLOCK_PASSWORD || 'Punkoxep169254131!';
const passwordMd5 = process.env.TTLOCK_PASSWORD_MD5 || crypto.createHash('md5').update(rawPassword).digest('hex').toLowerCase();

export const ENV = {
  PORT: process.env.PORT || '3000',
  TZ: process.env.TZ || 'Asia/Almaty',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/sharing_ploshadka_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-sharing-ploshadka-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  TTLOCK_MOCK: process.env.TTLOCK_MOCK === 'false' ? false : (process.env.TTLOCK_MOCK === 'true' ? true : false),
  TTLOCK_LOCK_ID: process.env.TTLOCK_LOCK_ID || '34275770',
  TTLOCK_MAC_ADDRESS: process.env.TTLOCK_MAC_ADDRESS || 'BA:38:37:0F:0D:0A',
  TTLOCK_CLIENT_ID: process.env.TTLOCK_CLIENT_ID || '4ff25d12b645422e96321c854c9f56a2',
  TTLOCK_CLIENT_SECRET: process.env.TTLOCK_CLIENT_SECRET || 'c84465e4a4b15d8cc39fb83eb5a51f88',
  TTLOCK_USERNAME: process.env.TTLOCK_USERNAME || 'punkoxep@gmail.com',
  TTLOCK_PASSWORD: rawPassword,
  TTLOCK_PASSWORD_MD5: passwordMd5,
  TTLOCK_API_URL: process.env.TTLOCK_API_URL || 'https://api.ttlock.com',
  CRON_GATEWAY_MONITOR: process.env.CRON_GATEWAY_MONITOR || '*/3 * * * *',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || 'BM44jWa8q4ZhEmYSdrDZ5mT6hZmHt0-PBToMJIQBJidXsJy02Kgnp3R4_enmRhO7FPqjAeQ5zhoGvnVGHh8mZqY',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || 'iNbLTLS_2slh6-fgOynfKU_p8iSdtXOgSGfPIo7cugE',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:support@igraem.kz',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'IGRAEM.KZ <noreply@igraem.kz>',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://igraem.kz',
};
