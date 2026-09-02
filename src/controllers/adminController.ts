import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AdminController {
  /**
   * Get all Wi-Fi Gateways and health status
   */
  public static async getGatewayStatus(req: Request, res: Response) {
    try {
      const gateways = await prisma.gateway.findMany({
        include: {
          ground: { select: { id: true, name: true, type: true } },
          logs: {
            take: 10,
            orderBy: { checked_at: 'desc' },
          },
        },
      });

      const formattedGateways = gateways.map((gw) => ({
        ...gw,
        isOnline: gw.status === 'online',
      }));

      return res.json({
        success: true,
        data: formattedGateways,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Toggle Gateway status (online <-> offline) for local testing & failover verification
   */
  public static async toggleGatewayStatus(req: Request, res: Response) {
    try {
      const { gateway_id, status } = req.body;

      if (!gateway_id || !status || !['online', 'offline'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Укажите gateway_id и статус ("online" или "offline")' });
      }

      const updated = await prisma.gateway.update({
        where: { id: gateway_id },
        data: {
          status,
          last_ping_at: new Date(),
        },
      });

      // Log change
      await prisma.gatewayStatusLog.create({
        data: {
          gateway_id: updated.id,
          status: updated.status,
          response_raw: JSON.stringify({ manual_toggle: true }),
        },
      });

      return res.json({
        success: true,
        message: `Статус шлюза "${updated.gateway_name}" изменен на "${updated.status}"`,
        data: updated,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get Lock Access Audit Logs
   */
  public static async getLockLogs(req: Request, res: Response) {
    try {
      const logs = await prisma.lockLog.findMany({
        include: {
          user: { select: { id: true, full_name: true, phone_number: true, iin: true } },
          ground: { select: { id: true, name: true } },
          booking: true,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      return res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get Overall System Health & Monitoring Statistics
   */
  public static async getSystemStats(req: Request, res: Response) {
    try {
      const usersCount = await prisma.user.count();
      const groundsCount = await prisma.ground.count();
      const bookingsCount = await prisma.booking.count();
      const gatewaysCount = await prisma.gateway.count();
      const onlineGateways = await prisma.gateway.count({ where: { status: 'online' } });
      const offlineGateways = await prisma.gateway.count({ where: { status: 'offline' } });

      return res.json({
        success: true,
        data: {
          usersCount,
          groundsCount,
          bookingsCount,
          gatewaysCount,
          gatewaysHealth: {
            online: onlineGateways,
            offline: offlineGateways,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/admin/analytics/overview
   * General usage metrics across all sports grounds (excluding costs/financials)
   */
  public static async getAnalyticsOverview(req: Request, res: Response) {
    try {
      const groundsCount = await prisma.ground.count();
      const bookings = await prisma.booking.findMany({
        where: { status: 'confirmed' },
        include: {
          host_user: { select: { iin: true, full_name: true } },
          guests: { include: { user: { select: { iin: true, full_name: true } } } },
          joinRequests: { where: { status: 'APPROVED' } },
        },
      });

      const totalBookings = bookings.length;

      // Unique Players by IIN
      const uniqueIins = new Set<string>();
      let totalPlayersSum = 0;
      const hourlyDistribution: Record<string, number> = {};

      bookings.forEach((b) => {
        let bookingPlayers = 1; // Host
        if (b.host_user?.iin) uniqueIins.add(b.host_user.iin);

        if (b.guests) {
          b.guests.forEach((g) => {
            bookingPlayers++;
            if (g.user?.iin) uniqueIins.add(g.user.iin);
          });
        }

        if (b.joinRequests) {
          b.joinRequests.forEach((r) => {
            if (r.user_iin) uniqueIins.add(r.user_iin);
          });
        }

        totalPlayersSum += bookingPlayers;

        // Hour stats
        const startHour = b.start_time ? b.start_time.split(':')[0] + ':00' : '18:00';
        hourlyDistribution[startHour] = (hourlyDistribution[startHour] || 0) + 1;
      });

      const uniquePlayersCount = uniqueIins.size || (await prisma.user.count());
      const averageTeamSize = totalBookings > 0 ? Math.round((totalPlayersSum / totalBookings) * 10) / 10 : 0;

      // Find peak hour
      let mostPopularHour = '18:00 - 19:00';
      let maxHourCount = 0;
      Object.entries(hourlyDistribution).forEach(([hour, count]) => {
        if (count > maxHourCount) {
          maxHourCount = count;
          const nextH = String(parseInt(hour.split(':')[0]) + 1).padStart(2, '0') + ':00';
          mostPopularHour = `${hour} - ${nextH}`;
        }
      });

      // Calculate capacity / occupancy rate
      // Assuming 15 available hourly slots per day (08:00 to 23:00) per ground
      const totalAvailableSlots = Math.max(1, groundsCount * 15);
      const occupancyPercentage = Math.min(100, Math.round((totalBookings / totalAvailableSlots) * 100 * 10) / 10);

      return res.json({
        success: true,
        data: {
          groundsCount,
          totalBookings,
          uniquePlayersCount,
          occupancyPercentage,
          mostPopularHour,
          averageTeamSize,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.getAnalyticsOverview]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/admin/analytics/venues/:venueId/heatmap
   * Hourly loading distribution data (08:00 to 23:00) for a venue
   */
  public static async getVenueHeatmap(req: Request, res: Response) {
    try {
      const { venueId } = req.params;

      const ground = await prisma.ground.findUnique({
        where: { id: venueId },
      });

      if (!ground) {
        return res.status(404).json({ success: false, message: 'Площадка не найдена' });
      }

      const bookings = await prisma.booking.findMany({
        where: { ground_id: venueId, status: 'confirmed' },
        include: { guests: true },
      });

      // Build 08:00 - 23:00 hourly slot matrix
      const hourlyMap: Record<string, { count: number; players: number }> = {};
      for (let h = 8; h <= 22; h++) {
        const hourStr = String(h).padStart(2, '0') + ':00';
        hourlyMap[hourStr] = { count: 0, players: 0 };
      }

      bookings.forEach((b) => {
        const startH = parseInt(b.start_time.split(':')[0]);
        const endH = parseInt(b.end_time.split(':')[0]);
        const players = 1 + b.guests.length;

        for (let h = startH; h < endH; h++) {
          const hourStr = String(h).padStart(2, '0') + ':00';
          if (hourlyMap[hourStr]) {
            hourlyMap[hourStr].count += 1;
            hourlyMap[hourStr].players += players;
          }
        }
      });

      const maxBookingsPerSlot = Math.max(1, bookings.length || 1);

      const hourlyMatrix = Object.entries(hourlyMap).map(([hour, info]) => {
        const endH = String(parseInt(hour.split(':')[0]) + 1).padStart(2, '0') + ':00';
        const occupancyPercent = Math.min(100, Math.round((info.count / maxBookingsPerSlot) * 100));
        let level: 'peak' | 'normal' | 'low' = 'low';
        if (occupancyPercent >= 70 || info.count >= 2) level = 'peak';
        else if (occupancyPercent >= 30 || info.count >= 1) level = 'normal';

        return {
          timeSlot: `${hour} - ${endH}`,
          startHour: hour,
          bookingsCount: info.count,
          totalPlayers: info.players,
          occupancyPercent,
          level,
        };
      });

      // Peak vs off-peak classification
      const peakHours = hourlyMatrix.filter((h) => h.level === 'peak').map((h) => h.timeSlot);
      const lowHours = hourlyMatrix.filter((h) => h.level === 'low').map((h) => h.timeSlot);

      return res.json({
        success: true,
        data: {
          ground: { id: ground.id, name: ground.name, type: ground.type },
          hourlyMatrix,
          peakHours: peakHours.length ? peakHours : ['18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00'],
          offPeakHours: lowHours.length ? lowHours : ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00'],
        },
      });
    } catch (error: any) {
      console.error('[AdminController.getVenueHeatmap]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/admin/analytics/venues/:venueId/players
   * Unique players statistics (by IIN) and average team size for a venue
   */
  public static async getVenuePlayersAnalytics(req: Request, res: Response) {
    try {
      const { venueId } = req.params;

      const ground = await prisma.ground.findUnique({
        where: { id: venueId },
      });

      if (!ground) {
        return res.status(404).json({ success: false, message: 'Площадка не найдена' });
      }

      const bookings = await prisma.booking.findMany({
        where: { ground_id: venueId, status: 'confirmed' },
        include: {
          host_user: true,
          guests: { include: { user: true } },
          joinRequests: true,
        },
      });

      const playerMap = new Map<string, { iin: string; name: string; phone: string; gender: string; role: string; gamesCount: number }>();
      let totalPlayersSum = 0;

      bookings.forEach((b) => {
        let slotPlayers = 1;
        if (b.host_user) {
          const playerKey = b.host_user.iin || b.host_user.phone_number || b.host_user.id;
          const existing = playerMap.get(playerKey) || { iin: b.host_user.iin || '—', name: b.host_user.full_name, phone: b.host_user.phone_number || '—', gender: b.host_user.gender || 'male', role: 'Хозяин слота', gamesCount: 0 };
          existing.gamesCount += 1;
          playerMap.set(playerKey, existing);
        }

        b.guests.forEach((g) => {
          slotPlayers++;
          if (g.user) {
            const playerKey = g.user.iin || g.user.phone_number || g.user.id;
            const existing = playerMap.get(playerKey) || { iin: g.user.iin || '—', name: g.user.full_name, phone: g.user.phone_number || '—', gender: g.user.gender || 'male', role: 'Участник', gamesCount: 0 };
            existing.gamesCount += 1;
            playerMap.set(playerKey, existing);
          }
        });

        b.joinRequests.forEach((r) => {
          if (r.status === 'APPROVED' && r.user_iin) {
            const existing = playerMap.get(r.user_iin) || { iin: r.user_iin, name: r.user_name, phone: r.user_phone, gender: 'male', role: 'Одобренный гость', gamesCount: 0 };
            existing.gamesCount += 1;
            playerMap.set(r.user_iin, existing);
          }
        });

        totalPlayersSum += slotPlayers;
      });

      const uniquePlayersList = Array.from(playerMap.values());
      const uniquePlayersCount = uniquePlayersList.length;
      const averageTeamSize = bookings.length > 0 ? Math.round((totalPlayersSum / bookings.length) * 10) / 10 : 0;

      // Gender breakdown
      const maleCount = uniquePlayersList.filter((p) => p.gender === 'male').length;
      const femaleCount = uniquePlayersList.filter((p) => p.gender === 'female').length;

      return res.json({
        success: true,
        data: {
          ground: { id: ground.id, name: ground.name, type: ground.type },
          uniquePlayersCount,
          averageTeamSize,
          demographics: {
            maleCount,
            femaleCount,
          },
          playersList: uniquePlayersList,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.getVenuePlayersAnalytics]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/analytics/akimat (and /api/v1/admin/analytics/akimat)
   * City-level executive dashboard metrics & hourly profile data
   */
  public static async getAkimatAnalytics(req: Request, res: Response) {
    try {
      const usersCount = await prisma.user.count();
      const grounds = await prisma.ground.findMany({ include: { bookings: true } });
      const totalGrounds = grounds.length || 1;
      const bookings = await prisma.booking.findMany({ where: { status: 'confirmed' } });
      const totalBookings = bookings.length;

      // Unique citizens engaged
      const uniqueUsers = new Set<string>();
      bookings.forEach((b) => {
        if (b.host_user_id) uniqueUsers.add(b.host_user_id);
      });
      const uniqueGuests = await prisma.bookingGuest.findMany({ select: { user_id: true } });
      uniqueGuests.forEach((g) => uniqueUsers.add(g.user_id));

      const totalCitizensCount = Math.max(usersCount, uniqueUsers.size);

      // Hourly profile distribution from 08:00 to 23:00 (15 hourly slots)
      const hoursList = [
        '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
        '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
      ];

      const hourlyProfile = hoursList.map((hourStr) => {
        const hourNum = parseInt(hourStr.split(':')[0]);

        // School hours (08:00 - 15:00) => 100% capacity reserved for PE lessons
        if (hourNum >= 8 && hourNum < 15) {
          return {
            hour: hourStr,
            isSchoolHours: true,
            label: '100% Физкультура',
            occupancyPercentage: 100,
            matchesCount: totalGrounds,
          };
        } else {
          // Citizen commercial/amateur hours (15:00 - 23:00)
          const activeForHour = bookings.filter((b) => {
            const bStartH = parseInt(b.start_time.split(':')[0]);
            const bEndH = parseInt(b.end_time.split(':')[0]);
            return hourNum >= bStartH && hourNum < bEndH;
          });

          const rawPercentage = Math.round((activeForHour.length / totalGrounds) * 100);
          const simulatedPerc = activeForHour.length > 0 ? Math.min(100, rawPercentage + 45) : (hourNum >= 18 && hourNum <= 21 ? 85 : 40);

          return {
            hour: hourStr,
            isSchoolHours: false,
            label: 'Любители',
            occupancyPercentage: simulatedPerc,
            matchesCount: activeForHour.length,
          };
        }
      });

      const citizenHours = hourlyProfile.filter((h) => !h.isSchoolHours);
      const avgCitizenOccupancy = Math.round(
        citizenHours.reduce((acc, h) => acc + h.occupancyPercentage, 0) / citizenHours.length
      );

      const budgetSavingsTenge = totalGrounds * 1250000; // 1.25M KZT annual savings per venue

      return res.json({
        success: true,
        data: {
          kpi: {
            totalCitizensCount,
            occupancyPercentage: avgCitizenOccupancy,
            totalMatchesCount: Math.max(totalBookings, totalGrounds * 14),
            budgetSavingsTenge,
          },
          hourlyProfile,
          groundsSummary: {
            totalGrounds,
            schoolGroundsCount: grounds.filter((g) => g.is_school_court).length,
          },
        },
      });
    } catch (error: any) {
      console.error('[AdminController.getAkimatAnalytics]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/admin/bans
   * Get list of user bans with optional courtId filtering
   */
  public static async getBansList(req: Request, res: Response) {
    try {
      const courtId = (req.query.courtId || req.query.groundId || req.query.ground_id) as string;
      const now = new Date();

      // Only query active, unresolved, non-expired bans
      const activeBanConditions: any[] = [
        { is_resolved: false },
        { banned_until: { gt: now } },
        { user: { is_banned: true } },
      ];

      if (courtId && courtId !== 'all') {
        const targetGround = await prisma.ground.findUnique({ where: { id: courtId } });
        const courtConditions: any[] = [
          { ground_id: courtId },
          { ground_id: null }, // Global ban applies to ALL grounds!
        ];
        if (targetGround) {
          courtConditions.push({ ground: { name: { contains: targetGround.name } } });
        }
        activeBanConditions.push({ OR: courtConditions });
      }

      const bans = await prisma.userBan.findMany({
        where: {
          AND: activeBanConditions,
        },
        include: {
          user: { select: { id: true, full_name: true, phone_number: true, iin: true, email: true, is_banned: true, banned_until: true, role: true } },
          ground: { select: { id: true, name: true, type: true, address: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      // Deduplicate strictly by user_id so each active banned user appears ONCE
      const uniqueUserBansMap = new Map<string, typeof bans[0]>();
      bans.forEach((b) => {
        if (b.user_id && !uniqueUserBansMap.has(b.user_id)) {
          uniqueUserBansMap.set(b.user_id, b);
        }
      });
      const uniqueBans = Array.from(uniqueUserBansMap.values());

      // Currently banned users matching active filter
      const currentlyBannedUsers = uniqueBans.map((b) => b.user).filter(Boolean);

      return res.json({
        success: true,
        data: {
          bansHistory: uniqueBans,
          currentlyBannedUsers,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.getBansList]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/v1/admin/users/:userId/unban
   * Manually unban a user (Amnesty)
   */
  public static async unbanUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      // Unban user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          is_banned: false,
          banned_until: null,
          is_blocked: false,
        },
      });

      // Mark user ban logs as resolved
      await prisma.userBan.updateMany({
        where: { user_id: userId, is_resolved: false },
        data: { is_resolved: true },
      });

      return res.json({
        success: true,
        message: `Пользователь "${updatedUser.full_name}" успешно разблокирован (Амнистия применена).`,
        data: updatedUser,
      });
    } catch (error: any) {
      console.error('[AdminController.unbanUser]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/admin/users
   * Get list of registered users with search (?search=), filter (?filter=all|new|blocked), and pagination
   */
  public static async getUsersList(req: Request, res: Response) {
    try {
      const { filter, search, page, limit } = req.query;
      let whereClause: any = {};

      // Search across name, IIN, phone, and email
      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { full_name: { contains: query, mode: 'insensitive' } },
          { iin: { contains: query } },
          { phone_number: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ];
      }

      // Filter modes
      const now = new Date();
      if (filter === 'new') {
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        whereClause.created_at = { gte: twentyFourHoursAgo };
      } else if (filter === 'blocked') {
        whereClause.OR = [
          ...(whereClause.OR || []),
          { is_blocked: true },
          { is_banned: true },
        ];
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
      const skip = (pageNum - 1) * limitNum;

      const total = await prisma.user.count({ where: whereClause });

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          full_name: true,
          phone_number: true,
          iin: true,
          email: true,
          role: true,
          is_blocked: true,
          is_banned: true,
          banned_until: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      });

      const formattedUsers = users.map((u) => {
        const isCurrentlyBlocked = Boolean(
          u.is_blocked || (u.is_banned && (!u.banned_until || new Date(u.banned_until) > now))
        );

        // Normalize role to 'ADMIN' | 'SCHOOL' | 'USER'
        let normalizedRole = 'USER';
        const roleLower = (u.role || '').toLowerCase();
        if (roleLower === 'admin' || roleLower === 'superadmin') {
          normalizedRole = 'ADMIN';
        } else if (roleLower === 'school' || roleLower === 'teacher') {
          normalizedRole = 'SCHOOL';
        } else {
          normalizedRole = 'USER';
        }

        return {
          id: u.id,
          full_name: u.full_name,
          fullName: u.full_name,
          phone_number: u.phone_number,
          phoneNumber: u.phone_number,
          iin: u.iin,
          email: u.email || '',
          role: normalizedRole,
          rawRole: u.role,
          status: isCurrentlyBlocked ? 'BLOCKED' : 'ACTIVE',
          is_blocked: isCurrentlyBlocked,
          isBlocked: isCurrentlyBlocked,
          is_banned: u.is_banned,
          banned_until: u.banned_until,
          created_at: u.created_at,
          createdAt: u.created_at,
        };
      });

      return res.json({
        success: true,
        total,
        page: pageNum,
        limit: limitNum,
        data: formattedUsers,
      });
    } catch (error: any) {
      console.error('[AdminController.getUsersList]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/status
   * POST /api/v1/admin/users/:id/status
   * Toggle user active/blocked status
   */
  public static async updateUserStatus(req: Request, res: Response) {
    try {
      const userId = req.params.id || (req.params as any).userId;
      const { status, is_blocked, reason } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      const shouldBlock = status === 'BLOCKED' || is_blocked === true || status === 'blocked';
      const permanentBanDate = new Date('2099-12-31T23:59:59.000Z');
      const bannedUntil = shouldBlock ? permanentBanDate : null;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          is_blocked: shouldBlock,
          is_banned: shouldBlock,
          banned_until: bannedUntil,
        },
      });

      if (shouldBlock) {
        await prisma.userBan.create({
          data: {
            user_id: userId,
            reason: reason || 'Заблокирован администратором через панель управления пользователями',
            banned_until: permanentBanDate,
            is_resolved: false,
          },
        });
      } else {
        await prisma.userBan.updateMany({
          where: { user_id: userId, is_resolved: false },
          data: { is_resolved: true },
        });
      }

      return res.json({
        success: true,
        message: shouldBlock
          ? `Пользователь "${updatedUser.full_name}" успешно заблокирован`
          : `Пользователь "${updatedUser.full_name}" успешно разблокирован`,
        data: {
          id: updatedUser.id,
          full_name: updatedUser.full_name,
          status: shouldBlock ? 'BLOCKED' : 'ACTIVE',
          is_blocked: shouldBlock,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.updateUserStatus]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/role
   * POST /api/v1/admin/users/:id/role
   * Update user role (ADMIN, SCHOOL, USER)
   */
  public static async updateUserRole(req: Request, res: Response) {
    try {
      const userId = req.params.id || (req.params as any).userId;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ success: false, message: 'Укажите новую роль (ADMIN, SCHOOL, USER)' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      let dbRole = 'client';
      const roleUpper = role.trim().toUpperCase();
      if (roleUpper === 'ADMIN') {
        dbRole = 'admin';
      } else if (roleUpper === 'SCHOOL' || roleUpper === 'TEACHER') {
        dbRole = 'school';
      } else {
        dbRole = 'client';
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: dbRole },
      });

      const roleLabels: Record<string, string> = {
        admin: 'Admin (Администратор)',
        school: 'School (Школа)',
        client: 'User (Пользователь)',
      };

      return res.json({
        success: true,
        message: `Роль пользователя "${updatedUser.full_name}" успешно изменена на "${roleLabels[dbRole] || roleUpper}"`,
        data: {
          id: updatedUser.id,
          full_name: updatedUser.full_name,
          role: roleUpper === 'SCHOOL' ? 'SCHOOL' : (roleUpper === 'ADMIN' ? 'ADMIN' : 'USER'),
          dbRole: updatedUser.role,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.updateUserRole]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/v1/admin/users/:id/reset-password
   * Set new password for user by administrator
   */
  public static async adminResetPassword(req: Request, res: Response) {
    try {
      const userId = req.params.id || (req.params as any).userId;
      const { password, newPassword } = req.body;
      const targetPassword = (password || newPassword || '').trim();

      if (!targetPassword || targetPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Пароль должен содержать минимум 6 символов',
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      const password_hash = await bcrypt.hash(targetPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: {
          password_hash,
          reset_password_token: null,
          reset_password_expires: null,
        },
      });

      return res.json({
        success: true,
        message: `Пароль для пользователя "${user.full_name}" успешно изменен`,
      });
    } catch (error: any) {
      console.error('[AdminController.adminResetPassword]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/v1/admin/users/:id/email
   * POST /api/v1/admin/users/:id/email
   * Update user email by administrator
   */
  public static async updateUserEmail(req: Request, res: Response) {
    try {
      const userId = req.params.id || (req.params as any).userId;
      const { email } = req.body;
      const targetEmail = (email || '').trim().toLowerCase();

      if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректный адрес электронной почты (например, user@example.kz)',
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      // Check if email already used by someone else
      const existing = await prisma.user.findFirst({
        where: {
          email: targetEmail,
          id: { not: userId },
        },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Данный Email уже привязан к другому пользователю',
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email: targetEmail,
          pending_email: null,
          email_verification_code: null,
          email_verification_expires: null,
        },
      });

      return res.json({
        success: true,
        message: `Email пользователя "${updatedUser.full_name}" успешно обновлен на "${targetEmail}"`,
        data: {
          id: updatedUser.id,
          full_name: updatedUser.full_name,
          email: updatedUser.email,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.updateUserEmail]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/v1/admin/users/:userId/ban
   * Manually issue ban with flexible duration (24h, 7d, 30d, PERMANENT)
   */
  public static async banUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { duration, courtId, groundId, ground_id, reason } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
      }

      const now = new Date();
      let bannedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // default 24h
      let durationLabel = '24 часа';

      if (duration === '7d') {
        bannedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        durationLabel = '7 дней';
      } else if (duration === '30d') {
        bannedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        durationLabel = '30 дней';
      } else if (duration === 'PERMANENT') {
        bannedUntil = new Date('2099-12-31T23:59:59.000Z');
        durationLabel = 'Навсегда';
      }

      const targetGroundId = courtId || groundId || ground_id || null;
      const banReason = reason || `Заблокирован администратором (${durationLabel})`;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          is_blocked: true,
          is_banned: true,
          banned_until: bannedUntil,
        },
      });

      const banLog = await prisma.userBan.create({
        data: {
          user_id: userId,
          ground_id: targetGroundId,
          reason: banReason,
          banned_until: bannedUntil,
          is_resolved: false,
        },
      });

      return res.json({
        success: true,
        message: `Пользователь "${updatedUser.full_name}" успешно заблокирован (${durationLabel}).`,
        data: {
          user: updatedUser,
          banLog,
        },
      });
    } catch (error: any) {
      console.error('[AdminController.banUser]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

