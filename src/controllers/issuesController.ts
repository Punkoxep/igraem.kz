import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class IssuesController {
  /**
   * POST /api/v1/issues
   * Submit an issue report / complaint from user
   */
  static async createIssue(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Необходима авторизация' });
      }

      const { message, ground_id, groundId, booking_id, bookingId } = req.body;
      const targetGroundId = ground_id || groundId;
      const targetBookingId = booking_id || bookingId || null;

      if (!message || typeof message !== 'string' || message.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Текст проблемы должен содержать минимум 5 символов',
        });
      }

      // Resilient ground lookup
      let ground = null;
      if (targetGroundId) {
        ground = await prisma.ground.findUnique({ where: { id: targetGroundId } });
        if (!ground) {
          if (targetGroundId.includes('football')) {
            ground = await prisma.ground.findFirst({ where: { type: 'football' } });
          } else if (targetGroundId.includes('basketball')) {
            ground = await prisma.ground.findFirst({ where: { type: 'basketball' } });
          } else {
            ground = await prisma.ground.findFirst();
          }
        }
      }

      if (!ground && targetBookingId) {
        const b = await prisma.booking.findUnique({ where: { id: targetBookingId } });
        if (b) {
          ground = await prisma.ground.findUnique({ where: { id: b.ground_id } });
        }
      }

      if (!ground) {
        ground = await prisma.ground.findFirst();
      }

      if (!ground) {
        return res.status(404).json({ success: false, message: 'Спортивная площадка не найдена' });
      }

      const issue = await prisma.issueReport.create({
        data: {
          user_id: req.user.id,
          ground_id: ground.id,
          booking_id: targetBookingId || null,
          message: message.trim(),
          status: 'NEW',
        },
        include: {
          user: {
            select: { id: true, full_name: true, phone_number: true, iin: true },
          },
          ground: {
            select: { id: true, name: true, type: true, address: true },
          },
          booking: {
            select: { id: true, booking_date: true, start_time: true, end_time: true, status: true },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Спасибо! Сообщение о проблеме отправлено администрации',
        data: issue,
      });
    } catch (error: any) {
      console.error('[IssuesController.createIssue error]', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Ошибка при сохранении сообщения о проблеме',
      });
    }
  }

  /**
   * GET /api/v1/admin/issues
   * List all issues for administrators
   */
  static async getAdminIssues(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, ground_id, search } = req.query as {
        status?: string;
        ground_id?: string;
        search?: string;
      };

      const whereClause: any = {};

      if (status && status !== 'ALL') {
        whereClause.status = status.toUpperCase();
      }

      if (ground_id && ground_id !== 'ALL') {
        whereClause.ground_id = ground_id;
      }

      if (search && search.trim()) {
        const s = search.trim();
        whereClause.OR = [
          { message: { contains: s, mode: 'insensitive' } },
          { user: { full_name: { contains: s, mode: 'insensitive' } } },
          { user: { phone_number: { contains: s, mode: 'insensitive' } } },
          { user: { iin: { contains: s, mode: 'insensitive' } } },
          { ground: { name: { contains: s, mode: 'insensitive' } } },
        ];
      }

      const [issues, totalCount, newCount, inProgressCount, resolvedCount] = await Promise.all([
        prisma.issueReport.findMany({
          where: whereClause,
          include: {
            user: {
              select: { id: true, full_name: true, phone_number: true, iin: true },
            },
            ground: {
              select: { id: true, name: true, type: true, address: true },
            },
            booking: {
              select: { id: true, booking_date: true, start_time: true, end_time: true, status: true },
            },
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.issueReport.count(),
        prisma.issueReport.count({ where: { status: 'NEW' } }),
        prisma.issueReport.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.issueReport.count({ where: { status: 'RESOLVED' } }),
      ]);

      const formattedIssues = issues.map((iss) => ({
        id: iss.id,
        user_id: iss.user_id,
        user: iss.user
          ? {
              id: iss.user.id,
              full_name: iss.user.full_name,
              name: iss.user.full_name,
              phone_number: iss.user.phone_number,
              phone: iss.user.phone_number,
              iin: iss.user.iin,
            }
          : { id: '', full_name: 'Неизвестный', name: 'Неизвестный', phone_number: '—', phone: '—', iin: '—' },
        ground_id: iss.ground_id,
        ground: iss.ground
          ? {
              id: iss.ground.id,
              name: iss.ground.name,
              type: iss.ground.type,
              address: iss.ground.address,
            }
          : { id: '', name: 'Школа №11', type: 'general', address: 'Адрес не указан' },
        booking_id: iss.booking_id,
        booking: iss.booking || null,
        message: iss.message || '',
        status: iss.status || 'NEW',
        created_at: iss.created_at,
        createdAt: iss.created_at,
        updated_at: iss.updated_at,
        updatedAt: iss.updated_at,
      }));

      return res.status(200).json({
        success: true,
        data: formattedIssues,
        issues: formattedIssues,
        metrics: {
          total: totalCount,
          new: newCount,
          in_progress: inProgressCount,
          resolved: resolvedCount,
        },
      });
    } catch (error: any) {
      console.error('[IssuesController.getAdminIssues error]', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Ошибка получения списка жалоб',
      });
    }
  }

  /**
   * PATCH /api/v1/admin/issues/:id
   * Update issue status
   */
  static async updateAdminIssueStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['NEW', 'IN_PROGRESS', 'RESOLVED'];
      const normalizedStatus = (status || '').toUpperCase();

      if (!validStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Недопустимый статус. Разрешены: NEW, IN_PROGRESS, RESOLVED',
        });
      }

      const existing = await prisma.issueReport.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Запись жалобы не найдена' });
      }

      const updated = await prisma.issueReport.update({
        where: { id },
        data: { status: normalizedStatus },
        include: {
          user: {
            select: { id: true, full_name: true, phone_number: true, iin: true },
          },
          ground: {
            select: { id: true, name: true, type: true, address: true },
          },
          booking: {
            select: { id: true, booking_date: true, start_time: true, end_time: true, status: true },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Статус проблемы успешно обновлен',
        data: updated,
      });
    } catch (error: any) {
      console.error('[IssuesController.updateAdminIssueStatus error]', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Ошибка обновления статуса проблемы',
      });
    }
  }
}
