// Microsoft Graph naptár-lekérés.
import * as Config from './config.js';
import {getJson} from './http.js';

// A Graph a calendarView dateTime-ját alapból UTC-ben, 'Z' nélkül adja vissza -> pótoljuk.
function parseGraphDate(dt) {
    if (!dt) return null;
    const s = /[Zz]|[+\-]\d\d:?\d\d$/.test(dt) ? dt : `${dt}Z`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

// A következő `daysAhead` napon belüli, még be nem fejeződött meetingek időrendben.
// A már futó meetingek is benne vannak (end >= now), és a korábbi kezdés miatt elöl.
export async function getUpcomingMeetings(token, daysAhead = Config.DAYS_AHEAD) {
    const now = new Date();
    const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const params = {
        startDateTime: now.toISOString(),
        endDateTime: end.toISOString(),
        '$orderby': 'start/dateTime',
        '$select': 'subject,start,end,onlineMeeting,isOnlineMeeting,webLink,location,isAllDay',
        '$top': '100',
    };
    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

    const data = await getJson(`${Config.GRAPH_CALENDAR_VIEW}?${qs}`, token);

    const items = (data.value || []).map(ev => {
        const start = parseGraphDate(ev.start?.dateTime);
        const endD = parseGraphDate(ev.end?.dateTime);
        return {
            subject: ev.subject || '(nincs tárgy)',
            start,
            end: endD,
            isAllDay: !!ev.isAllDay,
            joinUrl: ev.onlineMeeting?.joinUrl || null,
            webLink: ev.webLink || null,
            location: ev.location?.displayName || '',
        };
    }).filter(m => m.start && m.end && m.end.getTime() >= now.getTime());

    items.sort((a, b) => a.start.getTime() - b.start.getTime());
    return items.slice(0, Config.MAX_ITEMS);
}
