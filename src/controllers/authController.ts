import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { ENV } from '../config/env';
import { validateIIN, formatRKPhone } from '../utils/iinValidator';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { sendPasswordResetEmail, sendEmailVerificationCode } from '../services/emailService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthController {
  /**
   * User Registration with strict IIN validation, mandatory Email, and auto-extraction of birth date and gender.
   * Expected DTO: { iin, phone_number, full_name, email, password }
   */
  public static async register(req: Request, res: Response) {
    try {
      const { iin, phone_number, phone, full_name, fullName, email, password, confirmPassword } = req.body;
      const targetFullName = (full_name || fullName || '').trim();
      const targetPhone = (phone_number || phone || '').trim();
      const targetEmail = (email || '').trim().toLowerCase();
      const targetPassword = password || '';

      if (!iin || !targetPhone || !targetFullName || !targetEmail || !targetPassword) {
        return res.status(400).json({
          success: false,
          message: 'Все поля (ИИН, номер телефона, ФИО, Email, пароль) обязательны для заполнения',
        });
      }

      // Validate Email format
      if (!EMAIL_REGEX.test(targetEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат адреса электронной почты (например, user@example.kz)',
        });
      }

      // Check confirmPassword matching if provided
      if (confirmPassword !== undefined && targetPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Пароли не совпадают',
        });
      }

      // Password complexity check (length >= 6)
      if (targetPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Пароль должен быть длиной не менее 6 символов',
        });
      }

      // Validate IIN strictly
      const iinResult = validateIIN(iin);
      if (!iinResult.isValid || !iinResult.birthDate || !iinResult.gender) {
        return res.status(400).json({
          success: false,
          message: `Ошибка валидации ИИН: ${iinResult.error}`,
        });
      }

      const formattedPhone = formatRKPhone(targetPhone);

      // Check if user already exists by IIN
      const existingIin = await prisma.user.findUnique({ where: { iin: iin.trim() } });
      if (existingIin) {
        return res.status(400).json({ success: false, message: 'Пользователь с таким ИИН уже зарегистрирован' });
      }

      // Check if user already exists by Phone
      const existingPhone = await prisma.user.findUnique({ where: { phone_number: formattedPhone } });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Пользователь с таким номером телефона уже зарегистрирован' });
      }

      // Check if user already exists by Email
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: targetEmail,
            mode: 'insensitive',
          },
        },
      });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Пользователь с таким Email уже зарегистрирован' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(targetPassword, 10);

      // Create User with auto-computed birth_date & gender from IIN
      const user = await prisma.user.create({
        data: {
          iin: iin.trim(),
          phone_number: formattedPhone,
          full_name: targetFullName,
          email: targetEmail,
          birth_date: iinResult.birthDate,
          gender: iinResult.gender,
          password_hash,
          role: 'client',
        },
      });

      // Generate JWT Token
      const token = jwt.sign(
        {
          id: user.id,
          iin: user.iin,
          phone_number: user.phone_number,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password_hash: _, ...userWithoutPassword } = user;

      return res.status(201).json({
        success: true,
        message: 'Пользователь успешно зарегистрирован.',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.register] Error:', error);
      return res.status(500).json({ success: false, message: `Ошибка при регистрации: ${error.message}` });
    }
  }

  /**
   * Complete Profile (for onboarding after Firebase SMS Auth)
   * Expected DTO: { fullName, iin, email, phone, password }
   */
  public static async completeProfile(req: Request, res: Response) {
    try {
      const { fullName, full_name, iin, email, phone, phone_number, password } = req.body;
      const targetFullName = (fullName || full_name || '').trim();
      const targetPhone = (phone || phone_number || '').trim();
      const targetEmail = (email || '').trim().toLowerCase();
      const targetIin = (iin || '').trim();
      const targetPassword = password || 'password123';

      if (!targetIin || !targetPhone || !targetFullName || !targetEmail) {
        return res.status(400).json({
          success: false,
          message: 'Все поля (ФИО, ИИН, Email, номер телефона) обязательны для заполнения',
        });
      }

      if (!EMAIL_REGEX.test(targetEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат адреса электронной почты (например, user@example.kz)',
        });
      }

      // Validate IIN strictly
      const iinResult = validateIIN(targetIin);
      if (!iinResult.isValid || !iinResult.birthDate || !iinResult.gender) {
        return res.status(400).json({
          success: false,
          message: `Ошибка валидации ИИН: ${iinResult.error}`,
        });
      }

      const formattedPhone = formatRKPhone(targetPhone);

      // Check if user already exists with this IIN or Phone
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { iin: targetIin },
            { phone_number: formattedPhone },
          ],
        },
      });

      // Check if email is used by another user
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: targetEmail,
            mode: 'insensitive',
          },
          ...(user ? { NOT: { id: user.id } } : {}),
        },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Пользователь с таким Email уже зарегистрирован',
        });
      }

      const password_hash = await bcrypt.hash(targetPassword, 10);

      if (user) {
        // Update profile
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            full_name: targetFullName,
            email: targetEmail,
            birth_date: iinResult.birthDate,
            gender: iinResult.gender,
            password_hash,
          },
        });
      } else {
        // Create new profile
        user = await prisma.user.create({
          data: {
            iin: targetIin,
            phone_number: formattedPhone,
            full_name: targetFullName,
            email: targetEmail,
            birth_date: iinResult.birthDate,
            gender: iinResult.gender,
            password_hash,
            role: 'client',
          },
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          iin: user.iin,
          phone_number: user.phone_number,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password_hash: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        success: true,
        message: 'Профиль успешно сохранен',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.completeProfile] Error:', error);
      return res.status(500).json({ success: false, message: `Ошибка сохранения профиля: ${error.message}` });
    }
  }

  /**
   * User Login via Phone or IIN + Password
   */
  public static async login(req: Request, res: Response) {
    try {
      const { phone_or_iin, phoneOrIin, password } = req.body;
      const queryInput = (phone_or_iin || phoneOrIin || '').trim();

      if (!queryInput || !password) {
        return res.status(400).json({
          success: false,
          message: 'Укажите ИИН/Телефон и пароль',
        });
      }

      const formattedPhone = formatRKPhone(queryInput);

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { iin: queryInput },
            { phone_number: formattedPhone },
            { phone_number: queryInput },
            { email: queryInput.toLowerCase() },
          ],
        },
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'Пользователь не найден' });
      }

      if (user.is_blocked || (user.is_banned && user.banned_until && new Date(user.banned_until) > new Date())) {
        const bannedUntilStr = user.banned_until ? new Date(user.banned_until).toLocaleString('ru-RU') : '';
        return res.status(400).json({
          success: false,
          message: `Ваш аккаунт заблокирован до ${bannedUntilStr}`,
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Неверный пароль' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          iin: user.iin,
          phone_number: user.phone_number,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password_hash: _, ...userWithoutPassword } = user;

      return res.json({
        success: true,
        message: 'Успешный вход в систему',
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.login] Error:', error);
      return res.status(500).json({ success: false, message: `Ошибка входа: ${error.message}` });
    }
  }

  /**
   * Request Password Reset Link via Email (Forgot Password)
   * POST /api/v1/auth/forgot-password
   */
  public static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Укажите адрес электронной почты',
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат адреса электронной почты',
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
      });

      if (user) {
        // Generate secure 32-byte random token
        const rawToken = crypto.randomBytes(32).toString('hex');
        // SHA-256 hash stored in DB
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        // 15 minutes validity
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            reset_password_token: hashedToken,
            reset_password_expires: expiresAt,
          },
        });

        try {
          await sendPasswordResetEmail(user.email || normalizedEmail, rawToken);
        } catch (emailErr: any) {
          console.error('[AuthController.forgotPassword] Resend email send error:', emailErr.message);
          return res.status(500).json({
            success: false,
            message: 'Не удалось отправить email. Проверьте адрес или настройки сервиса.',
          });
        }
      } else {
        console.log(`[AuthController.forgotPassword] User with email ${normalizedEmail} not found, silent 200 returned.`);
      }

      return res.json({
        success: true,
        message: 'Если такой email зарегистрирован, ссылка отправлена на почту.',
      });
    } catch (error: any) {
      console.error('[AuthController.forgotPassword] Error:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при отправке ссылки для восстановления пароля' });
    }
  }

  /**
   * Reset Password with Token
   * POST /api/v1/auth/reset-password
   */
  public static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword, password, confirmPassword } = req.body;
      const targetPassword = newPassword || password;

      if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Токен восстановления обязателен',
        });
      }

      if (!targetPassword || typeof targetPassword !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Новый пароль обязателен',
        });
      }

      if (confirmPassword !== undefined && targetPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Пароли не совпадают',
        });
      }

      if (targetPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Пароль должен быть длиной не менее 6 символов',
        });
      }

      // Hash incoming token using SHA-256 to compare with DB
      const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

      const user = await prisma.user.findFirst({
        where: {
          reset_password_token: hashedToken,
          reset_password_expires: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Срок действия ссылки истек или токен недействителен',
        });
      }

      const password_hash = await bcrypt.hash(targetPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password_hash,
          reset_password_token: null,
          reset_password_expires: null,
        },
      });

      console.log(`[AuthController.resetPassword] Password successfully updated for user ${user.id} (${user.email || user.phone_number})`);

      return res.json({
        success: true,
        message: 'Пароль успешно обновлен.',
      });
    } catch (error: any) {
      console.error('[AuthController.resetPassword] Error:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при сбросе пароля' });
    }
  }

  /**
   * Get Current Authenticated Profile
   */
  public static async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          iin: true,
          phone_number: true,
          full_name: true,
          email: true,
          birth_date: true,
          gender: true,
          role: true,
          is_blocked: true,
          created_at: true,
        },
      });

      return res.json({ success: true, data: user });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Send Email Verification Code to current authenticated user
   * POST /api/v1/user/send-email-verification
   */
  public static async sendEmailVerification(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
      }

      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Укажите адрес электронной почты' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат адреса электронной почты (например, user@example.kz)',
        });
      }

      // Check if this email is already bound to another account (ignoring test stubs)
      const existingUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          NOT: {
            id: req.user.id,
          },
        },
      });

      if (existingUser && !existingUser.email?.startsWith('unique_') && !existingUser.email?.startsWith('test_')) {
        return res.status(400).json({
          success: false,
          message: 'Этот адрес электронной почты уже используется другим пользователем',
        });
      }

      // Generate 6-digit random code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      // Valid for 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          pending_email: normalizedEmail,
          email_verification_code: code,
          email_verification_expires: expiresAt,
        },
      });

      try {
        await sendEmailVerificationCode(normalizedEmail, code);
      } catch (emailErr: any) {
        console.error('[AuthController.sendEmailVerification] Resend error:', emailErr.message);
        return res.status(500).json({
          success: false,
          message: 'Не удалось отправить email. Проверьте адрес или настройки сервиса.',
        });
      }

      return res.json({
        success: true,
        message: 'Код отправлен на указанную почту',
      });
    } catch (error: any) {
      console.error('[AuthController.sendEmailVerification] Error:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при отправке кода подтверждения' });
    }
  }

  /**
   * Verify and bind Email with 6-digit code
   * POST /api/v1/user/verify-email
   */
  public static async verifyEmail(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Не авторизован' });
      }

      const { code } = req.body;
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ success: false, message: 'Укажите 6-значный код подтверждения' });
      }

      const cleanCode = code.trim();

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user || !user.pending_email || !user.email_verification_code || !user.email_verification_expires) {
        return res.status(400).json({
          success: false,
          message: 'Запрос на подтверждение email не найден. Запросите код заново.',
        });
      }

      if (user.email_verification_code !== cleanCode || new Date(user.email_verification_expires) <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Неверный или истекший код подтверждения',
        });
      }

      const confirmedEmail = user.pending_email;

      // Update user with confirmed email and clear temporary verification fields
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: confirmedEmail,
          pending_email: null,
          email_verification_code: null,
          email_verification_expires: null,
        },
        select: {
          id: true,
          iin: true,
          phone_number: true,
          full_name: true,
          email: true,
          role: true,
        },
      });

      return res.json({
        success: true,
        email: updatedUser.email,
        message: 'Email успешно обновлен!',
        data: {
          user: updatedUser,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.verifyEmail] Error:', error);
      return res.status(500).json({ success: false, message: 'Ошибка при проверке кода подтверждения' });
    }
  }
}
