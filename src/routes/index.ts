import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { GroundsController } from '../controllers/groundsController';
import { BookingsController } from '../controllers/bookingsController';
import { LocksController } from '../controllers/locksController';
import { AdminController } from '../controllers/adminController';
import { NotificationsController } from '../controllers/notificationsController';
import { IssuesController } from '../controllers/issuesController';
import { authenticateJwt, requireAdmin } from '../middlewares/authMiddleware';
import { validateIIN } from '../utils/iinValidator';

const router = Router();

// --- Notifications & Web Push Routes ---
router.get('/notifications/vapid-key', NotificationsController.getVapidKey as any);
router.get('/notifications/vapid-public-key', NotificationsController.getVapidKey as any);
router.get('/notifications/status', authenticateJwt, NotificationsController.getStatus as any);
router.post('/notifications/subscribe', authenticateJwt, NotificationsController.subscribe as any);
router.post('/push/subscribe', authenticateJwt, NotificationsController.subscribe as any);
router.post('/notifications/unsubscribe', authenticateJwt, NotificationsController.unsubscribe as any);
router.post('/push/unsubscribe', authenticateJwt, NotificationsController.unsubscribe as any);
router.post('/notifications/toggle-reminders', authenticateJwt, NotificationsController.toggleReminders as any);
router.post('/notifications/test-push', authenticateJwt, NotificationsController.sendTestPush as any);

// --- Auth & User Registration Routes ---
router.post('/auth/register', AuthController.register as any);
router.post('/users/register', AuthController.register as any);
router.post('/auth/complete-profile', AuthController.completeProfile as any);
router.post('/auth/login', AuthController.login as any);
router.post('/auth/forgot-password', AuthController.forgotPassword as any);
router.post('/auth/reset-password', AuthController.resetPassword as any);
router.get('/auth/me', authenticateJwt, AuthController.getMe as any);

// --- User Profile & Email Verification Routes ---
router.post('/user/send-email-verification', authenticateJwt, AuthController.sendEmailVerification as any);
router.post('/user/verify-email', authenticateJwt, AuthController.verifyEmail as any);
router.post('/auth/send-email-verification', authenticateJwt, AuthController.sendEmailVerification as any);
router.post('/auth/verify-email', authenticateJwt, AuthController.verifyEmail as any);

// --- IIN Validation Utility Endpoint ---
router.post('/iin/validate', (req, res) => {
  const { iin } = req.body;
  const result = validateIIN(iin);
  return res.json({ success: result.isValid, data: result });
});

// --- Sports Grounds Routes ---
router.get('/grounds', GroundsController.getAllGrounds as any);
router.post('/grounds', authenticateJwt, requireAdmin, GroundsController.createGround as any);
router.put('/grounds/:id', GroundsController.updateGround as any);
router.put('/courts/:id', GroundsController.updateGround as any);
router.get('/grounds/qr/:qr_code_token', GroundsController.getGroundByQrToken as any);
router.post('/grounds/:id/reviews', authenticateJwt, GroundsController.addReview as any);

// --- Bookings & Slot Management Routes ---
router.get('/bookings/occupied', BookingsController.getOccupiedSlots as any);
router.get('/grounds/:id/slots', BookingsController.getOccupiedSlots as any);
router.get('/bookings', BookingsController.getAllBookings as any);
router.get('/bookings/all', BookingsController.getAllBookings as any);
router.get('/bookings/open-matchmaking', BookingsController.getOpenMatchmakingBookings as any);
router.post('/bookings', authenticateJwt, BookingsController.createBooking as any);
router.patch('/bookings/:id/matchmaking-settings', authenticateJwt, BookingsController.updateMatchmakingSettings as any);
router.get('/bookings/my', authenticateJwt, BookingsController.getMyBookings as any);
router.get('/bookings/my-active', authenticateJwt, BookingsController.getMyActiveBookings as any);
router.post('/bookings/:id/cancel', authenticateJwt, BookingsController.cancelBooking as any);
router.delete('/bookings/:id', authenticateJwt, BookingsController.cancelBooking as any);
router.post('/bookings/:id/extend', authenticateJwt, BookingsController.extendBooking as any);
router.post('/bookings/:id/complete', authenticateJwt, BookingsController.completeBooking as any);
router.post('/bookings/:id/finish', authenticateJwt, BookingsController.completeBooking as any);
router.post('/bookings/:id/leave', authenticateJwt, BookingsController.leaveBooking as any);
router.delete('/bookings/:id/leave', authenticateJwt, BookingsController.leaveBooking as any);
router.delete('/bookings/:id/participants/me', authenticateJwt, BookingsController.leaveBooking as any);
router.delete('/bookings/:bookingId/guests/:guestId', authenticateJwt, BookingsController.removeGuest as any);
router.post('/bookings/:id/invite-link', authenticateJwt, BookingsController.getInviteLink as any);
router.get('/invitations/:token', BookingsController.getInvitationByToken as any);
router.post('/invitations/:token/accept', authenticateJwt, BookingsController.acceptInvitation as any);

// --- Matchmaking & Slot Join Requests Routes ---
router.get('/matchmaking/open', BookingsController.getOpenMatchmakingBookings as any);
router.post('/matchmaking/join-requests', authenticateJwt, BookingsController.requestJoinSlot as any);
router.post('/matchmaking/join-requests/:id/approve', authenticateJwt, (req: any, res: any, next: any) => {
  req.params.requestId = req.params.id;
  req.body.status = 'APPROVED';
  return (BookingsController.respondJoinRequest as any)(req, res, next);
});
router.post('/matchmaking/join-requests/:id/reject', authenticateJwt, (req: any, res: any, next: any) => {
  req.params.requestId = req.params.id;
  req.body.status = 'REJECTED';
  return (BookingsController.respondJoinRequest as any)(req, res, next);
});

// Standard Join Requests Routes
router.post('/join-requests', authenticateJwt, BookingsController.requestJoinSlot as any);
router.get('/join-requests/my', authenticateJwt, BookingsController.getMyJoinRequests as any);
router.get('/join-requests/incoming', authenticateJwt, BookingsController.getHostIncomingRequests as any);
router.get('/join-requests', authenticateJwt, BookingsController.getHostIncomingRequests as any);
router.get('/requests/incoming', authenticateJwt, BookingsController.getHostIncomingRequests as any);
router.get('/requests', authenticateJwt, BookingsController.getHostIncomingRequests as any);
router.patch('/join-requests/:id/approve', authenticateJwt, (req: any, res: any, next: any) => {
  req.params.requestId = req.params.id;
  req.body.status = 'APPROVED';
  return (BookingsController.respondJoinRequest as any)(req, res, next);
});
router.post('/join-requests/:id/approve', authenticateJwt, (req: any, res: any, next: any) => {
  req.params.requestId = req.params.id;
  req.body.status = 'APPROVED';
  return (BookingsController.respondJoinRequest as any)(req, res, next);
});
router.patch('/join-requests/:id/reject', authenticateJwt, (req: any, res: any, next: any) => {
  req.params.requestId = req.params.id;
  req.body.status = 'REJECTED';
  return (BookingsController.respondJoinRequest as any)(req, res, next);
});
router.post('/join-requests/:id/reject', authenticateJwt, (req: any, res: any, next: any) => {
  req.params.requestId = req.params.id;
  req.body.status = 'REJECTED';
  return (BookingsController.respondJoinRequest as any)(req, res, next);
});

router.get('/bookings/requests', authenticateJwt, BookingsController.getHostIncomingRequests as any);
router.get('/bookings/my-requests-incoming', authenticateJwt, BookingsController.getHostIncomingRequests as any);
router.get('/bookings/:id/participants', authenticateJwt, BookingsController.getBookingParticipants as any);
router.post('/bookings/:id/request-join', authenticateJwt, BookingsController.requestJoinSlot as any);
router.post('/bookings/:id/join-request', authenticateJwt, BookingsController.requestJoinSlot as any);
router.get('/bookings/:id/requests', authenticateJwt, BookingsController.getBookingJoinRequests as any);
router.get('/bookings/:id/join-requests', authenticateJwt, BookingsController.getBookingJoinRequests as any);
router.post('/bookings/requests/:requestId/respond', authenticateJwt, BookingsController.respondJoinRequest as any);
router.post('/bookings/requests/:requestId/approve', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'APPROVED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/requests/:requestId/accept', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'APPROVED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/requests/:requestId/reject', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'REJECTED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/join-requests/:requestId/accept', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'APPROVED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/join-requests/:requestId/reject', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'REJECTED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/:id/requests/:requestId/approve', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'APPROVED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/:id/join-requests/:requestId/accept', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'APPROVED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });
router.post('/bookings/:id/join-requests/:requestId/reject', authenticateJwt, (req: any, res: any, next: any) => { req.body.status = 'REJECTED'; return (BookingsController.respondJoinRequest as any)(req, res, next); });

// --- Dynamic QR & Spontaneous Check-in ---
router.post('/bookings/spontaneous-join', authenticateJwt, BookingsController.spontaneousQrCheckIn as any);
router.post('/grounds/qr-check-in', authenticateJwt, BookingsController.spontaneousQrCheckIn as any);

// --- TTLock Developer Webhook & Callback Validation Endpoint ---
router.all('/ttlock/callback', (req, res) => {
  console.log(`[TTLock Webhook] Received ${req.method} request on /api/v1/ttlock/callback:`, req.method === 'GET' ? req.query : req.body);
  return res.status(200).send('OK');
});

// --- Hybrid Door Entry Access Control (TTLock) ---
router.get('/locks/status', LocksController.getLockStatus as any);
router.get('/locks/:lockId/status', LocksController.getLockStatus as any);
router.post('/locks/unlock', authenticateJwt, LocksController.unlockByAppButton as any);
router.post('/locks/:id/unlock', authenticateJwt, LocksController.unlockByAppButton as any);
router.post('/bookings/:id/unlock', authenticateJwt, LocksController.unlockByAppButton as any);
router.post('/locks/unlock-button', authenticateJwt, LocksController.unlockByAppButton as any);
router.post('/locks/unlock-qr', authenticateJwt, LocksController.unlockByDoorQr as any);
router.get('/locks/active-access', authenticateJwt, LocksController.getActiveAccess as any);

// --- Admin & Gateway Health Monitoring Routes (Strict RBAC Protected) ---
router.get('/admin/locks/status', authenticateJwt, requireAdmin, LocksController.getLockStatus as any);
router.get('/admin/locks/:lockId/status', authenticateJwt, requireAdmin, LocksController.getLockStatus as any);
router.post('/admin/locks/force-unlock', authenticateJwt, requireAdmin, LocksController.forceUnlockByAdmin as any);
router.get('/admin/gateways', authenticateJwt, requireAdmin, AdminController.getGatewayStatus as any);
router.post('/admin/gateways/toggle', authenticateJwt, requireAdmin, AdminController.toggleGatewayStatus as any);
router.get('/admin/lock-logs', authenticateJwt, requireAdmin, AdminController.getLockLogs as any);
router.get('/admin/stats', authenticateJwt, requireAdmin, AdminController.getSystemStats as any);

// --- Admin Analytics & Metrics Routes ---
router.get('/analytics/akimat', authenticateJwt, requireAdmin, AdminController.getAkimatAnalytics as any);
router.get('/admin/analytics/akimat', authenticateJwt, requireAdmin, AdminController.getAkimatAnalytics as any);
router.get('/admin/analytics/overview', authenticateJwt, requireAdmin, AdminController.getAnalyticsOverview as any);
router.get('/admin/analytics/venues/:venueId/heatmap', authenticateJwt, requireAdmin, AdminController.getVenueHeatmap as any);
router.get('/admin/analytics/venues/:venueId/players', authenticateJwt, requireAdmin, AdminController.getVenuePlayersAnalytics as any);
router.post('/admin/grounds', authenticateJwt, requireAdmin, GroundsController.createGround as any);
router.put('/admin/grounds/:id', authenticateJwt, requireAdmin, GroundsController.updateGround as any);
router.put('/admin/courts/:id', authenticateJwt, requireAdmin, GroundsController.updateGround as any);
router.post('/admin/bookings/check-noshows', authenticateJwt, requireAdmin, BookingsController.checkNoShows as any);
router.get('/admin/bans', authenticateJwt, requireAdmin, AdminController.getBansList as any);
router.get('/admin/users', authenticateJwt, requireAdmin, AdminController.getUsersList as any);
router.get('/users', authenticateJwt, requireAdmin, AdminController.getUsersList as any);
router.post('/admin/users/:userId/ban', authenticateJwt, requireAdmin, AdminController.banUser as any);
router.post('/admin/users/:userId/unban', authenticateJwt, requireAdmin, AdminController.unbanUser as any);

// --- Issue Reports & User Complaints Routes ---
router.post('/issues', authenticateJwt, IssuesController.createIssue as any);
router.get('/admin/issues', authenticateJwt, requireAdmin, IssuesController.getAdminIssues as any);
router.patch('/admin/issues/:id', authenticateJwt, requireAdmin, IssuesController.updateAdminIssueStatus as any);
router.post('/admin/issues/:id/status', authenticateJwt, requireAdmin, IssuesController.updateAdminIssueStatus as any);

export default router;
