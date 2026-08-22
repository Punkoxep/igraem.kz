import app from './app';
import { ENV } from './config/env';
import { CronService } from './services/cronService';

const PORT = ENV.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Sports Ground Sharing Backend is running!`);
  console.log(`📱 Mobile Web App: http://localhost:5173 (or http://localhost:${PORT})`);
  console.log(`📊 Admin & Test Dashboard (TTLock Mock, Gateways, IIN): http://localhost:${PORT}/admin`);
  console.log(`=======================================================`);

  // Initialize TTLock Gateway Health Cron Monitoring, Automated No-Show Worker & 30-min Booking Reminders
  CronService.initGatewayMonitoring();
  CronService.initNoShowAutoCheck();
  CronService.initBookingRemindersCron();
});
