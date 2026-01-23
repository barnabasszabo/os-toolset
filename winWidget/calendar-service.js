const https = require('https');
const msalConfig = require('./msal-config');
const authService = require('./auth-service');
const DateUtils = require('./date-utils');
const moment = require('moment-timezone');

// Timezone getter beállítása - a calendar service main process-ben fut
// Ezért IPC-n keresztül kell kérni a timezone-t
let timezoneGetter = null;

// Exportáljuk a setter-t, hogy a main.js beállíthassa
function setTimezoneGetter(getter) {
  timezoneGetter = getter;
  DateUtils.setTimezoneGetter(getter);
}

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
        console.log('No access token available for calendar');
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
      const processedEvents = events.map(event => {
        // A dateTime UTC formátumban van, először UTC-ként értelmezzük
        const startDateUTC = new Date(event.start.dateTime);
        const endDateUTC = new Date(event.end.dateTime);
        
        // Konvertáljuk a beállított timezone-ba
        // moment.utc() jelzi, hogy a dátum UTC, majd .tz() konvertálja a beállított timezone-ba
        const timezone = DateUtils.getTimezone();
        const startMoment = moment.utc(startDateUTC).tz(timezone);
        const endMoment = moment.utc(endDateUTC).tz(timezone);
        
        // Tároljuk a Date objektumokat úgy, hogy azok a beállított timezone szerinti időt reprezentálják
        // A moment.toDate() egy Date objektumot ad vissza, ami a timezone szerinti időt reprezentálja UTC-ként
        // De mivel a moment már a timezone-ban van, a toDate() a helyes UTC timestamp-et adja vissza
        // Fontos: a Date objektum UTC timestamp-et tartalmaz, de a moment objektum a timezone-ban van
        // Amikor ezt a Date objektumot újra beolvassuk moment.tz(date, timezone)-nal, a helyes időt kapjuk
        const startDate = startMoment.toDate();
        const endDate = endMoment.toDate();
        
        console.log(`[CalendarService] Processing event "${event.subject}":`);
        console.log(`  API start (UTC): ${event.start.dateTime}`);
        const timezoneStart = DateUtils.getDateComponents(startDate);
        console.log(`  ${DateUtils.getTimezone()} start: ${timezoneStart.year}-${String(timezoneStart.month + 1).padStart(2, '0')}-${String(timezoneStart.day).padStart(2, '0')} ${String(timezoneStart.hour).padStart(2, '0')}:${String(timezoneStart.minute).padStart(2, '0')}`);
        
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
          duration: Math.round((endDate.getTime() - startDate.getTime()) / 60000), // percben
          attendeesCount: event.attendees ? event.attendees.length : 0,
          attendees: event.attendees ? event.attendees.map(attendee => ({
            name: attendee.emailAddress?.name || 'Ismeretlen',
            email: attendee.emailAddress?.address || ''
          })) : []
        };
      });

      this.events = processedEvents;
      console.log(`[CalendarService] Loaded ${processedEvents.length} events from API`);
      
      // Részletes log minden meetingről
      processedEvents.forEach((event, index) => {
        // Az események már a beállított timezone-ban vannak, csak formázzuk
        const startMoment = DateUtils.toTimezone(event.start);
        const endMoment = DateUtils.toTimezone(event.end);
        console.log(`[CalendarService] Event ${index + 1}:`, {
          subject: event.subject,
          start: startMoment.format('YYYY-MM-DD HH:mm'),
          end: endMoment.format('YYYY-MM-DD HH:mm'),
          duration: `${event.duration} perc`,
          organizer: event.organizer?.name || 'N/A',
          attendeesCount: event.attendeesCount,
          hasTeams: !!event.onlineMeetingUrl
        });
      });
      
      return processedEvents;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  getNextEvent() {
    const now = DateUtils.now();
    // -3 percben lévő meetingeket is megjelenítjük (mert lehet késve megy be)
    const threeMinsAgo = DateUtils.subtractMinutes(now, 3);
    const nowDate = DateUtils.toDate(now);
    const threeMinsAgoDate = DateUtils.toDate(threeMinsAgo);
    // Az események már a beállított timezone-ban vannak tárolva
    const upcoming = this.events.filter(e => {
      return e.start > threeMinsAgoDate && e.end > nowDate;
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
    
    // -3 percben lévő meetingeket is megjelenítjük (mert lehet késve megy be)
    const threeMinsAgo = DateUtils.subtractMinutes(now, 3);
    const nowDate = DateUtils.toDate(now);
    
    const todayStartComp = DateUtils.getDateComponents(todayStart);
    const endDateComp = DateUtils.getDateComponents(endMoment);
    console.log(`[CalendarService] getEventsByDay: Filtering events from ${todayStartComp.year}-${String(todayStartComp.month + 1).padStart(2, '0')}-${String(todayStartComp.day).padStart(2, '0')} to ${endDateComp.year}-${String(endDateComp.month + 1).padStart(2, '0')}-${String(endDateComp.day).padStart(2, '0')}`);
    
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
        
        const isPast = event.end < nowDate;
        const startMoment = DateUtils.toTimezone(event.start);
        const endMoment = DateUtils.toTimezone(event.end);
        console.log(`[CalendarService] Event "${event.subject}" (start: ${startMoment.format('YYYY-MM-DD HH:mm')}, end: ${endMoment.format('YYYY-MM-DD HH:mm')}, isPast: ${isPast}) added to day ${dayKey}`);
      } else {
        const startMoment = DateUtils.toTimezone(event.start);
        const todayStartMoment = DateUtils.toTimezone(todayStartDate);
        const endDateMoment = DateUtils.toTimezone(endDate);
        console.log(`[CalendarService] Event "${event.subject}" filtered out: start=${startMoment.format('YYYY-MM-DD HH:mm')}, todayStart=${todayStartMoment.format('YYYY-MM-DD HH:mm')}, endDate=${endDateMoment.format('YYYY-MM-DD HH:mm')}`);
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
      
      console.log(`[CalendarService] Day ${i + 1} (${dayKey}): ${eventsByDay[dayKey]?.length || 0} events`);
    }
    
    return result;
  }

  startAutoRefresh(callback, intervalMinutes = 1) {
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
