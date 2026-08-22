/**
 * Helper to format any date input into DD.MM.YYYY format
 */
export function formatDateDDMMYYYY(dateInput?: string | Date | null): string {
  const now = new Date();

  if (!dateInput || dateInput === 'Сегодня') {
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
  }

  if (dateInput === 'Завтра') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = tomorrow.getFullYear();
    return `${day}.${month}.${year}`;
  }

  if (dateInput instanceof Date) {
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}.${month}.${year}`;
  }

  if (typeof dateInput === 'string') {
    // If already in DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    // If in DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput.replace(/\//g, '.');
    }
    // If in YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, d] = dateInput.split('-');
      return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
    }
    // Attempt Date parse
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}.${month}.${year}`;
    }
  }

  // Fallback to today in DD.MM.YYYY
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}
