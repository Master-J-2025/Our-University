export const getUnseenActivities = (activities, seenAt) => {
    const seenTimestamp = Date.parse(seenAt);
    if (!Number.isFinite(seenTimestamp)) return [];

    return activities
        .filter(activity => {
            const createdTimestamp = Date.parse(activity.createdAt);
            return Number.isFinite(createdTimestamp) && createdTimestamp > seenTimestamp;
        })
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
};

export const getNewestActivityTimestamp = activities => {
    const newestActivity = activities.reduce((newest, activity) => {
        const activityTimestamp = Date.parse(activity.createdAt);
        if (!Number.isFinite(activityTimestamp)) return newest;
        if (!newest || activityTimestamp > Date.parse(newest.createdAt)) return activity;
        return newest;
    }, null);

    return newestActivity?.createdAt || null;
};

export const getInitialActivitySeenAt = (activities, fallbackTimestamp = new Date().toISOString()) => {
    const oldestActivity = activities.reduce((oldest, activity) => {
        const activityTimestamp = Date.parse(activity.createdAt);
        if (!Number.isFinite(activityTimestamp)) return oldest;
        if (!oldest || activityTimestamp < Date.parse(oldest.createdAt)) return activity;
        return oldest;
    }, null);

    return oldestActivity
        ? new Date(Date.parse(oldestActivity.createdAt) - 1).toISOString()
        : fallbackTimestamp;
};
