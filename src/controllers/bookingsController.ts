import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { getLocalNow } from '../utils/dateUtils';

export class BookingsController {
  /**
   * Helper to check if a user has any overlapping confirmed booking or approved team membership.
   */
  public static async checkUserHasOverlap(
    userId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const activeBookings = await prisma.booking.findMany({
      where: {
        booking_date: bookingDate,
        status: { in: ['confirmed', 'active', 'upcoming', 'CONFIRMED', 'ACTIVE', 'UPCOMING', 'pending', 'PENDING'] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        OR: [
          { host_user_id: userId },
          { guests: { some: { user_id: userId, status: 'approved' } } },
        ],
      },
    });

    const overlap = activeBookings.find(
      (b) => startTime < b.end_time && endTime > b.start_time
    );

    return !!overlap;
  }
  /**
   * Host creates a new booking slot for a sports ground
   */
  public static async createBooking(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      // Check if user is currently banned for No-Show
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (dbUser && dbUser.is_banned && dbUser.banned_until && new Date(dbUser.banned_until) > new Date()) {
        const bannedUntilStr = new Date(dbUser.banned_until).toLocaleString('ru-RU');
        return res.status(403).json({
          success: false,
          message: `Ваш аккаунт заблокирован за неявку (No-Show) до ${bannedUntilStr}`,
        });
      }

      const { ground_id, booking_date, start_time, end_time, total_price } = req.body;

      if (!ground_id || !booking_date || !start_time || !end_time) {
        return res.status(400).json({
          success: false,
          message: 'Укажите площадка, дату (YYYY-MM-DD), время начала и окончания (HH:mm)',
        });
      }

      // Normalize booking_date from DD.MM.YYYY to YYYY-MM-DD if needed
      let normalizedBookingDate = booking_date;
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(booking_date)) {
        const [d, m, y] = booking_date.split('.');
        normalizedBookingDate = `${y}-${m}-${d}`;
      }

      // Check if slot's end time is in the past
      const [endH, endM] = end_time.split(':').map(Number);
      const [bY, bM, bD] = normalizedBookingDate.split('-').map(Number);

      const bookingEndDateTime = new Date(bY, bM - 1, bD, endH || 0, endM || 0, 0, 0);
      const now = new Date();

      // Slot is considered past ONLY when current time >= end_time of the slot
      if (bookingEndDateTime.getTime() <= now.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Нельзя забронировать время, которое уже прошло',
        });
      }

      if (start_time >= end_time) {
        return res.status(400).json({
          success: false,
          message: 'Время окончания должно быть позже времени начала',
        });
      }

      // Verify ground exists (with resilient lookup)
      let ground = await prisma.ground.findUnique({ where: { id: ground_id } });
      if (!ground) {
        if (ground_id === 'school-11-football' || ground_id.includes('football')) {
          ground = await prisma.ground.findFirst({ where: { type: 'football' } });
        } else if (ground_id === 'school-11-basketball' || ground_id.includes('basketball')) {
          ground = await prisma.ground.findFirst({ where: { type: 'basketball' } });
        } else {
          ground = await prisma.ground.findFirst();
        }
      }
      if (!ground) {
        return res.status(404).json({ success: false, message: 'Площадка не найдена' });
      }
      const actualGroundId = ground.id;

      // Check School Hours reservation rule with day-of-week selection
      if (ground.is_school_court) {
        const schoolStart = ground.school_hours_start || '08:00';
        const schoolEnd = ground.school_hours_end || '15:00';
        const schoolDays = ground.school_days || 'MON_FRI';

        // Determine day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
        const bookingDateObj = new Date(`${normalizedBookingDate}T00:00:00`);
        const dayOfWeek = bookingDateObj.getDay();

        let isSchoolDay = false;
        if (schoolDays === 'NONE' || schoolDays === 'VACATION') {
          isSchoolDay = false; // School break / holidays — all days free!
        } else if (schoolDays === 'ALL') {
          isSchoolDay = true;
        } else if (schoolDays === 'MON_SAT') {
          isSchoolDay = dayOfWeek >= 1 && dayOfWeek <= 6; // Mon - Sat
        } else {
          // MON_FRI default (5-day week)
          isSchoolDay = dayOfWeek >= 1 && dayOfWeek <= 5; // Mon - Fri
        }

        if (isSchoolDay && (start_time < schoolEnd && end_time > schoolStart)) {
          return res.status(400).json({
            success: false,
            message: 'В это время (в учебный день) площадка зарезервирована под уроки физкультуры и школьные занятия',
          });
        }
      }

      // Calculate duration of the requested booking in minutes and hours
      const parseTimeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const newDurationMinutes = parseTimeToMinutes(end_time) - parseTimeToMinutes(start_time);
      const newDurationHours = newDurationMinutes / 60;

      if (newDurationMinutes <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Время окончания должно быть позже времени начала',
        });
      }

      if (newDurationHours > 3) {
        return res.status(400).json({
          success: false,
          message: 'В одной брони можно выбрать максимум 3 часа подряд',
        });
      }

      // Check daily limit of 3 hours per user on the same calendar date
      const existingUserDayBookings = await prisma.booking.findMany({
        where: {
          host_user_id: req.user.id,
          booking_date: normalizedBookingDate,
          status: { in: ['confirmed', 'active', 'upcoming', 'CONFIRMED', 'ACTIVE', 'UPCOMING', 'pending', 'PENDING'] },
        },
      });

      const totalExistingMinutes = existingUserDayBookings.reduce((sum, b) => {
        const dur = parseTimeToMinutes(b.end_time) - parseTimeToMinutes(b.start_time);
        return sum + (dur > 0 ? dur : 0);
      }, 0);

      const totalExistingHours = totalExistingMinutes / 60;

      if (totalExistingHours + newDurationHours > 3) {
        return res.status(400).json({
          success: false,
          message: `Превышен суточный лимит бронирований (максимум 3 часа в сутки на пользователя). У вас уже забронировано ${totalExistingHours} ч на ${normalizedBookingDate}. Доступно для бронирования: ${Math.max(0, 3 - totalExistingHours)} ч.`,
        });
      }

      // Check for overlapping bookings on the target ground
      const existingOverlap = await prisma.booking.findFirst({
        where: {
          ground_id: actualGroundId,
          booking_date: normalizedBookingDate,
          status: { in: ['confirmed', 'active', 'upcoming', 'CONFIRMED', 'ACTIVE', 'UPCOMING', 'pending', 'PENDING'] },
          OR: [
            {
              start_time: { lte: start_time },
              end_time: { gt: start_time },
            },
            {
              start_time: { lt: end_time },
              end_time: { gte: end_time },
            },
            {
              start_time: { gte: start_time },
              end_time: { lte: end_time },
            },
          ],
        },
      });

      if (existingOverlap) {
        return res.status(409).json({
          success: false,
          error: 'Этот временной слот уже забронирован другим пользователем',
          message: 'Этот временной слот уже забронирован другим пользователем',
        });
      }

      // Check for user's own overlapping bookings across any court/ground on the same date
      const userActiveBookings = await prisma.booking.findMany({
        where: {
          booking_date: normalizedBookingDate,
          status: 'confirmed',
          OR: [
            { host_user_id: req.user.id },
            { guests: { some: { user_id: req.user.id } } },
          ],
        },
        include: { ground: true },
      });

      const userOverlap = userActiveBookings.find((b) => {
        // Formula: (NewStartTime < ExistingEndTime) AND (NewEndTime > ExistingStartTime)
        return start_time < b.end_time && end_time > b.start_time;
      });

      if (userOverlap) {
        const groundName = userOverlap.ground ? userOverlap.ground.name : 'другое поле';
        const timeWindow = `${userOverlap.start_time}-${userOverlap.end_time}`;
        return res.status(400).json({
          success: false,
          message: `Вы не можете забронировать эту площадку, так как у вас уже есть активная бронь на другое поле в это же время (${groundName}, ${timeWindow}).`,
        });
      }

      const invite_token = uuidv4();

      const booking = await prisma.booking.create({
        data: {
          ground_id: actualGroundId,
          host_user_id: req.user.id,
          booking_date: normalizedBookingDate,
          start_time,
          end_time,
          total_price: total_price ? parseFloat(total_price) : ground.cost_per_hour,
          status: 'confirmed',
          payment_status: 'paid',
          invite_token,
        },
        include: {
          ground: true,
          host_user: {
            select: { id: true, full_name: true, phone_number: true, iin: true },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Бронирование успешно создано',
        data: booking,
      });
    } catch (error: any) {
      console.error('[BookingsController.createBooking]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get user's bookings (hosted & joined as guest)
   */
  public static async getMyBookings(req: AuthenticatedRequest, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const hostedBookings = await prisma.booking.findMany({
        where: {
          host_user_id: req.user.id,
          status: { notIn: ['cancelled', 'CANCELLED'] },
        },
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } },
          guests: {
            where: { status: 'approved' },
            include: {
              user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } },
            },
          },
        },
        orderBy: { booking_date: 'desc' },
      });

      const joinedGuestSlots = await prisma.bookingGuest.findMany({
        where: {
          user_id: req.user.id,
          status: 'approved', // Exclude 'left' or 'cancelled'
          booking: {
            status: { notIn: ['cancelled', 'CANCELLED'] },
          },
        },
        include: {
          booking: {
            include: {
              ground: true,
              host_user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } },
              guests: {
                where: { status: 'approved' },
                include: { user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } } },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const hostedFormatted = hostedBookings.map((b) => ({
        ...b,
        isParticipant: false,
        is_participant: false,
        isHost: true,
        is_host: true,
        participantsCount: 1 + b.guests.length,
      }));

      const joinedFormatted = joinedGuestSlots
        .filter((g) => g.booking && g.status === 'approved')
        .map((g) => ({
          ...g.booking,
          isParticipant: true,
          is_participant: true,
          isHost: false,
          is_host: false,
          guestId: g.id,
          participantsCount: 1 + g.booking.guests.length,
        }));

      return res.json({
        success: true,
        data: {
          hosted: hostedFormatted,
          joined: joinedFormatted,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/bookings/my-active
   * Get list of active ongoing/upcoming bookings for current user (excludes left games)
   */
  public static async getMyActiveBookings(req: AuthenticatedRequest, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const hostedBookings = await prisma.booking.findMany({
        where: {
          host_user_id: req.user.id,
          status: 'confirmed',
        },
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } },
          guests: {
            where: { status: 'approved' },
            include: {
              user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } },
            },
          },
        },
        orderBy: { booking_date: 'desc' },
      });

      const joinedGuestSlots = await prisma.bookingGuest.findMany({
        where: {
          user_id: req.user.id,
          status: 'approved', // Strictly exclude 'left'
          booking: {
            status: 'confirmed',
          },
        },
        include: {
          booking: {
            include: {
              ground: true,
              host_user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } },
              guests: {
                where: { status: 'approved' },
                include: { user: { select: { id: true, full_name: true, phone_number: true, avatar_url: true } } },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const hostedFormatted = hostedBookings.map((b) => ({
        ...b,
        isParticipant: false,
        is_participant: false,
        isHost: true,
        is_host: true,
        participantsCount: 1 + b.guests.length,
      }));

      const joinedFormatted = joinedGuestSlots
        .filter((g) => g.booking && g.status === 'approved')
        .map((g) => ({
          ...g.booking,
          isParticipant: true,
          is_participant: true,
          isHost: false,
          is_host: false,
          guestId: g.id,
          participantsCount: 1 + g.booking.guests.length,
        }));

      return res.json({
        success: true,
        data: [...hostedFormatted, ...joinedFormatted],
      });
    } catch (error: any) {
      console.error('[BookingsController.getMyActiveBookings]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Participant leaves a shared booking session (status: 'left')
   * POST /api/v1/bookings/:id/leave
   */
  public static async leaveBooking(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { guests: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      // If user is host, delegate to completeBooking
      if (booking.host_user_id === req.user.id || req.user.role === 'admin') {
        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'completed' },
        });

        // Mark all guest participants as completed
        await prisma.bookingGuest.updateMany({
          where: { booking_id: id },
          data: { status: 'completed' },
        });

        // Cancel any pending join requests
        await prisma.joinRequest.updateMany({
          where: {
            booking_id: id,
            status: { in: ['PENDING', 'pending'] },
          },
          data: { status: 'CANCELLED' },
        });

        return res.json({
          success: true,
          isHost: true,
          message: 'Бронирование успешно завершено организатором, слот освобожден',
          data: updated,
        });
      }

      // Guest / Participant leaving logic:
      const guest = await prisma.bookingGuest.findUnique({
        where: {
          booking_id_user_id: {
            booking_id: id,
            user_id: req.user.id,
          },
        },
      });

      if (guest) {
        await prisma.bookingGuest.update({
          where: { id: guest.id },
          data: { status: 'left' },
        });
      }

      // Revoke any JoinRequest for this user
      await prisma.joinRequest.updateMany({
        where: {
          booking_id: id,
          OR: [
            { user_iin: req.user.iin },
            { user_phone: req.user.phone_number },
          ],
        },
        data: { status: 'LEFT' },
      });

      return res.json({
        success: true,
        isParticipant: true,
        message: 'Вы успешно вышли из совместной игры',
      });
    } catch (error: any) {
      console.error('[BookingsController.leaveBooking]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Complete an active booking (Host completes session, Participant leaves session)
   * POST /api/v1/bookings/:id/complete
   * POST /api/v1/bookings/:id/finish
   */
  public static async completeBooking(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { guests: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      const isHost = booking.host_user_id === req.user.id || req.user.role === 'admin';

      if (isHost) {
        // Organizer: Complete the entire booking for everyone and free the slot
        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'completed' },
        });

        // Mark all guest participants as completed
        await prisma.bookingGuest.updateMany({
          where: { booking_id: id },
          data: { status: 'completed' },
        });

        // Cancel any pending join requests
        await prisma.joinRequest.updateMany({
          where: {
            booking_id: id,
            status: { in: ['PENDING', 'pending'] },
          },
          data: { status: 'CANCELLED' },
        });

        return res.json({
          success: true,
          isHost: true,
          message: 'Бронирование успешно завершено, слот освобожден',
          data: updated,
        });
      }

      // Participant: Mark status as 'left' without cancelling the main booking
      const guest = await prisma.bookingGuest.findUnique({
        where: {
          booking_id_user_id: {
            booking_id: id,
            user_id: req.user.id,
          },
        },
      });

      if (!guest && !booking.guests.some((g) => g.user_id === req.user?.id)) {
        return res.status(403).json({
          success: false,
          message: 'Вы не являетесь участником этой брони',
        });
      }

      if (guest) {
        await prisma.bookingGuest.update({
          where: { id: guest.id },
          data: { status: 'left' },
        });
      }

      await prisma.joinRequest.updateMany({
        where: {
          booking_id: id,
          OR: [
            { user_iin: req.user.iin },
            { user_phone: req.user.phone_number },
          ],
        },
        data: { status: 'LEFT' },
      });

      return res.json({
        success: true,
        isParticipant: true,
        message: 'Вы успешно вышли из совместной игры',
      });
    } catch (error: any) {
      console.error('[BookingsController.completeBooking]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Extend active booking by 1 hour (POST /api/v1/bookings/:id/extend)
   */
  public static async extendBooking(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { ground: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      // Check ownership (creator / host only)
      if (booking.host_user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Только организатор (создатель) бронирования может продлевать сеанс',
        });
      }

      if (booking.status === 'cancelled' || booking.status === 'CANCELLED' || booking.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Нельзя продлить отмененное или уже завершенное бронирование',
        });
      }

      const parseTimeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      const currentEndMinutes = parseTimeToMinutes(booking.end_time);
      const nextEndMinutes = currentEndMinutes + 60; // +1 hour

      // 3) Check Operating Hours (e.g. max 23:00)
      const maxOperatingMinutes = parseTimeToMinutes('23:00');
      if (nextEndMinutes > maxOperatingMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Площадка закрывается в 23:00',
        });
      }

      const formatMinutesToTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const nextStartTime = booking.end_time;
      const nextEndTime = formatMinutesToTime(nextEndMinutes);

      // 1) Check Daily Limit: total booked hours on this calendar date
      const userDayBookings = await prisma.booking.findMany({
        where: {
          host_user_id: req.user.id,
          booking_date: booking.booking_date,
          status: { in: ['confirmed', 'active', 'upcoming', 'ACTIVE', 'CONFIRMED'] },
        },
      });

      const totalExistingMinutes = userDayBookings.reduce((sum, b) => {
        const dur = parseTimeToMinutes(b.end_time) - parseTimeToMinutes(b.start_time);
        return sum + (dur > 0 ? dur : 0);
      }, 0);

      // +60 minutes for the proposed extension
      if (totalExistingMinutes + 60 > 180) { // > 3 hours
        return res.status(400).json({
          success: false,
          message: 'Превышен суточный лимит бронирования (максимум 3 часа в день)',
        });
      }

      // 2) Check next hour slot availability on this ground
      const overlappingBookings = await prisma.booking.findMany({
        where: {
          ground_id: booking.ground_id,
          booking_date: booking.booking_date,
          status: { in: ['confirmed', 'active', 'upcoming', 'ACTIVE', 'CONFIRMED'] },
          id: { not: booking.id },
        },
      });

      const isNextHourOccupied = overlappingBookings.some((b) => {
        return nextStartTime < b.end_time && nextEndTime > b.start_time;
      });

      if (isNextHourOccupied) {
        return res.status(409).json({
          success: false,
          message: 'Следующий час уже забронирован другим игроком',
        });
      }

      // Calculate extra price for 1 additional hour
      const additionalCost = booking.ground ? booking.ground.cost_per_hour : 0;
      const updatedTotalPrice = (booking.total_price || 0) + additionalCost;

      const updatedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          end_time: nextEndTime,
          total_price: updatedTotalPrice,
        },
        include: {
          ground: true,
          host_user: {
            select: { id: true, full_name: true, phone_number: true, iin: true },
          },
          guests: {
            include: { user: { select: { id: true, full_name: true, phone_number: true } } },
          },
        },
      });

      return res.json({
        success: true,
        message: 'Бронирование успешно продлено на 1 час',
        data: updatedBooking,
      });
    } catch (error: any) {
      console.error('[BookingsController.extendBooking]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Generate / get dynamic invitation link token for a booking
   */
  public static async getInviteLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const booking = await prisma.booking.findUnique({ where: { id } });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      if (booking.host_user_id !== req.user?.id) {
        return res.status(403).json({ success: false, message: 'Только хозяин бронирования может приглашать друзей' });
      }

      return res.json({
        success: true,
        data: {
          invite_token: booking.invite_token,
          invite_url: `/api/v1/invitations/${booking.invite_token}`,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get details of an invitation by token (Scenario 1 view)
   */
  public static async getInvitationByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { invite_token: token },
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true } },
          guests: {
            include: { user: { select: { id: true, full_name: true } } },
          },
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Приглашение не найдено или недействительно' });
      }

      const totalParticipants = 1 + booking.guests.length; // Host + Guests
      const availableSlots = Math.max(0, 15 - totalParticipants);

      return res.json({
        success: true,
        data: {
          booking: {
            id: booking.id,
            ground: booking.ground,
            host: booking.host_user,
            date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
          },
          totalParticipants,
          availableSlots,
          isFull: totalParticipants >= 15,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Accept Pre-invitation Link (Scenario 1: friend joins slot)
   * Max 15 capacity limit!
   */
  public static async acceptInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { token } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { invite_token: token },
        include: { guests: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Приглашение не найдено' });
      }

      // Host cannot join their own booking as a guest
      if (booking.host_user_id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Вы являетесь хозяином этой брони' });
      }

      // Check current participant count (Host = 1, Guests = booking.guests.length)
      const currentParticipantsCount = 1 + booking.guests.length;

      if (currentParticipantsCount >= 15) {
        return res.status(400).json({
          success: false,
          message: 'Все места на этот сеанс заполнены',
        });
      }

      // Check if user is already a guest
      const alreadyGuest = booking.guests.some((g) => g.user_id === req.user?.id);
      if (alreadyGuest) {
        return res.status(400).json({ success: false, message: 'Вы уже присоединились к этой игре' });
      }

      // Check if user has an overlapping active booking or team game
      const hasOverlap = await BookingsController.checkUserHasOverlap(
        req.user.id,
        booking.booking_date,
        booking.start_time,
        booking.end_time,
        booking.id
      );
      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'Вы не можете присоединиться: у вас уже есть активная бронь или игра в другой команде в это время',
        });
      }

      // Add to slot as invited guest
      const guest = await prisma.bookingGuest.create({
        data: {
          booking_id: booking.id,
          user_id: req.user.id,
          type: 'invited',
          status: 'approved', // Beta default
        },
        include: {
          user: { select: { id: true, full_name: true, phone_number: true } },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Вы успешно присоединились к игре по приглашению!',
        data: guest,
      });
    } catch (error: any) {
      console.error('[BookingsController.acceptInvitation]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Spontaneous Guest Check-in via Door Static QR (Scenario 2)
   * Scans static door QR code token during active session.
   * Max 15 capacity check!
   */
  public static async spontaneousQrCheckIn(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { qr_code_token } = req.body;

      if (!qr_code_token) {
        return res.status(400).json({ success: false, message: 'Укажите токен QR-кода площадки' });
      }

      const ground = await prisma.ground.findUnique({ where: { qr_code_token } });
      if (!ground) {
        return res.status(404).json({ success: false, message: 'Площадка не найдена' });
      }

      // Find active booking right now
      const { dateStr: currentDateStr, timeStr: currentTimeStr } = getLocalNow();

      const activeBookings = await prisma.booking.findMany({
        where: {
          ground_id: ground.id,
          booking_date: currentDateStr,
          status: 'confirmed',
        },
        include: { guests: true },
      });

      const currentActiveBooking = activeBookings.find(
        (b) => currentTimeStr >= b.start_time && currentTimeStr <= b.end_time
      );

      if (!currentActiveBooking) {
        return res.status(400).json({
          success: false,
          message: 'Слот свободен. Пожалуйста, забронируйте площадку через расписание',
        });
      }

      // Check capacity limit (Host = 1, Guests = currentActiveBooking.guests.length)
      const currentCount = 1 + currentActiveBooking.guests.length;

      if (currentCount >= 15) {
        return res.status(400).json({
          success: false,
          message: 'Все места на этот сеанс заполнены',
        });
      }

      // If user is host
      if (currentActiveBooking.host_user_id === req.user.id) {
        return res.json({
          success: true,
          message: 'Вы являетесь хозяином текущей брони',
          data: { role: 'host', booking_id: currentActiveBooking.id },
        });
      }

      // Check if user is already a guest
      const existingGuest = currentActiveBooking.guests.find((g) => g.user_id === req.user?.id && g.status === 'approved');
      if (existingGuest) {
        return res.json({
          success: true,
          message: 'Вы уже записаны в этот сеанс',
          data: existingGuest,
        });
      }

      // Check if user already submitted a join request
      const existingRequests = await prisma.joinRequest.findMany({
        where: {
          booking_id: currentActiveBooking.id,
          OR: [
            { user_iin: req.user.iin },
            { user_phone: req.user.phone_number },
          ],
        },
        orderBy: { created_at: 'desc' },
      });

      const activeReq = existingRequests.find((r) => r.status === 'PENDING' || r.status === 'APPROVED');
      if (activeReq) {
        return res.json({
          success: true,
          message: activeReq.status === 'APPROVED' ? 'Ваша заявка на присоединение уже одобрена' : 'Запрос на спонтанный вход отправлен хозяину слота. Ожидайте одобрения',
          data: activeReq,
        });
      }

      // Check if user has an overlapping active booking or team game
      const hasOverlap = await BookingsController.checkUserHasOverlap(
        req.user.id,
        currentActiveBooking.booking_date,
        currentActiveBooking.start_time,
        currentActiveBooking.end_time,
        currentActiveBooking.id
      );
      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'Вы не можете подать заявку: у вас уже есть активная бронь или игра в другой команде в это время',
        });
      }

      let joinRequest;
      if (existingRequests.length > 0) {
        const first = existingRequests[0];
        if (existingRequests.length > 1) {
          await prisma.joinRequest.deleteMany({
            where: { id: { in: existingRequests.slice(1).map((r) => r.id) } },
          });
        }
        joinRequest = await prisma.joinRequest.update({
          where: { id: first.id },
          data: {
            status: 'PENDING',
            user_name: req.user.full_name,
            user_phone: req.user.phone_number,
            created_at: new Date(),
          },
        });
      } else {
        joinRequest = await prisma.joinRequest.create({
          data: {
            booking_id: currentActiveBooking.id,
            user_iin: req.user.iin,
            user_name: req.user.full_name,
            user_phone: req.user.phone_number,
            status: 'PENDING',
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Запрос на спонтанный вход отправлен хозяину слота. Ожидайте одобрения',
        data: joinRequest,
      });
    } catch (error: any) {
      console.error('[BookingsController.spontaneousQrCheckIn]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all active/confirmed bookings (with filtering by groundId and date, indicating is_my_booking)
   */
  public static async getAllBookings(req: Request, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const { groundId, ground_id, date, booking_date } = req.query;
      const targetGroundId = (groundId || ground_id) as string;
      const rawDate = (date || booking_date) as string;

      let normalizedDate: string | undefined;
      if (rawDate) {
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
          const [d, m, y] = rawDate.split('.');
          normalizedDate = `${y}-${m}-${d}`;
        } else {
          normalizedDate = rawDate;
        }
      }

      // Check current user if token provided in Authorization header
      const authHeader = req.headers.authorization;
      let currentUserId: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwtSecret = ENV.JWT_SECRET || 'super-secret-jwt-key-sharing-ploshadka-2026';
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, jwtSecret) as any;
          currentUserId = decoded?.id || null;
        } catch (e) {}
      }

      const whereClause: any = {
        status: { in: ['confirmed', 'active', 'upcoming', 'CONFIRMED', 'ACTIVE', 'UPCOMING', 'pending', 'PENDING'] },
      };

      if (targetGroundId) {
        // Also support lookup by ground slug or UUID
        let ground = await prisma.ground.findUnique({ where: { id: targetGroundId } });
        if (!ground) {
          if (targetGroundId.includes('football')) {
            ground = await prisma.ground.findFirst({ where: { type: 'football' } });
          } else if (targetGroundId.includes('basketball')) {
            ground = await prisma.ground.findFirst({ where: { type: 'basketball' } });
          }
        }
        whereClause.ground_id = ground ? ground.id : targetGroundId;
      }

      if (normalizedDate) {
        whereClause.booking_date = normalizedDate;
      }

      const bookings = await prisma.booking.findMany({
        where: whereClause,
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true, iin: true } },
          guests: {
            include: { user: { select: { id: true, full_name: true, phone_number: true, iin: true } } },
          },
          joinRequests: true,
        },
        orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }],
      });

      const formatted = bookings.map((b) => ({
        id: b.id,
        ground_id: b.ground_id,
        booking_date: b.booking_date,
        start_time: b.start_time,
        end_time: b.end_time,
        time_slot: `${b.start_time} – ${b.end_time}`,
        status: b.status,
        host_user_id: b.host_user_id,
        host_name: b.host_user?.full_name || 'Хозяин брони',
        is_my_booking: Boolean(currentUserId && (b.host_user_id === currentUserId || b.guests.some((g) => g.user_id === currentUserId))),
        guests_count: b.guests.length,
        is_looking_for_players: b.is_looking_for_players,
      }));

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/bookings/occupied
   * GET /api/v1/grounds/:id/slots
   * Returns all active/confirmed bookings on a ground and date with isOccupied and isMyBooking flags
   */
  public static async getOccupiedSlots(req: Request, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const groundId = (req.params.id || req.query.groundId || req.query.ground_id) as string;
      const rawDate = (req.query.date || req.query.booking_date) as string;

      let normalizedDate: string | undefined;
      let rawDateFormatted: string | undefined;
      if (rawDate) {
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
          const [d, m, y] = rawDate.split('.');
          normalizedDate = `${y}-${m}-${d}`;
          rawDateFormatted = rawDate;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          const [y, m, d] = rawDate.split('-');
          normalizedDate = rawDate;
          rawDateFormatted = `${d}.${m}.${y}`;
        } else {
          normalizedDate = rawDate;
        }
      }

      // Check current user if token provided in Authorization header
      const authHeader = req.headers.authorization;
      let currentUserId: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwtSecret = ENV.JWT_SECRET || 'super-secret-jwt-key-sharing-ploshadka-2026';
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, jwtSecret) as any;
          currentUserId = decoded?.id || null;
        } catch (e) {}
      }

      const whereClause: any = {
        status: { in: ['confirmed', 'active', 'upcoming', 'CONFIRMED', 'ACTIVE', 'UPCOMING', 'pending', 'PENDING'] },
      };

      if (groundId) {
        let ground = await prisma.ground.findUnique({ where: { id: groundId } });
        if (!ground) {
          if (groundId.includes('football')) {
            ground = await prisma.ground.findFirst({ where: { type: 'football' } });
          } else if (groundId.includes('basketball')) {
            ground = await prisma.ground.findFirst({ where: { type: 'basketball' } });
          }
        }
        whereClause.ground_id = ground ? ground.id : groundId;
      }

      if (normalizedDate) {
        whereClause.booking_date = rawDateFormatted
          ? { in: [normalizedDate, rawDateFormatted] }
          : normalizedDate;
      }

      const bookings = await prisma.booking.findMany({
        where: whereClause,
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true } },
          guests: {
            include: { user: { select: { id: true, full_name: true } } },
          },
        },
        orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }],
      });

      const data = bookings.map((b) => {
        const isHost = Boolean(currentUserId && b.host_user_id === currentUserId);
        const isParticipant = Boolean(
          currentUserId && b.guests.some((g) => g.user_id === currentUserId && g.status === 'approved')
        );
        const isMyBooking = isHost || isParticipant;
        const approvedGuestsCount = b.guests.filter((g) => g.status === 'approved').length;
        const participantsCount = 1 + approvedGuestsCount;
        const isFull = participantsCount >= 15;

        return {
          id: b.id,
          bookingId: b.id,
          groundId: b.ground_id,
          ground_id: b.ground_id,
          bookingDate: b.booking_date,
          booking_date: b.booking_date,
          startTime: b.start_time,
          start_time: b.start_time,
          endTime: b.end_time,
          end_time: b.end_time,
          timeSlot: `${b.start_time} – ${b.end_time}`,
          time_slot: `${b.start_time} – ${b.end_time}`,
          status: b.status,
          isOccupied: true,
          is_occupied: true,
          isMyBooking: isMyBooking,
          is_my_booking: isMyBooking,
          isHost: isHost,
          is_host: isHost,
          isParticipant: isParticipant,
          is_participant: isParticipant,
          hostUserId: b.host_user_id,
          host_user_id: b.host_user_id,
          hostName: b.host_user?.full_name || 'Организатор',
          host_name: b.host_user?.full_name || 'Организатор',
          participantsCount,
          maxParticipants: 15,
          isFull,
        };
      });

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('[BookingsController.getOccupiedSlots]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Send a request to join an occupied slot (JoinRequest PENDING)
   */
  public static async requestJoinSlot(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const targetBookingId = req.params.id || req.body.booking_id || req.body.bookingId;
      const { user_name, user_phone, user_iin } = req.body;

      if (!targetBookingId) {
        return res.status(400).json({ success: false, message: 'Укажите ID бронирования (booking_id)' });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: targetBookingId },
        include: { guests: true, joinRequests: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      if (booking.host_user_id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Вы являетесь хозяином этого слота' });
      }

      const applicantIin = user_iin || req.user.iin;
      let applicantName = user_name || req.user?.full_name;
      const applicantPhone = user_phone || req.user?.phone_number;

      // Ensure valid name: if missing or containing '?', look up authentic User record by IIN/phone
      if (!applicantName || applicantName.includes('?')) {
        const foundUser = await prisma.user.findFirst({
          where: {
            OR: [
              { iin: applicantIin },
              { phone_number: applicantPhone },
            ],
          },
        });
        if (foundUser && foundUser.full_name) {
          applicantName = foundUser.full_name;
        }
      }

      if (!applicantName || applicantName.includes('?')) {
        applicantName = 'Участник';
      }

      // Check capacity limit (1 Host + up to 14 guests = 15 total)
      const currentParticipants = 1 + booking.guests.filter((g) => g.status === 'approved').length;
      if (currentParticipants >= 15) {
        return res.status(400).json({
          success: false,
          message: 'Все места заняты (15/15)',
        });
      }

      // Check if user is already an active guest
      const isAlreadyGuest = booking.guests.some((g) => g.user_id === req.user?.id && g.status === 'approved');
      if (isAlreadyGuest) {
        return res.status(400).json({ success: false, message: 'Вы уже являетесь участником этой игры' });
      }

      // Check existing join requests for this user on this booking
      const existingRequests = await prisma.joinRequest.findMany({
        where: {
          booking_id: booking.id,
          OR: [
            { user_iin: applicantIin },
            { user_phone: applicantPhone },
          ],
        },
        orderBy: { created_at: 'desc' },
      });

      const existingRequest = existingRequests[0];
      if (existingRequest) {
        const s = (existingRequest.status || '').toUpperCase();
        if (s === 'PENDING') {
          return res.status(400).json({
            success: false,
            message: 'Запрос уже отправлен на рассмотрение',
          });
        }
        if (s === 'APPROVED' && isAlreadyGuest) {
          return res.status(400).json({
            success: false,
            message: 'Вы уже являетесь участником этой игры',
          });
        }
      }

      // Check if user has an overlapping active booking or team game
      const hasOverlap = await BookingsController.checkUserHasOverlap(
        req.user.id,
        booking.booking_date,
        booking.start_time,
        booking.end_time,
        booking.id
      );
      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'Вы не можете подать заявку: у вас уже есть активная бронь или игра в другой команде в это время',
        });
      }

      // Auto-approval logic if Matchmaking is active & autoApprovePlayers === true
      const isAutoApprove = booking.is_looking_for_players && booking.auto_approve_players && booking.needed_players_count > 0;
      const initialStatus = isAutoApprove ? 'APPROVED' : 'PENDING';

      let joinRequest;
      if (existingRequest) {
        if (existingRequests.length > 1) {
          await prisma.joinRequest.deleteMany({
            where: { id: { in: existingRequests.slice(1).map((r) => r.id) } },
          });
        }
        joinRequest = await prisma.joinRequest.update({
          where: { id: existingRequest.id },
          data: {
            status: initialStatus,
            user_name: applicantName,
            user_phone: applicantPhone,
            user_iin: applicantIin,
            created_at: new Date(),
          },
        });
      } else {
        joinRequest = await prisma.joinRequest.create({
          data: {
            booking_id: booking.id,
            user_iin: applicantIin,
            user_name: applicantName,
            user_phone: applicantPhone,
            status: initialStatus,
          },
        });
      }

      if (isAutoApprove) {
        // Add applicant as an approved guest to BookingGuest granting door access
        const existingGuest = await prisma.bookingGuest.findUnique({
          where: {
            booking_id_user_id: {
              booking_id: booking.id,
              user_id: req.user.id,
            },
          },
        });

        if (existingGuest) {
          await prisma.bookingGuest.update({
            where: { id: existingGuest.id },
            data: { status: 'approved', checked_in_at: new Date() },
          });
        } else {
          await prisma.bookingGuest.create({
            data: {
              booking_id: booking.id,
              user_id: req.user.id,
              type: 'invited',
              status: 'approved',
              checked_in_at: new Date(),
            },
          });
        }

        // Decrement needed_players_count by 1
        const newNeededCount = Math.max(0, booking.needed_players_count - 1);
        const disableSearch = newNeededCount === 0;

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            needed_players_count: newNeededCount,
            is_looking_for_players: disableSearch ? false : booking.is_looking_for_players,
          },
        });

        return res.status(201).json({
          success: true,
          message: 'Заявка автоматически одобрена! Вы успешно присоединились к игре и получили доступ к замку.',
          data: joinRequest,
          autoApproved: true,
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Заявка на присоединение к слоту успешно отправлена!',
        data: joinRequest,
      });
    } catch (error: any) {
      console.error('[BookingsController.requestJoinSlot]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/v1/bookings/:id/matchmaking-settings
   * Update Matchmaking settings for a booking slot (Host/Admin only)
   */
  public static async updateMatchmakingSettings(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;
      const { isLookingForPlayers, is_looking_for_players, neededPlayersCount, needed_players_count, autoApprovePlayers, auto_approve_players } = req.body;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      if (booking.host_user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Только хозяин слота может изменять настройки поиска игроков' });
      }

      const flagLooking = isLookingForPlayers !== undefined ? Boolean(isLookingForPlayers) : (is_looking_for_players !== undefined ? Boolean(is_looking_for_players) : booking.is_looking_for_players);
      const countNeeded = neededPlayersCount !== undefined ? parseInt(neededPlayersCount) : (needed_players_count !== undefined ? parseInt(needed_players_count) : booking.needed_players_count);
      const flagAutoApprove = autoApprovePlayers !== undefined ? Boolean(autoApprovePlayers) : (auto_approve_players !== undefined ? Boolean(auto_approve_players) : booking.auto_approve_players);

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          is_looking_for_players: flagLooking,
          needed_players_count: Math.max(0, countNeeded),
          auto_approve_players: flagAutoApprove,
        },
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true, iin: true } },
          guests: { include: { user: { select: { id: true, full_name: true } } } },
        },
      });

      return res.json({
        success: true,
        message: 'Настройки поиска игроков (Matchmaking) успешно обновлены',
        data: updated,
      });
    } catch (error: any) {
      console.error('[BookingsController.updateMatchmakingSettings]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/bookings/open-matchmaking
   * Get all active confirmed bookings where is_looking_for_players === true and needed_players_count > 0
   */
  public static async getOpenMatchmakingBookings(req: Request, res: Response) {
    try {
      const openBookings = await prisma.booking.findMany({
        where: {
          status: 'confirmed',
          is_looking_for_players: true,
          needed_players_count: { gt: 0 },
        },
        include: {
          ground: true,
          host_user: { select: { id: true, full_name: true, phone_number: true, iin: true } },
          guests: { include: { user: { select: { id: true, full_name: true } } } },
          joinRequests: true,
        },
        orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }],
      });

      return res.json({
        success: true,
        data: openBookings,
      });
    } catch (error: any) {
      console.error('[BookingsController.getOpenMatchmakingBookings]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all join requests for a booking slot (de-duplicated per user)
   */
  public static async getBookingJoinRequests(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      if (booking.host_user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'У вас нет прав для просмотра заявок этого слота' });
      }

      const requests = await prisma.joinRequest.findMany({
        where: { booking_id: id },
        orderBy: { created_at: 'desc' },
      });

      const seenUsers = new Set<string>();
      const uniqueRequests: any[] = [];
      for (const r of requests) {
        const userKey = r.user_iin || r.user_phone || r.id;
        if (!seenUsers.has(userKey)) {
          seenUsers.add(userKey);
          uniqueRequests.push(r);
        }
      }

      return res.json({
        success: true,
        data: uniqueRequests,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/bookings/:id/participants
   * Returns details about organizer (creator) and accepted/active participants
   */
  public static async getBookingParticipants(req: AuthenticatedRequest, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          host_user: {
            select: {
              id: true,
              full_name: true,
              phone_number: true,
              avatar_url: true,
            },
          },
          guests: {
            where: {
              status: { in: ['approved', 'active', 'entered', 'APPROVED', 'ACTIVE', 'ENTERED', 'accepted', 'ACCEPTED'] },
            },
            include: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  phone_number: true,
                  avatar_url: true,
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
          joinRequests: {
            where: {
              status: { in: ['APPROVED', 'approved', 'ACCEPTED', 'accepted'] },
            },
            orderBy: { created_at: 'asc' },
          },
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      // Build Organizer object
      const organizer = {
        id: booking.host_user?.id || booking.host_user_id,
        fullName: booking.host_user?.full_name || 'Организатор',
        phone: booking.host_user?.phone_number || '',
        avatar: (booking.host_user as any)?.avatar_url || null,
        isCurrentUser: booking.host_user_id === req.user.id,
      };

      // Build Participants list (deduplicating guests & approved join requests)
      const participantsMap = new Map<string, any>();

      for (const guest of booking.guests) {
        const uId = guest.user?.id || guest.user_id;
        const isCurrentUser = Boolean(uId === req.user.id || (req.user.iin && guest.user && (guest.user as any).iin === req.user.iin));
        participantsMap.set(uId, {
          id: guest.id,
          userId: uId,
          fullName: guest.user?.full_name || 'Участник',
          phone: guest.user?.phone_number || '',
          avatar: (guest.user as any)?.avatar_url || null,
          status: 'ACCEPTED',
          isCurrentUser,
        });
      }

      for (const reqItem of booking.joinRequests) {
        const alreadyExists = Array.from(participantsMap.values()).some(
          (p) => (p.phone && p.phone === reqItem.user_phone) || (p.fullName && p.fullName === reqItem.user_name)
        );
        if (!alreadyExists) {
          const isCurrentUser = Boolean(
            (req.user.iin && reqItem.user_iin === req.user.iin) ||
            (req.user.phone_number && reqItem.user_phone === req.user.phone_number)
          );
          participantsMap.set(reqItem.id, {
            id: reqItem.id,
            userId: reqItem.id,
            fullName: reqItem.user_name || 'Участник',
            phone: reqItem.user_phone || '',
            avatar: null,
            status: 'ACCEPTED',
            isCurrentUser,
          });
        }
      }

      const participants = Array.from(participantsMap.values());

      return res.json({
        success: true,
        data: {
          bookingId: booking.id,
          organizer,
          creator: organizer,
          participants,
          totalCount: 1 + participants.length,
        },
      });
    } catch (error: any) {
      console.error('[BookingsController.getBookingParticipants]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/join-requests/incoming
   * GET /api/v1/bookings/requests
   * Get all incoming join requests for bookings hosted by current user (de-duplicated per user)
   */
  public static async getHostIncomingRequests(req: AuthenticatedRequest, res: Response) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { dateStr: currentDateStr, timeStr: currentTimeStr } = getLocalNow();

      // Find all ACTIVE / CONFIRMED bookings hosted by this user that have join requests
      const hostedBookings = await prisma.booking.findMany({
        where: {
          host_user_id: req.user.id,
          status: { in: ['confirmed', 'active', 'upcoming', 'CONFIRMED', 'ACTIVE', 'UPCOMING'] },
        },
        include: {
          ground: true,
          guests: {
            include: { user: { select: { id: true, full_name: true, phone_number: true } } },
          },
          joinRequests: {
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }],
      });

      // Filter out completed or past sessions where end time has already passed
      const activeFutureBookings = hostedBookings.filter((b) => {
        let bDate = b.booking_date;
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(bDate)) {
          const [d, m, y] = bDate.split('.');
          bDate = `${y}-${m}-${d}`;
        }
        if (bDate < currentDateStr) return false;
        if (bDate === currentDateStr && b.end_time <= currentTimeStr) return false;
        return true;
      });

      const data = activeFutureBookings
        .filter((b) => b.joinRequests && b.joinRequests.length > 0)
        .map((b) => {
          // De-duplicate join requests per user, keeping the latest request
          const seenUsers = new Set<string>();
          const uniqueRequests: any[] = [];
          for (const r of b.joinRequests) {
            const userKey = r.user_iin || r.user_phone || r.id;
            if (!seenUsers.has(userKey)) {
              seenUsers.add(userKey);
              uniqueRequests.push({
                id: r.id,
                userName: r.user_name || 'Пользователь',
                userPhone: r.user_phone || '',
                userIin: r.user_iin || '',
                status: r.status === 'APPROVED' ? 'accepted' : r.status === 'REJECTED' ? 'declined' : r.status === 'LEFT' ? 'left' : 'pending',
                createdAt: r.created_at,
              });
            }
          }

          const pendingCount = uniqueRequests.filter((r) => r.status === 'pending').length;

          let normalizedDate = b.booking_date;
          if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            const [y, m, d] = normalizedDate.split('-');
            normalizedDate = `${d}.${m}.${y}`;
          }

          let isoDate = b.booking_date;
          if (/^\d{2}\.\d{2}\.\d{4}$/.test(isoDate)) {
            const [d, m, y] = isoDate.split('.');
            isoDate = `${y}-${m}-${d}`;
          }

          return {
            id: b.id,
            venueId: b.ground_id,
            venueTitle: b.ground.name,
            sport: (b.ground.type || 'football').toLowerCase(),
            address: b.ground.address,
            date: normalizedDate,
            rawDate: isoDate,
            timeSlot: `${b.start_time} – ${b.end_time}`,
            startTime: b.start_time,
            endTime: b.end_time,
            joinedCount: 1 + b.guests.filter((g) => g.status === 'approved').length,
            pendingRequestsCount: pendingCount,
            requests: uniqueRequests,
          };
        })
        .filter((b) => b.requests.length > 0);

      // Sort:
      // 1. Slots with pendingRequestsCount > 0 come FIRST (descending)
      // 2. Then by date and start_time ascending
      data.sort((a, b) => {
        if (b.pendingRequestsCount !== a.pendingRequestsCount) {
          return b.pendingRequestsCount - a.pendingRequestsCount;
        }
        if (a.rawDate !== b.rawDate) {
          return a.rawDate.localeCompare(b.rawDate);
        }
        return a.startTime.localeCompare(b.startTime);
      });

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('[BookingsController.getHostIncomingRequests]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/join-requests/my
   * Get all outgoing join requests created by current user (de-duplicated per booking)
   */
  public static async getMyJoinRequests(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const userIin = req.user.iin;
      const userPhone = req.user.phone_number;

      const requests = await prisma.joinRequest.findMany({
        where: {
          OR: [
            { user_iin: userIin },
            { user_phone: userPhone },
          ],
        },
        include: {
          booking: {
            include: {
              ground: true,
              host_user: { select: { id: true, full_name: true, phone_number: true } },
              guests: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const seenBookings = new Set<string>();
      const uniqueRequests: any[] = [];
      for (const r of requests) {
        if (!r.booking) continue;
        if (!seenBookings.has(r.booking_id)) {
          seenBookings.add(r.booking_id);
          uniqueRequests.push(r);
        }
      }

      const mapped = uniqueRequests.map((r) => {
        let status: 'pending' | 'confirmed' | 'declined' = 'pending';
        if (r.status === 'APPROVED') status = 'confirmed';
        else if (r.status === 'REJECTED') status = 'declined';

        return {
          id: r.id,
          bookingId: r.booking_id,
          venueId: r.booking.ground_id,
          venueTitle: r.booking.ground.name,
          sport: (r.booking.ground.type || 'football').toLowerCase(),
          address: r.booking.ground.address,
          date: r.booking.booking_date,
          timeSlot: `${r.booking.start_time} – ${r.booking.end_time}`,
          status,
          hostName: r.booking.host_user?.full_name || 'Организатор',
          hostPhone: r.booking.host_user?.phone_number || '',
          participantsCount: 1 + (r.booking.guests ? r.booking.guests.filter((g: any) => g.status === 'approved').length : 0),
          createdAt: r.created_at,
        };
      });

      return res.json({
        success: true,
        data: mapped,
      });
    } catch (error: any) {
      console.error('[BookingsController.getMyJoinRequests]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Host approves (APPROVED) or rejects (REJECTED) a join request
   */
  public static async respondJoinRequest(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const requestId = req.params.requestId || req.params.id;
      const { status } = req.body; // 'APPROVED' | 'REJECTED'

      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Укажите статус: APPROVED или REJECTED' });
      }

      const joinRequest = await prisma.joinRequest.findUnique({
        where: { id: requestId },
        include: {
          booking: {
            include: { guests: true },
          },
        },
      });

      if (!joinRequest) {
        return res.status(404).json({ success: false, message: 'Заявка не найдена' });
      }

      if (joinRequest.booking.host_user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Только хозяин слота может принимать или отклонять заявки' });
      }

      // Check 15-person limit on approval (1 Host + up to 14 guests = 15 total)
      if (status === 'APPROVED') {
        const approvedCount = 1 + (joinRequest.booking.guests?.filter((g: any) => g.status === 'approved').length || 0);
        if (approvedCount >= 15) {
          return res.status(400).json({
            success: false,
            message: 'Все места заняты (максимум 15 человек)',
          });
        }
        const candidateUser = await prisma.user.findFirst({
          where: {
            OR: [
              { iin: joinRequest.user_iin },
              { phone_number: joinRequest.user_phone },
            ],
          },
        });

        if (candidateUser) {
          const hasOverlap = await BookingsController.checkUserHasOverlap(
            candidateUser.id,
            joinRequest.booking.booking_date,
            joinRequest.booking.start_time,
            joinRequest.booking.end_time,
            joinRequest.booking_id
          );

          if (hasOverlap) {
            return res.status(400).json({
              success: false,
              message: 'Нельзя принять пользователя: у него уже есть активная бронь или игра в другой команде в это время',
            });
          }
        }
      }

      const updatedRequest = await prisma.joinRequest.update({
        where: { id: requestId },
        data: { status },
      });

      // If approved, automatically add or reactivate applicant as an approved guest in BookingGuest
      if (status === 'APPROVED') {
        const fullRequest = await prisma.joinRequest.findUnique({
          where: { id: requestId },
          include: { booking: true },
        });

        if (fullRequest) {
          const applicantUser = await prisma.user.findFirst({
            where: {
              OR: [
                { iin: fullRequest.user_iin },
                { phone_number: fullRequest.user_phone },
              ],
            },
          });

          if (applicantUser) {
            const existingGuest = await prisma.bookingGuest.findUnique({
              where: {
                booking_id_user_id: {
                  booking_id: fullRequest.booking_id,
                  user_id: applicantUser.id,
                },
              },
            });

            if (existingGuest) {
              await prisma.bookingGuest.update({
                where: { id: existingGuest.id },
                data: {
                  status: 'approved',
                  checked_in_at: new Date(),
                },
              });
            } else {
              await prisma.bookingGuest.create({
                data: {
                  booking_id: fullRequest.booking_id,
                  user_id: applicantUser.id,
                  type: 'invited',
                  status: 'approved',
                  checked_in_at: new Date(),
                },
              });
            }
          }
        }
      }

      return res.json({
        success: true,
        message: status === 'APPROVED' ? 'Заявка успешно одобрена. Игрок добавлен к сеансу.' : 'Заявка отклонена',
        data: updatedRequest,
      });
    } catch (error: any) {
      console.error('[BookingsController.respondJoinRequest]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Host cancels a booking slot (status: 'CANCELLED')
   */
  public static async cancelBooking(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { ground: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      if (booking.host_user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Только хозяин бронирования может отменить этот слот',
        });
      }

      if (booking.status === 'CANCELLED' || booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Это бронирование уже отменено',
        });
      }

      // 1. Update Booking status to 'cancelled'
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          payment_status: 'refunded',
        },
        include: { ground: true },
      });

      // 2. Cancel all join requests associated with this booking
      await prisma.joinRequest.updateMany({
        where: {
          booking_id: id,
          status: { in: ['PENDING', 'APPROVED', 'pending', 'approved'] },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // 3. Cancel all guest participants associated with this booking
      await prisma.bookingGuest.updateMany({
        where: {
          booking_id: id,
        },
        data: {
          status: 'cancelled',
        },
      });

      return res.json({
        success: true,
        message: 'Бронирование успешно отменено. Доступ к замку аннулирован, а слот освобожден.',
        data: updatedBooking,
      });
    } catch (error: any) {
      console.error('[BookingsController.cancelBooking]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Host removes (kicks) a guest/participant from a booking slot
   */
  public static async removeGuest(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { bookingId, guestId } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Бронирование не найдено' });
      }

      if (booking.host_user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Только хозяин бронирования может удалять участников',
        });
      }

      const bookingGuest = await prisma.bookingGuest.findUnique({
        where: { id: guestId },
        include: { user: true },
      });

      if (!bookingGuest || bookingGuest.booking_id !== bookingId) {
        return res.status(404).json({ success: false, message: 'Участник не найден в данном бронировании' });
      }

      // Delete the BookingGuest record
      await prisma.bookingGuest.delete({
        where: { id: guestId },
      });

      // Revoke any corresponding JoinRequest for that user on this booking
      if (bookingGuest.user) {
        await prisma.joinRequest.updateMany({
          where: {
            booking_id: bookingId,
            OR: [
              { user_iin: bookingGuest.user.iin },
              { user_phone: bookingGuest.user.phone_number },
            ],
          },
          data: { status: 'REMOVED' },
        });
      }

      return res.json({
        success: true,
        message: `Участник "${bookingGuest.user?.full_name || 'Гость'}" успешно удален из слота. Доступ к замку аннулирован.`,
      });
    } catch (error: any) {
      console.error('[BookingsController.removeGuest]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Helper method for No-Show Auto-Ban Engine (Background Cron Worker)
   */
  public static async processNoShowAutoBans() {
    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];

    const confirmedBookings = await prisma.booking.findMany({
      where: {
        booking_date: currentDateStr,
        status: 'confirmed',
        is_door_opened: false,
      },
      include: { host_user: true },
    });

    const bannedUntilDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 Hours from now
    let count = 0;

    for (const b of confirmedBookings) {
      const [startH, startM] = b.start_time.split(':').map(Number);
      const bookingStartDate = new Date(now);
      bookingStartDate.setHours(startH, startM, 0, 0);

      // Start grace countdown from whichever is later: slot start_time OR booking creation time
      const effectiveStartTime = Math.max(
        bookingStartDate.getTime(),
        new Date((b as any).created_at || now).getTime()
      );

      const diffMs = now.getTime() - effectiveStartTime;
      const diffMins = diffMs / (1000 * 60);

      if (diffMins >= 10) {
        await prisma.booking.update({
          where: { id: b.id },
          data: { status: 'cancelled_no_show' },
        });

        // Admin Immunity Check
        const isAdmin = b.host_user.role === 'admin' || b.host_user.role === 'superadmin';

        if (!isAdmin) {
          await prisma.user.update({
            where: { id: b.host_user_id },
            data: {
              is_banned: true,
              banned_until: bannedUntilDate,
            },
          });

          // Record Ban Log Entry in DB
          await prisma.userBan.create({
            data: {
              user_id: b.host_user_id,
              ground_id: b.ground_id,
              reason: 'No-Show (Неявка на бронирование >10 мин)',
              banned_until: bannedUntilDate,
              is_resolved: false,
            },
          });

          console.log(`[No-Show Worker] Auto-cancelled booking "${b.id}" and issued 24h ban for host "${b.host_user.full_name}".`);
        } else {
          console.log(`[No-Show Worker] Auto-cancelled booking "${b.id}". Admin Immunity applied: No ban issued for "${b.host_user.full_name}".`);
        }

        count++;
      }
    }

    return count;
  }

  /**
   * 10-Minute No-Show Auto-Ban Engine
   * Finds confirmed bookings past 10 minutes from start_time where is_door_opened === false.
   * Cancels booking (status = 'cancelled_no_show') and bans host user for 24 hours.
   */
  public static async checkNoShows(req: Request, res: Response) {
    try {
      const count = await BookingsController.processNoShowAutoBans();
      return res.json({
        success: true,
        message: `Проверка неявок завершена. Обработано неявок: ${count}`,
        data: { noShowsCount: count },
      });
    } catch (error: any) {
      console.error('[BookingsController.checkNoShows]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}



