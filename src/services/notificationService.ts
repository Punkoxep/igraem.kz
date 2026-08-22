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

    let endpoint = '';
    let p256dh = '';
    let auth = '';

    if (typeof subscription === 'string') {
      try {
        const parsed = JSON.parse(subscription);
        endpoint = parsed.endpoint || '';
        p256dh = parsed.keys?.p256dh || parsed.p256dh || '';
        auth = parsed.keys?.auth || parsed.auth || '';
      } catch (e) {}
    } else if (subscription && typeof subscription === 'object') {
      endpoint = subscription.endpoint || '';
      p256dh = subscription.keys?.p256dh || subscription.p256dh || '';
      auth = subscription.keys?.auth || subscription.auth || '';
    }

    // Save/upsert to PushSubscription table
    if (endpoint && p256dh && auth) {
      try {
        await (prisma as any).pushSubscription.upsert({
          where: { endpoint },
          create: {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
          },
          update: {
            user_id: userId,
            p256dh,
            auth,
          },
        });
      } catch (e: any) {
        console.warn('[NotificationService.saveSubscription] Error upserting to push_subscriptions table:', e.message);
      }
    }

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
  public static async sendPush(
    subscriptionRaw: string | object,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      vibrate?: number[];
      silent?: boolean;
      requireInteraction?: boolean;
      data?: { url?: string; [key: string]: any };
      url?: string;
      [key: string]: any;
    }
  ) {
    let subscription: any = null;
    try {
      subscription = typeof subscriptionRaw === 'string' ? JSON.parse(subscriptionRaw) : subscriptionRaw;
      if (!subscription || !subscription.endpoint) {
        return { success: false, isExpired: true, error: 'Некорректный объект PushSubscription' };
      }

      const stringifiedPayload = JSON.stringify({
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        vibrate: payload.vibrate || [300, 100, 300, 100, 300],
        silent: payload.silent !== undefined ? payload.silent : false,
        requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : true,
        data: payload.data || { url: payload.url || '/requests' },
        ...payload,
        title: payload.title || '⚽ Новое уведомление | igraem.kz',
        body: payload.body || '',
      });

      const result = await webpush.sendNotification(subscription, stringifiedPayload);
      return { success: true, statusCode: result.statusCode };
    } catch (error: any) {
      const isExpired =
        error.statusCode === 410 ||
        error.statusCode === 404 ||
        error.statusCode === 400 ||
        (error.message &&
          (error.message.includes('410') ||
            error.message.includes('404') ||
            error.message.includes('NotRegistered') ||
            error.message.includes('Gone') ||
            error.message.includes('Received unexpected response code')));

      if (subscription?.endpoint && isExpired) {
        try {
          console.log('Expired push subscription removed:', subscription.endpoint);
          await (prisma as any).pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          });
        } catch (cleanupErr: any) {
          console.warn('[PushNotification] Error cleaning up dead push subscription:', cleanupErr.message);
        }
      } else {
        console.error('[PushNotification] Error sending to endpoint:', subscription?.endpoint || 'unknown', error.message || error);
      }

      return { success: false, isExpired: Boolean(isExpired), error: error.message };
    }
  }

  /**
   * Send Web Push notification to Organizer (Host) when someone requests to join their booking
   */
  public static async sendJoinRequestPushToHost(
    hostUserId: string,
    requesterName: string,
    groundName: string,
    bookingId?: string
  ) {
    try {
      if (!hostUserId) return;

      const hostUser = await prisma.user.findUnique({
        where: { id: hostUserId },
        include: {
          pushSubscriptions: true,
        },
      });

      if (!hostUser) return;

      const title = 'Новый запрос на игру! ⚽';
      const body = `${requesterName} просит присоединиться к вашей брони на ${groundName}`;
      const icon = '/icons/icon-192x192.png';
      const badge = '/icons/badge-72x72.png';
      const vibrate = [200, 100, 200];
      const payload = {
        title,
        body,
        icon,
        badge,
        vibrate,
        silent: false,
        requireInteraction: true,
        data: { url: '/requests?tab=incoming', bookingId },
      };

      const subscriptionsToSend: any[] = [];

      if (hostUser.pushSubscriptions && hostUser.pushSubscriptions.length > 0) {
        for (const sub of hostUser.pushSubscriptions) {
          subscriptionsToSend.push({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          });
        }
      } else if (hostUser.push_subscription) {
        try {
          subscriptionsToSend.push(JSON.parse(hostUser.push_subscription));
        } catch (e) {}
      }

      console.log(`[PushNotification] Sending push to userId: ${hostUserId} (${hostUser.full_name}). Found subscriptions: ${subscriptionsToSend.length}`);

      if (subscriptionsToSend.length === 0) {
        console.log(`[PushNotification] Host ${hostUser.full_name} (${hostUserId}) has no active push subscriptions.`);
        return;
      }

      for (const sub of subscriptionsToSend) {
        await this.sendPush(sub, payload);
      }
    } catch (error: any) {
      console.error('[NotificationService.sendJoinRequestPushToHost] Error:', error.message);
    }
  }

  /**
   * Send Web Push notification to Applicant (Player) when Organizer approves or rejects their join request
   */
  public static async sendJoinRequestStatusPushToApplicant(
    applicantUserId: string,
    status: 'APPROVED' | 'REJECTED',
    groundName: string,
    bookingId: string
  ) {
    try {
      if (!applicantUserId) return;

      const user = await prisma.user.findUnique({
        where: { id: applicantUserId },
        include: {
          pushSubscriptions: true,
        },
      });

      if (!user) return;

      const isApproved = status === 'APPROVED';
      const title = isApproved ? 'Вас добавили в игру! ⚽🎉' : 'Запрос на игру ⚽';
      const body = isApproved
        ? `Организатор одобрил ваш запрос на площадку "${groundName}". Доступ к слоту открыт!`
        : `К сожалению, организатор отклонил запрос на участие в брони на площадке "${groundName}".`;
      const icon = '/icons/icon-192x192.png';
      const badge = '/icons/badge-72x72.png';
      const vibrate = isApproved ? [200, 100, 200] : [100, 100, 100];
      const targetUrl = isApproved ? `/bookings?id=${bookingId}` : '/requests?tab=my';

      const payload = {
        title,
        body,
        icon,
        badge,
        tag: `booking-${isApproved ? 'accepted' : 'declined'}-${bookingId}`,
        renotify: true,
        requireInteraction: true,
        vibrate,
        silent: false,
        data: {
          url: targetUrl,
          bookingId,
        },
      };

      const subscriptionsToSend: any[] = [];

      if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
        for (const sub of user.pushSubscriptions) {
          subscriptionsToSend.push({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          });
        }
      } else if (user.push_subscription) {
        try {
          subscriptionsToSend.push(JSON.parse(user.push_subscription));
        } catch (e) {}
      }

      console.log(`[PushNotification] Sending join-request status (${status}) push to applicant: ${applicantUserId} (${user.full_name}). Found subscriptions: ${subscriptionsToSend.length}`);

      if (subscriptionsToSend.length === 0) {
        console.log(`[PushNotification] Applicant ${user.full_name} (${applicantUserId}) has no active push subscriptions.`);
        return;
      }

      for (const sub of subscriptionsToSend) {
        await this.sendPush(sub, payload);
      }
    } catch (error: any) {
      console.error('[NotificationService.sendJoinRequestStatusPushToApplicant] Error:', error.message);
    }
  }

  /**
   * Send Web Push notification to Organizer (Host) when a Participant leaves / cancels participation
   */
  public static async sendParticipantLeftPushToHost(
    hostUserId: string,
    participantName: string,
    groundName: string,
    startTime: string,
    bookingId: string
  ) {
    try {
      if (!hostUserId) return;

      const hostUser = await prisma.user.findUnique({
        where: { id: hostUserId },
        include: {
          pushSubscriptions: true,
        },
      });

      if (!hostUser) return;

      const title = 'Изменение в составе игроков ⚽';
      const body = `${participantName} отказался от участия в брони на ${groundName} (${startTime}).`;
      const icon = '/icons/icon-192x192.png';
      const badge = '/icons/badge-72x72.png';
      const vibrate = [200, 100, 200];
      const payload = {
        title,
        body,
        icon,
        badge,
        tag: `booking-member-left-${bookingId}`,
        renotify: true,
        requireInteraction: true,
        vibrate,
        silent: false,
        data: {
          url: `/requests?tab=incoming`,
          bookingId,
        },
      };

      const subscriptionsToSend: any[] = [];

      if (hostUser.pushSubscriptions && hostUser.pushSubscriptions.length > 0) {
        for (const sub of hostUser.pushSubscriptions) {
          subscriptionsToSend.push({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          });
        }
      } else if (hostUser.push_subscription) {
        try {
          subscriptionsToSend.push(JSON.parse(hostUser.push_subscription));
        } catch (e) {}
      }

      if (subscriptionsToSend.length === 0) return;

      for (const sub of subscriptionsToSend) {
        await this.sendPush(sub, payload);
      }
    } catch (error: any) {
      console.error('[NotificationService.sendParticipantLeftPushToHost] Error:', error.message);
    }
  }

  /**
   * Send test push notification directly to authenticated user
   */
  public static async sendTestPush(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { pushSubscriptions: true },
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    const hasSub = (user.pushSubscriptions && user.pushSubscriptions.length > 0) || !!user.push_subscription;
    if (!hasSub) {
      throw new Error('Браузерная подписка на уведомления не найдена. Пожалуйста, включите Push-уведомления в профиле.');
    }

    const payload = {
      title: '⚽ Тестовый Push | IGRAEM.KZ',
      body: 'Звук и вибрация работают отлично! Вы будете мгновенно получать запросы на игру.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      silent: false,
      data: { url: '/requests' },
    };

    const subs: any[] = [];
    if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
      for (const s of user.pushSubscriptions) {
        subs.push({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
      }
    } else if (user.push_subscription) {
      try {
        subs.push(JSON.parse(user.push_subscription));
      } catch (e) {}
    }

    console.log(`[PushNotification] Sending test push to userId: ${userId} (${user.full_name}). Found subscriptions: ${subs.length}`);

    let anySuccess = false;
    let anyExpired = false;
    let lastError = '';

    for (const sub of subs) {
      const res = await this.sendPush(sub, payload);
      if (res.success) {
        anySuccess = true;
      }
      if (res.isExpired) {
        anyExpired = true;
      }
      if (res.error) {
        lastError = res.error;
      }
    }

    if (anySuccess) {
      return { success: true, message: 'Push успешно отправлен' };
    }

    return {
      success: false,
      isExpired: anyExpired || subs.length === 0,
      error: lastError || 'Подписка устарела или недействительна',
    };
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
