import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { ENV } from '../config/env';
import { TTLockService } from './ttlockService';

export class CronService {
  public static initGatewayMonitoring() {
    console.log(`[CronService] Direct Wi-Fi Lock (ID: 34275770) initialized in permanent online mode. Background TTLock polling disabled to protect API limits.`);
  }

  public static initNoShowAutoCheck() {
    console.log('[CronService] Initializing Automated 60-second No-Show Auto-Ban Background Worker...');
    setInterval(async () => {
      try {
        const { BookingsController } = require('../controllers/bookingsController');
        await BookingsController.processNoShowAutoBans();
      } catch (error: any) {
        console.error('[CronService] Error in No-Show Background Worker:', error.message);
      }
    }, 60000);
  }

  public static initBookingRemindersCron() {
    console.log('[CronService] Initializing 60-second 30-Minute Booking Web Push Reminder Worker...');
    // Run immediately on start, then every 60 seconds
    const { NotificationService } = require('./notificationService');
    NotificationService.process30MinBookingReminders().catch(() => {});
    setInterval(async () => {
      try {
        await NotificationService.process30MinBookingReminders();
      } catch (error: any) {
        console.error('[CronService] Error in Booking Reminder Worker:', error.message);
      }
    }, 60000);
  }
}
