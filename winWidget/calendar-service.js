const https = require('https');
const msalConfig = require('./msal-config');
const authService = require('./auth-service');
const DateUtils = require('./date-utils');

class CalendarService {
  constructor() {
    this.events = [];
    this.refreshInterval = null;
  }

  async getCalendarEvents() {
    try {
      await authService.ensureInitialized();
      const token = await authService.getAccessToken();
      if (!token) {
        return [];
      }

      // Mai nap kezdete és további 3 napnyi események (összesen 4 nap: ma + 3 nap)
      // A beállított timezone-ban számoljuk
      const startMoment = DateUtils.dayStart();
      const endMoment = DateUtils.addDays(startMoment, 3).endOf('day');

      const startDateTime = DateUtils.toISOString(startMoment);
      const endDateTime = DateUtils.toISOString(endMoment);

      const url = new URL(msalConfig.graphEndpoints.calendarView);
      url.searchParams.set('startDateTime', startDateTime);
      url.searchParams.set('endDateTime', endDateTime);
      url.searchParams.set('$orderby', 'start/dateTime');
      url.searchParams.set('$select', 'subject,start,end,organizer,onlineMeeting,webLink,id,attendees');
      // Cache-busting: timestamp hozzáadása, hogy mindig friss adatokat kapjunk
      url.searchParams.set('$top', '1000'); // Max 1000 esemény

      const options = {
        hostname: url.hostname,
        path: url.pathname + '?' + url.searchParams.toString(),
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };

      const events = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const result = JSON.parse(data);
                resolve(result.value || []);
              } catch (e) {
                reject(new Error('Failed to parse calendar response'));
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });
        req.on('error', reject);
        req.end();
      });

      // Feldolgozzuk az eseményeket
      // A Microsoft Graph API UTC időzónában adja vissza a dátumokat
      // Rögtön konvertáljuk a beállított timezone-ba, és úgy tároljuk
      const processedEvents = events.map((event) => {
        const startDate = DateUtils.fromUtcToTimeZone(event.start?.dateTime);
        const endDate = DateUtils.fromUtcToTimeZone(event.end?.dateTime);
        const duration = startDate && endDate
          ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
          : 0;

        return {
          id: event.id,
          subject: event.subject || '(Névtelen esemény)',
          start: startDate, // Beállított timezone-ban tároljuk
          end: endDate, // Beállított timezone-ban tároljuk
          organizer: event.organizer ? {
            name: event.organizer.emailAddress?.name || 'Ismeretlen',
            email: event.organizer.emailAddress?.address || ''
          } : null,
          onlineMeetingUrl: event.onlineMeeting?.joinUrl || null,
          webLink: event.webLink || null,
          duration: duration, // percben
          attendeesCount: event.attendees ? event.attendees.length : 0,
          attendees: event.attendees ? event.attendees.map(attendee => ({
            name: attendee.emailAddress?.name || 'Ismeretlen',
            email: attendee.emailAddress?.address || ''
          })) : []
        };
      });

      this.events = processedEvents;

      const transformedEvents = processedEvents.map((event) => ({
        id: event.id,
        subject: event.subject,
        start: event.start,
        end: event.end
      }));

      console.log('[CalendarService] Transformed events:', transformedEvents);

      return processedEvents;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  getNextEvent() {
    const now = DateUtils.now();
    // -5 percben lévő meetingeket is megjelenítjük (mert lehet késve megy be)
    const fiveMinsAgo = DateUtils.subtractMinutes(now, 5);
    const nowDate = DateUtils.toDate(now);
    const fiveMinsAgoDate = DateUtils.toDate(fiveMinsAgo);
    // Az események már a beállított timezone-ban vannak tárolva
    const upcoming = this.events.filter(e => {
      const isOngoing = DateUtils.isOngoing(e.start, e.end, now);
      return (e.start > fiveMinsAgoDate || isOngoing) && e.end > nowDate;
    });
    if (upcoming.length === 0) return null;
    // Rendezzük kezdési idő szerint és adjuk vissza a legkorábbit
    upcoming.sort((a, b) => a.start - b.start);
    return upcoming[0];
  }

  getEventsByDay() {
    const eventsByDay = {};
    const now = DateUtils.now();
    
    // Mai nap kezdete a beállított timezone-ban
    const todayStart = DateUtils.dayStart();
    // Mai nap + 3 nap vége a beállított timezone-ban - összesen 4 nap: ma + 3 nap
    const endMoment = DateUtils.addDays(todayStart, 3).endOf('day');
    const endDate = DateUtils.toDate(endMoment);
    const todayStartDate = DateUtils.toDate(todayStart);
    
    // -5 percben lévő meetingeket is megjelenítjük (mert lehet késve megy be)
    const fiveMinsAgo = DateUtils.subtractMinutes(now, 5);
    const nowDate = DateUtils.toDate(now);
    
    this.events.forEach(event => {
      // Minden eseményt tartalmazunk, ami a mai + 3 napon belül kezdődik
      // (Az elmúlt meetingeket is tartalmazza, csak a renderer rejti el őket)
      // Csak azt nézzük, hogy a kezdés a 4 napon belül van-e (ma vagy később, de a 3. nap végéig)
      // Az események már a beállított timezone-ban vannak tárolva
      if (event.start < endDate && event.start >= todayStartDate) {
        // Dátum meghatározása a beállított timezone-ban
        const eventDateComp = DateUtils.getDateComponents(event.start);
        
        // Nap kulcs: YYYY-MM-DD formátumban (beállított timezone)
        const year = eventDateComp.year;
        const month = String(eventDateComp.month + 1).padStart(2, '0');
        const day = String(eventDateComp.day).padStart(2, '0');
        const dayKey = `${year}-${month}-${day}`;
        
        if (!eventsByDay[dayKey]) {
          eventsByDay[dayKey] = [];
        }
        eventsByDay[dayKey].push(event);
        
      }
    });

    // Fix 4 nap: ma, holnap, holnapután, holnaputánután
    const result = [];
    for (let i = 0; i < 4; i++) {
      const targetMoment = DateUtils.addDays(todayStart, i);
      const targetDate = DateUtils.toDate(targetMoment);
      
      const targetComp = DateUtils.getDateComponents(targetMoment);
      const year = targetComp.year;
      const month = String(targetComp.month + 1).padStart(2, '0');
      const day = String(targetComp.day).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;
      
      result.push({
        date: targetDate, // UTC Date objektumként
        events: eventsByDay[dayKey] || []
      });
      
    }
    
    return result;
  }

  startAutoRefresh(callback, intervalMinutes = 1) {
    this.stopAutoRefresh();
    // Azonnal frissítés
    this.getCalendarEvents().then(() => {
      if (callback) callback(this.events);
    });

    // Periódikus frissítés
    this.refreshInterval = setInterval(() => {
      this.getCalendarEvents().then(() => {
        if (callback) callback(this.events);
      });
    }, intervalMinutes * 60 * 1000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

module.exports = new CalendarService();
