import { Resend } from 'resend';
import { ENV } from '../config/env';

const clean = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

export const sendPasswordResetEmail = async (toEmail: string, rawToken: string): Promise<void> => {
  const resendApiKey = clean(process.env.RESEND_API_KEY) || clean(ENV.RESEND_API_KEY);
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY не настроен в .env');
  }
  const resend = new Resend(resendApiKey);
  const frontendUrl = (clean(process.env.FRONTEND_URL) || clean(ENV.FRONTEND_URL) || 'https://igraem.kz').replace(/\/+$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
  const fromEmail = clean(process.env.EMAIL_FROM) || clean(ENV.EMAIL_FROM) || 'IGRAEM.KZ <noreply@igraem.kz>';

  console.log(`[Resend Email] Sending password reset link to: ${toEmail}...`);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject: 'Восстановление пароля | IGRAEM.KZ',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0; font-size: 24px; font-weight: 800;">IGRAEM.KZ</h2>
        </div>
        <p style="font-size: 15px; color: #1f2937;">Здравствуйте!</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Вы запросили восстановление пароля для доступа к платформе IGRAEM.KZ.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
            Установить новый пароль
          </a>
        </div>
        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.4;">
          Ссылка действительна в течение 15 минут.<br>Если вы не отправляли запрос, проигнорируйте это письмо.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Ошибка отправки через Resend:', error);
    throw new Error('Не удалось отправить письмо для сброса пароля: ' + (error.message || JSON.stringify(error)));
  }

  console.log('[Resend Email] Successfully sent password reset email. Email ID:', data?.id);
};

export const sendEmailVerificationCode = async (toEmail: string, code: string): Promise<void> => {
  const resendApiKey = clean(process.env.RESEND_API_KEY) || clean(ENV.RESEND_API_KEY);
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY не настроен в .env');
  }
  const resend = new Resend(resendApiKey);
  const fromEmail = clean(process.env.EMAIL_FROM) || clean(ENV.EMAIL_FROM) || 'IGRAEM.KZ <noreply@igraem.kz>';

  console.log(`[Resend Email] Sending email verification code to: ${toEmail}...`);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject: 'Код подтверждения для смены Email | IGRAEM.KZ',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0; font-size: 24px; font-weight: 800;">IGRAEM.KZ</h2>
        </div>
        <p style="font-size: 15px; color: #1f2937;">Здравствуйте!</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Вы запросили подтверждение/изменение адреса электронной почты для вашего аккаунта на платформе IGRAEM.KZ.</p>
        <div style="text-align: center; margin: 28px 0; background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px;">
          <p style="font-size: 12px; color: #166534; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Ваш код подтверждения</p>
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #059669; font-family: monospace;">${code}</div>
        </div>
        <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.4;">
          Код действует 10 минут.<br>Если вы не отправляли данный запрос, просто проигнорируйте это письмо.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Ошибка отправки через Resend:', error);
    throw new Error('Не удалось отправить код подтверждения: ' + (error.message || JSON.stringify(error)));
  }

  console.log('[Resend Email] Successfully sent email verification code. Email ID:', data?.id);
};

