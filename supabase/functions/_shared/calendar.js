const isValidDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
};

export const getTodayInTimezone = (date, timezone) => {
    let safeTimezone = timezone;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: safeTimezone });
    } catch {
        safeTimezone = 'UTC';
    }
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: safeTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

export const getDateOccurrence = (date, today, recurring) => {
    const storedDate = typeof date === 'string' ? date.slice(0, 10) : '';
    if (!isValidDate(storedDate) || !isValidDate(today)) return null;
    if (!recurring) return storedDate;

    const startingYear = Number(today.slice(0, 4));
    for (let year = startingYear; year <= startingYear + 8; year += 1) {
        const targetDate = `${year}-${storedDate.slice(5)}`;
        if (isValidDate(targetDate) && targetDate >= today) return targetDate;
    }
    return null;
};

export const getDaysUntilDate = (from, to) => {
    if (!isValidDate(from) || !isValidDate(to)) return null;
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);
    return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000);
};
