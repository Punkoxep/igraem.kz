/**
 * Utility function to get current date (YYYY-MM-DD) and current time (HH:mm)
 * in the local timezone (Asia/Almaty / UTC+5).
 */
export function getLocalNow(): { dateStr: string; timeStr: string } {
  const timeZone = process.env.TZ || 'Asia/Almaty';
  const now = new Date();

  // YYYY-MM-DD format
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone });

  // HH:mm 24-hour format
  const timeStr = now.toLocaleTimeString('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).slice(0, 5);

  return { dateStr, timeStr };
}

/**
 * Parses YYYY-MM-DD and HH:mm in the local timezone (Asia/Almaty / UTC+5).
 */
export function parseDateInLocalTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+05:00`);
}

