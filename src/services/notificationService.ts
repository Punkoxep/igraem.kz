import webpush from 'web-push';
import { prisma } from '../config/prisma';
import { ENV } from '../config/env';
import { getLocalNow, parseDateInLocalTime } from '../utils/dateUtils';

// Initialize Web Push VAPID configuration
try {
  webpush.setVapidDetails(
    ENV.VAPID_SUBJECT,
    ENV.VAPID_PUBLIC_KEY,
    ENV.VAPID_PRIVATE_KEY
  );
} catch (e: any) {
  console.warn('[NotificationService] VAPID initialization warning:', e.message);
}

export class NotificationService {
  /**
   * Return the public VAPID key so frontend can subscribe
   */
  public static getVapidPublicKey(): string {
    return ENV.VAPID_PUBLIC_KEY;
  }

  /**
   * Save user's Web Push subscription and reminder preference
   */
  public static async saveSubscription(userId: string, subscription: any, notify30min: boolean = true) {
    const subscriptionStr = typeof subscription === 'string' ? subscription : JSON.stringify(subscription);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        push_subscription: subscriptionStr,
        notify_30min: notify30min,
      },
      select: {
        id: true,
        full_name: true,
        notify_30min: true,
        push_subscription: true,
      },
    });

    return updatedUser;
  }

  /**
   * Toggle 30-min reminders on/off for a user
   */
  public static async toggleReminders(userId: string, enabled: boolean) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        notify_30min: enabled,
      },
      select: {
        id: true,
        full_name: true,
        notify_30min: true,
      },
    });

    return updatedUser;
  }

  /**
   * Send a Web Push notification to a target subscription
   */
  public static async sendPush(subscriptionRaw: string | object, payload: { title: string; body: string; icon?: string; url?: string; [key: string]: any }) {
    try {
      const subscription = typeof subscriptionRaw === 'string' ? JSON.parse(subscriptionRaw) : subscriptionRaw;
      if (!subscription || !subscription.endpoint) {
        throw new Error('Некорректный объект PushSubscription');
      }

      const stringifiedPayload = JSON.stringify({
        icon: '/favicon.svg',
        url: 'https://igraem.kz',
        ...payload,
        title: payload.title || '⚽ Напоминание о бронировании | igraem.kz',
        body: payload.body || '',
      });

      const result = await webpush.sendNotification(subscription, stringifiedPayload);
      return { success: true, statusCode: result.statusCode };
    } catch (error: any) {
      console.error('[NotificationService.sendPush] Push error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send test push notification directly to authenticated user
   */
  public static async sendTestPush(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, full_name: true, notify_30min: true, push_subscription: true },
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (!user.push_subscription) {
      throw new Error('Браузерная подписка на уведомления не найдена. Пожалуйста, включите тумблер напоминаний в профиле.');
    }

    const payload = {
      title: '⚽ Напоминание о бронировании | igraem.kz',
      body: 'Тестовое уведомление: напоминания о бронях за 30 минут успешно настроены и работают!',
      icon: '/favicon.svg',
      url: 'https://igraem.kz',
    };

    const pushResult = await this.sendPush(user.push_subscription, payload);
    return pushResult;
  }

  /**
   * Periodic scheduler task: scans active bookings starting in ~30 minutes
   * and sends push reminders to hosts and guests.
   */
  public static async process30MinBookingReminders() {
    try {
      const { dateStr: currentDateStr, timeStr: currentTimeStr } = getLocalNow();
      const currentTimestamp = parseDateInLocalTime(currentDateStr, currentTimeStr).getTime();

      // Find all confirmed bookings for today that haven't had reminders sent yet
      const bookings = await prisma.booking.findMany({
        where: {
          booking_date: currentDateStr,
          status: { in: ['confirmed', 'ACTIVE', 'CONFIRMED'] },
          is_reminder_sent: false,
        },
        include: {
          ground: true,
          host_user: true,
          guests: {
            where: { status: 'approved' },
            include: { user: true },
          },
        },
      });

      if (bookings.length === 0) return;

      for (const booking of bookings) {
        // Calculate milliseconds to booking start time
        const bookingStartDate = parseDateInLocalTime(booking.booking_date, booking.start_time);
        const diffMs = bookingStartDate.getTime() - currentTimestamp;
        const diffMinutes = Math.round(diffMs / 60000);

        // Target window: between 25 and 35 minutes before start (approx 30 mins)
        if (diffMinutes >= 25 && diffMinutes <= 35) {
          const groundName = booking.ground?.name || 'Школа №11';
          const notificationPayload = {
            title: '⚽ Напоминание о бронировании | igraem.kz',
            body: `Ваша игра на площадке «${groundName}» начнется через 30 минут (в ${booking.start_time}). Замок станет доступен для открытия за 10 минут до начала! Желаем отличной игры!`,
            icon: '/favicon.svg',
            url: 'https://igraem.kz',
            bookingId: booking.id,
          };

          let anySent = false;

          // 1. Notify host
          if (booking.host_user.notify_30min && booking.host_user.push_subscription) {
            await this.sendPush(booking.host_user.push_subscription, notificationPayload);
            anySent = true;
            console.log(`[NotificationService] Sent 30-min reminder to Host ${booking.host_user.full_name} for booking ${booking.id}`);
          }

          // 2. Notify approved guests
          for (const guest of booking.guests) {
            if (guest.user.notify_30min && guest.user.push_subscription) {
              await this.sendPush(guest.user.push_subscription, notificationPayload);
              anySent = true;
              console.log(`[NotificationService] Sent 30-min reminder to Guest ${guest.user.full_name} for booking ${booking.id}`);
            }
          }

          // Mark reminder as sent in DB
          await prisma.booking.update({
            where: { id: booking.id },
            data: { is_reminder_sent: true },
          });
        }
      }
    } catch (error: any) {
      console.error('[NotificationService.process30MinBookingReminders] Error:', error.message);
    }
  }
}
