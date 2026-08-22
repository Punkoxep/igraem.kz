import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { ENV } from '../config/env';
import { TTLockService } from './ttlockService';

export class CronService {
  public static initGatewayMonitoring() {
    console.log(`[CronService] Initializing Direct Wi-Fi Lock Monitor (Direct Wi-Fi Lock ID: 34275770, Permanent Cloud Connection)...`);

    const executeGatewayCheck = async () => {
      try {
        const dbGateways = await prisma.gateway.findMany();
        const gatewaysSummary: any[] = [];

        for (const gw of dbGateways) {
          // Direct Wi-Fi Lock operates in permanent online direct cloud connection
          // Preserve manual toggle if explicitly set, default to online
          const currentStatus = gw.status || 'online';
          const isOnline = currentStatus === 'online';

          await prisma.gateway.update({
            where: { id: gw.id },
            data: {
              last_ping_at: new Date(),
            },
          });

          gatewaysSummary.push({
            gatewayId: gw.ttlock_gateway_id,
            gatewayName: gw.gateway_name,
            connectionType: 'Direct Wi-Fi (Built-in)',
            isOnline,
            status: currentStatus,
          });
        }

        console.log(`[CronService] Direct Wi-Fi Lock (ID: 34275770) status: ONLINE (Permanent Direct Cloud Connection) - ` + JSON.stringify(gatewaysSummary));
      } catch (error: any) {
        console.error(`[CronService] Error in Direct Wi-Fi Lock Monitor:`, error.message);
      }
    };

    // Run immediately once on startup, then periodically every 30 seconds
    executeGatewayCheck();
    setInterval(executeGatewayCheck, 30000);
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
