import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { NotificationService } from '../services/notificationService';
import { prisma } from '../config/prisma';

export class NotificationsController {
  /**
   * GET /api/v1/notifications/vapid-key
   * Returns public VAPID key for browser subscription
   */
  public static async getVapidKey(req: AuthenticatedRequest, res: Response) {
    try {
      const publicKey = NotificationService.getVapidPublicKey();
      return res.json({ success: true, publicKey });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/notifications/status
   * Returns notification preferences and subscription status for current user
   */
  public static async getStatus(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { notify_30min: true, push_subscription: true },
      });

      return res.json({
        success: true,
        data: {
          notify_30min: user?.notify_30min ?? false,
          hasSubscription: !!user?.push_subscription,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/v1/notifications/subscribe
   * Save Web Push subscription and reminder preference
   */
  public static async subscribe(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { subscription, notify30min = true, notify_30min } = req.body;
      const targetNotify = notify_30min !== undefined ? notify_30min : notify30min;

      if (!subscription) {
        return res.status(400).json({ success: false, message: 'Отсутствует объект subscription' });
      }

      const updatedUser = await NotificationService.saveSubscription(req.user.id, subscription, targetNotify);

      return res.json({
        success: true,
        message: 'Подписка на Push-уведомления успешно сохранена',
        data: updatedUser,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/v1/notifications/toggle-reminders
   * Enable or disable 30-min reminders
   */
  public static async toggleReminders(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const { enabled } = req.body;
      const targetEnabled = enabled === true || enabled === 'true';

      const updatedUser = await NotificationService.toggleReminders(req.user.id, targetEnabled);

      return res.json({
        success: true,
        message: targetEnabled ? 'Напоминания о бронях за 30 минут включены' : 'Напоминания о бронях отключены',
        data: updatedUser,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/v1/notifications/test-push
   * Send test push notification to verify browser/device reception
   */
  public static async sendTestPush(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Не авторизован' });

      const result = await NotificationService.sendTestPush(req.user.id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: `Не удалось отправить Push-уведомление: ${result.error}`,
        });
      }

      return res.json({
        success: true,
        message: 'Тестовое уведомление успешно отправлено в ваш браузер!',
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
