// Állapot
let isExpanded = false;
let isSettingsOpen = false;
let isToggling = false;

// Auth
let authState = {
  isAuthenticated: false,
  account: null,
  userInfo: null,
  profilePhoto: null
};

// DOM
const widgetContainer = document.getElementById('widgetContainer');
const contentViewMain = document.getElementById('contentViewMain');
const contentViewSettings = document.getElementById('contentViewSettings');
const barViewTimeUntil = document.getElementById('barViewTimeUntil');
const barViewSeparator = document.getElementById('barViewSeparator');
const barViewData = document.getElementById('barViewData');
const barViewTitle = document.getElementById('barViewTitle');
const barViewDetails = document.getElementById('barViewDetails');
const barViewTime = document.getElementById('barViewTime');
const barViewDuration = document.getElementById('barViewDuration');
const barViewParticipants = document.getElementById('barViewParticipants');
const barViewSeparator2 = document.getElementById('barViewSeparator2');
const barViewTeams = document.getElementById('barViewTeams');
const btnTeamsBar = document.getElementById('btnTeamsBar');
const btnOutlookWeb = document.getElementById('btnOutlookWeb');
const btnTimeWeb = document.getElementById('btnTimeWeb');
const btnJiraClockwork = document.getElementById('btnJiraClockwork');
const btnBarExpand = document.getElementById('btnBarExpand');
const itemList = document.getElementById('itemList');
const btnRefresh = document.getElementById('btnRefresh');
const btnTogglePast = document.getElementById('btnTogglePast');
const btnLoginMicrosoft = document.getElementById('btnLoginMicrosoft');
const btnQuitHeader = document.getElementById('btnQuitHeader');
const settingsUserWrap = document.getElementById('settingsUserWrap');
const settingsLoginWrap = document.getElementById('settingsLoginWrap');
const settingsAuthLoading = document.getElementById('settingsAuthLoading');
const settingsUserPhoto = document.getElementById('settingsUserPhoto');
const settingsUserMonogram = document.getElementById('settingsUserMonogram');
const settingsUserName = document.getElementById('settingsUserName');
const settingsUserEmail = document.getElementById('settingsUserEmail');
const btnLogout = document.getElementById('btnLogout');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnQuitApp = document.getElementById('btnQuitApp');
const settingsThemeWrap = document.getElementById('settingsThemeWrap');
const themeDark = document.getElementById('themeDark');
const themeLight = document.getElementById('themeLight');
const settingsColorWrap = document.getElementById('settingsColorWrap');
const settingsMeetingWrap = document.getElementById('settingsMeetingWrap');
const settingsRefreshWrap = document.getElementById('settingsRefreshWrap');
const settingsColorEnabled = document.getElementById('settingsColorEnabled');
const colorGreenFrom = document.getElementById('colorGreenFrom');
const colorGreenTo = document.getElementById('colorGreenTo');
const colorYellowFrom = document.getElementById('colorYellowFrom');
const colorYellowTo = document.getElementById('colorYellowTo');
const colorRedFrom = document.getElementById('colorRedFrom');
const colorRedTo = document.getElementById('colorRedTo');
const meetingGraceMinutesInput = document.getElementById('meetingGraceMinutes');
const calendarRefreshMinutesInput = document.getElementById('calendarRefreshMinutes');
const calendarRefreshLast = document.getElementById('calendarRefreshLast');
const refreshLastMain = document.getElementById('refreshLastMain');

// Calendar
let calendarEvents = [];
let organizerPhotos = {};

// Színezési beállítások
let colorSettings = {
  enabled: true,
  green: { from: 30, to: 1440 }, // 30 perc - 24 óra
  yellow: { from: 10, to: 30 },  // 10 perc - 30 perc
  red: { from: -5, to: 10 }       // -5 perc - 10 perc
};

// Meeting megjelenítési beállítások
let meetingDisplaySettings = {
  graceMinutes: 5
};

let calendarRefreshSettings = {
  intervalMinutes: 5
};

let lastCalendarRefreshAt = null;

// Téma beállítások
let themeSettings = {
  theme: 'dark' // 'dark' vagy 'light'
};

// Betöltjük a localStorage-ból a téma beállításokat
function loadThemeSettings() {
  try {
    const saved = localStorage.getItem('themeSettings');
    if (saved) {
      themeSettings = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading theme settings:', e);
  }
}

// Elmentjük a localStorage-ba a téma beállításokat
function saveThemeSettings() {
  try {
    localStorage.setItem('themeSettings', JSON.stringify(themeSettings));
  } catch (e) {
    console.error('Error saving theme settings:', e);
  }
}

// Alkalmazzuk a témát
function applyTheme(theme) {
  const body = document.body;
  const widgetContainer = document.getElementById('widgetContainer');
  
  // Eltávolítjuk az összes téma osztályt
  body.classList.remove('theme-light', 'theme-dark');
  if (widgetContainer) {
    widgetContainer.classList.remove('theme-light', 'theme-dark');
  }
  
  // Hozzáadjuk az új témát
  body.classList.add(`theme-${theme}`);
  if (widgetContainer) {
    widgetContainer.classList.add(`theme-${theme}`);
  }
  
  themeSettings.theme = theme;
  saveThemeSettings();
}

// Alkalmazzuk a betöltött témát az indításkor
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(themeSettings.theme);
  });
} else {
  applyTheme(themeSettings.theme);
}

// Betöltjük az indításkor
loadThemeSettings();

// Betöltjük a localStorage-ból a színezési beállításokat
function loadColorSettings() {
  try {
    const saved = localStorage.getItem('colorSettings');
    if (saved) {
      const loaded = JSON.parse(saved);
      // Összevonjuk az alapértelmezett értékekkel (ha hiányzik valami)
      colorSettings = {
        enabled: loaded.enabled !== undefined ? loaded.enabled : true,
        green: loaded.green || { from: 30, to: 1440 },
        yellow: loaded.yellow || { from: 10, to: 30 },
        red: loaded.red || { from: -5, to: 10 }
      };
    }
  } catch (e) {
    console.error('Error loading color settings:', e);
  }
}

// Betöltjük a localStorage-ból a meeting beállításokat
function loadMeetingDisplaySettings() {
  try {
    const saved = localStorage.getItem('meetingDisplaySettings');
    if (saved) {
      const loaded = JSON.parse(saved);
      const minutes = Number.isFinite(loaded.graceMinutes) ? Math.max(0, loaded.graceMinutes) : 5;
      meetingDisplaySettings = {
        graceMinutes: minutes
      };
    }
  } catch (e) {
    console.error('Error loading meeting display settings:', e);
  }
}

function loadCalendarRefreshSettings() {
  try {
    const saved = localStorage.getItem('calendarRefreshSettings');
    if (saved) {
      const loaded = JSON.parse(saved);
      const minutes = Number.isFinite(loaded.intervalMinutes) ? Math.max(1, loaded.intervalMinutes) : 5;
      calendarRefreshSettings = { intervalMinutes: minutes };
    }
  } catch (e) {
    console.error('Error loading calendar refresh settings:', e);
  }
}

// Elmentjük a localStorage-ba a meeting beállításokat
function saveMeetingDisplaySettings() {
  try {
    localStorage.setItem('meetingDisplaySettings', JSON.stringify(meetingDisplaySettings));
  } catch (e) {
    console.error('Error saving meeting display settings:', e);
  }
}

function saveCalendarRefreshSettings() {
  try {
    localStorage.setItem('calendarRefreshSettings', JSON.stringify(calendarRefreshSettings));
  } catch (e) {
    console.error('Error saving calendar refresh settings:', e);
  }
}

// Elmentjük a localStorage-ba a színezési beállításokat
function saveColorSettings() {
  try {
    localStorage.setItem('colorSettings', JSON.stringify(colorSettings));
  } catch (e) {
    console.error('Error saving color settings:', e);
  }
}

// Betöltjük az indításkor
loadColorSettings();
loadMeetingDisplaySettings();
loadCalendarRefreshSettings();

function applyCalendarRefreshInterval() {
  if (window.calendar && window.calendar.setRefreshInterval) {
    window.calendar.setRefreshInterval(calendarRefreshSettings.intervalMinutes);
  }
}

applyCalendarRefreshInterval();

function updateCalendarRefreshLastDisplay() {
  const timeLabel = 'Utolsó sikeres frissítés: ';
  const emptyText = timeLabel + '–';
  if (!lastCalendarRefreshAt) {
    if (calendarRefreshLast) calendarRefreshLast.textContent = emptyText;
    if (refreshLastMain) refreshLastMain.textContent = emptyText;
    return;
  }
  const timeText = DateUtils.formatTime(lastCalendarRefreshAt);
  const fullText = timeLabel + timeText;
  if (calendarRefreshLast) calendarRefreshLast.textContent = fullText;
  if (refreshLastMain) refreshLastMain.textContent = fullText;
}

// Dátum kezelés központi modul használata (DateUtils betöltve a HTML-ből)

function getTimeUntilColor(diffMins) {
  if (!colorSettings.enabled) {
    return null;
  }
  
  // Piros: elsőként ellenőrizzük (legkisebb tartomány)
  if (diffMins >= colorSettings.red.from && diffMins < colorSettings.red.to) {
    return 'red';
  }
  
  // Sárga
  if (diffMins >= colorSettings.yellow.from && diffMins < colorSettings.yellow.to) {
    return 'yellow';
  }
  
  // Zöld
  if (diffMins >= colorSettings.green.from && diffMins < colorSettings.green.to) {
    return 'green';
  }
  
  return null;
}

// Közös függvény a hátralévő idő elem létrehozásához
function createTimeUntilElement(startDate, className = 'meeting-time-until') {
  const diffMins = DateUtils.diffMinutes(startDate);
  const timeUntil = DateUtils.formatTimeUntil(startDate, meetingDisplaySettings.graceMinutes);
  
  if (timeUntil === null) {
    return null;
  }
  
  const timeUntilEl = document.createElement('span');
  timeUntilEl.className = className;
  timeUntilEl.textContent = timeUntil;
  
  // Színezés
  const color = getTimeUntilColor(diffMins);
  if (color) {
    timeUntilEl.classList.add(`time-until-${color}`);
  }
  
  return timeUntilEl;
}

function createOngoingBadge(startDate) {
  const badge = document.createElement('span');
  badge.className = 'meeting-status meeting-status-ongoing';
  const elapsed = DateUtils.formatElapsedSince(startDate);
  if (!elapsed) {
    badge.textContent = 'Folyamatban';
    return badge;
  }

  const label = document.createElement('span');
  label.textContent = 'Folyamatban ';
  const value = document.createElement('strong');
  value.textContent = elapsed;
  badge.appendChild(label);
  badge.appendChild(value);
  return badge;
}

function updateBarViewAlertState(timeUntilEl) {
  barViewData.classList.remove('barView-alert-red', 'barView-alert-yellow');
  if (!timeUntilEl) return;
  if (timeUntilEl.classList.contains('time-until-red')) {
    barViewData.classList.add('barView-alert-red');
    return;
  }
  if (timeUntilEl.classList.contains('time-until-yellow')) {
    barViewData.classList.add('barView-alert-yellow');
  }
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

async function handleOpenOutlookCalendar() {
  if (window.outlook && window.outlook.openCalendar) {
    await window.outlook.openCalendar();
  }
}

async function handleOpenTimeWeb() {
  if (window.timeWeb && window.timeWeb.open) {
    await window.timeWeb.open();
  }
}

async function handleOpenJiraClockwork() {
  if (window.jiraClockwork && window.jiraClockwork.open) {
    await window.jiraClockwork.open();
  }
}

async function handleToggleBarExpand() {
  if (window.widget && window.widget.toggleBarExpand) {
    const isExpanded = await window.widget.toggleBarExpand();
    widgetContainer.classList.toggle('barView-expanded', isExpanded);
    btnBarExpand.textContent = isExpanded ? '<<' : '>>';
  }
}

async function loadUserPhoto(email) {
  if (!email || organizerPhotos[email]) return organizerPhotos[email];
  try {
    const photo = await window.calendar.getUserPhoto(email);
    organizerPhotos[email] = photo;
    return photo;
  } catch (e) {
    console.error('Error loading user photo:', e);
    return null;
  }
}

function renderUserAvatar(user, photo, className = 'meeting-user-avatar') {
  const avatar = document.createElement(photo ? 'img' : 'div');
  avatar.className = className;
  if (photo) {
    avatar.src = photo;
    avatar.alt = user.name;
  } else {
    avatar.className += ' monogram';
    avatar.textContent = getInitials(user.name);
  }
  avatar.title = user.name;
  return avatar;
}

async function renderMeetingItem(event, organizerPhoto, attendeePhotos, isToday = false, isPast = false, isOngoing = false) {
  const li = document.createElement('li');
  li.className = 'list-group-item';
  
  // Ha elmúlt meeting (véget ért), rejtsük el alapból
  if (isPast) {
    li.classList.add('meeting-past');
    li.style.display = 'none'; // Alapból rejtve
  }

  if (isOngoing) {
    li.classList.add('meeting-ongoing');
  }
  
  // Meeting címe
  const subject = document.createElement('div');
  subject.className = 'meeting-subject';
  subject.textContent = event.subject;
  if (event.subject.length > 50) {
    subject.title = event.subject;
  }
  li.appendChild(subject);
  
  // Meeting részletek - egy sorban: hátralévő percek | meeting info | teams gomb
  const details = document.createElement('div');
  details.className = 'meeting-details';

  if (isOngoing) {
    const ongoingBadge = createOngoingBadge(event.start);
    details.appendChild(ongoingBadge);
    const sepOngoing = document.createTextNode(' | ');
    details.appendChild(sepOngoing);
  }
  
  // Hány perc múlva kezdődik - ha kevesebb mint 12 óra van hátra, mutassuk meg
  const diffMins = DateUtils.diffMinutes(event.start);
  if (diffMins >= -meetingDisplaySettings.graceMinutes && diffMins < 720) { // -graceMinutes perc és 12 óra (720 perc) között
    const timeUntilEl = createTimeUntilElement(event.start, 'meeting-time-until');
    if (timeUntilEl) {
      details.appendChild(timeUntilEl);
      
      const sep0 = document.createTextNode(' | ');
      details.appendChild(sep0);
    }
  }
  
  // Időpont
  const time = document.createElement('span');
  time.className = 'meeting-time';
  time.textContent = DateUtils.formatTime(event.start);
  details.appendChild(time);
  
  // Elválasztó
  const sep1 = document.createTextNode(' | ');
  details.appendChild(sep1);
  
  // Hossz
  const duration = document.createElement('span');
  duration.className = 'meeting-duration';
  duration.textContent = DateUtils.formatDuration(event.duration);
  details.appendChild(duration);
  
  // Elválasztó
  const sep2 = document.createTextNode(' | ');
  details.appendChild(sep2);
  
  // Szervező és résztvevők ikonok
  const participants = document.createElement('div');
  participants.className = 'meeting-participants';
  
  // Szervező ikon
  if (event.organizer) {
    const organizerAvatar = renderUserAvatar(event.organizer, organizerPhoto);
    participants.appendChild(organizerAvatar);
  }
  
  // Elválasztó, ha van szervező és résztvevők is
  if (event.organizer && event.attendees && event.attendees.length > 0) {
    const sep3 = document.createTextNode(' | ');
    participants.appendChild(sep3);
  }
  
  // Első 3 résztvevő ikonok + számláló
  if (event.attendees && event.attendees.length > 0) {
    const first3Attendees = event.attendees.slice(0, 3);
    for (const attendee of first3Attendees) {
      const attendeePhoto = attendeePhotos && attendeePhotos[attendee.email] ? attendeePhotos[attendee.email] : null;
      const attendeeAvatar = renderUserAvatar(attendee, attendeePhoto);
      participants.appendChild(attendeeAvatar);
    }
    
    // Ha több mint 3 résztvevő van, mutassuk a "+x" szöveget
    if (event.attendees.length > 3) {
      const moreCount = document.createElement('span');
      moreCount.className = 'meeting-more-count';
      moreCount.textContent = `+${event.attendees.length - 3}`;
      moreCount.title = `${event.attendees.length - 3} további résztvevő`;
      participants.appendChild(moreCount);
    }
  }
  
  details.appendChild(participants);
  
  // Teams gomb
  if (event.onlineMeetingUrl) {
    const sep3 = document.createElement('span');
    sep3.className = 'meeting-separator';
    sep3.textContent = '|';
    details.appendChild(sep3);
    
    const teamsBtn = document.createElement('button');
    teamsBtn.className = 'btn-teams-join';
    teamsBtn.textContent = 'Teams';
    teamsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(event.onlineMeetingUrl, '_blank');
    });
    details.appendChild(teamsBtn);
  }
  
  li.appendChild(details);
  
  return li;
}

let isRendering = false; // Flag a renderelés megakadályozására

async function renderCalendarList() {
  // Megakadályozzuk a párhuzamos renderelést
  if (isRendering) {
    return;
  }
  
  isRendering = true;
  
  try {
    // Frissítés gomb láthatósága
    if (btnRefresh) {
      btnRefresh.style.display = authState.isAuthenticated ? 'flex' : 'none';
    }
    
    if (!authState.isAuthenticated) {
      // Ne mutassunk semmit, mert a settings view fog megjelenni
      itemList.innerHTML = '';
      return;
    }
    
    const eventsByDay = await window.calendar.getEventsByDay();
    
    // Töröljük a teljes listát először
    itemList.innerHTML = '';
    
    // Mindig 4 napot mutatunk: ma, holnap, holnapután, holnaputánután
    // A getEventsByDay() már visszaadja ezt a 4 napot fix sorrendben
    
    // Felhasználó email-je a rendezéshez
    const userEmail = authState.userInfo?.userPrincipalName || authState.account?.username || '';
    
    for (let dayIndex = 0; dayIndex < eventsByDay.length; dayIndex++) {
      const dayData = eventsByDay[dayIndex];
      // A dátumok már a beállított timezone-ban vannak, csak formázzuk
      const dayMoment = DateUtils.toTimezone(dayData.date);
      // Nap header
      const daySection = document.createElement('div');
      daySection.className = 'calendar-day-section';
      
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      // Csak dátum, kivéve ma, ahol "Ma" + dátum
      dayHeader.textContent = DateUtils.formatDate(dayData.date, dayIndex);
      daySection.appendChild(dayHeader);
      
      const dayList = document.createElement('ul');
      dayList.className = 'list-group';
      
      // Rendezzük a nap eseményeit hátralévő idő szerint (növekvő sorrendben)
      // Az események már a beállított timezone-ban vannak tárolva
      const sortedEvents = [...dayData.events].sort((a, b) => {
        // Elsődleges: hátralévő percek szerint növekvő sorrendben
        const aDiffMins = DateUtils.diffMinutes(a.start);
        const bDiffMins = DateUtils.diffMinutes(b.start);
        if (aDiffMins !== bDiffMins) {
          return aDiffMins - bDiffMins;
        }
        
        // Másodlagos (azonos percnél): amit ő írt ki (organizer)
        const aIsOrganizer = a.organizer?.email?.toLowerCase() === userEmail.toLowerCase();
        const bIsOrganizer = b.organizer?.email?.toLowerCase() === userEmail.toLowerCase();
        if (aIsOrganizer && !bIsOrganizer) return -1;
        if (!aIsOrganizer && bIsOrganizer) return 1;
        
        // Harmadlagos: résztvevők száma szerint (több résztvevő előre)
        const aAttendeeCount = a.attendees ? a.attendees.length : 0;
        const bAttendeeCount = b.attendees ? b.attendees.length : 0;
        if (aAttendeeCount !== bAttendeeCount) {
          return bAttendeeCount - aAttendeeCount;
        }
        
        // Negyedleges: kezdési idő szerint (stabil rendezés)
        return a.start - b.start;
      });
      
      // Meetingek betöltése szervező és résztvevő képekkel
      // Dátum összehasonlítás a beállított timezone szerint
      const isToday = DateUtils.isSameDay(dayData.date);
      
      let renderedCount = 0;
      for (const event of sortedEvents) {
        // Az események már a beállított timezone-ban vannak tárolva
        // Ellenőrizzük, hogy elmúlt-e a meeting (véget ért-e)
        const isOngoing = DateUtils.isOngoing(event.start, event.end);
        const isPast = DateUtils.isEnded(event.end);
        
        // Szervező kép
        const organizerEmail = event.organizer?.email;
        const organizerPhoto = organizerEmail ? await loadUserPhoto(organizerEmail) : null;
        
        // Résztvevők képei (első 3)
        const attendeePhotos = {};
        if (event.attendees && event.attendees.length > 0) {
          const first3Attendees = event.attendees.slice(0, 3);
          for (const attendee of first3Attendees) {
            if (attendee.email) {
              const photo = await loadUserPhoto(attendee.email);
              if (photo) {
                attendeePhotos[attendee.email] = photo;
              }
            }
          }
        }
        
        const meetingItem = await renderMeetingItem(event, organizerPhoto, attendeePhotos, isToday, isPast, isOngoing);
        if (meetingItem) {
          dayList.appendChild(meetingItem);
          renderedCount++;
        } else {
          console.error(`[Renderer] ERROR: renderMeetingItem returned null for "${event.subject}"`);
        }
      }
      
      daySection.appendChild(dayList);
      itemList.appendChild(daySection);
    }
  } catch (e) {
    console.error('[Renderer] Error rendering calendar:', e);
    itemList.innerHTML = '<li class="list-group-item" style="text-align: center; color: #dc3545;">Hiba a naptár betöltésekor</li>';
  } finally {
    isRendering = false;
  }
}

async function updateBarViewWithNextMeeting() {
  // Rejtjük el a Teams gombot és időszámlálót alapból
  barViewTeams.classList.remove('show');
  barViewSeparator2.classList.remove('show');
  barViewTimeUntil.classList.remove('show');
  barViewSeparator.classList.remove('show');
  btnTeamsBar.onclick = null;
  updateBarViewAlertState(null);
  
  // Töröljük a részleteket
  barViewTime.textContent = '';
  barViewDuration.textContent = '';
  barViewParticipants.innerHTML = '';
  
  if (!authState.isAuthenticated) {
    barViewTitle.textContent = 'Bejelentkezés szükséges';
    barViewTime.textContent = 'Kattintás: bejelentkezés';
    return;
  }
  
  const now = DateUtils.now();
  // -graceMinutes percben lévő meetingeket is megjelenítjük (mert lehet késve megy be)
  const nowDate = DateUtils.toDate(now);
  // Az események már a beállított timezone-ban vannak tárolva
  const upcoming = calendarEvents.filter(e => {
    const diffMins = DateUtils.diffMinutes(e.start, now);
    return diffMins >= -meetingDisplaySettings.graceMinutes && e.end > nowDate;
  });
  if (upcoming.length === 0) {
    barViewTitle.textContent = 'Következő';
    barViewTime.textContent = 'Nincs közelgő esemény';
    return;
  }
  
  // Rendezzük hátralévő idő szerint (növekvő sorrendben)
  const userEmail = authState.userInfo?.userPrincipalName || authState.account?.username || '';
  
  upcoming.sort((a, b) => {
    // Elsődleges: hátralévő percek szerint növekvő sorrendben
    const aDiffMins = DateUtils.diffMinutes(a.start);
    const bDiffMins = DateUtils.diffMinutes(b.start);
    if (aDiffMins !== bDiffMins) {
      return aDiffMins - bDiffMins;
    }
    
    // Másodlagos (azonos percnél): amit ő írt ki (organizer)
    const aIsOrganizer = a.organizer?.email?.toLowerCase() === userEmail.toLowerCase();
    const bIsOrganizer = b.organizer?.email?.toLowerCase() === userEmail.toLowerCase();
    if (aIsOrganizer && !bIsOrganizer) return -1;
    if (!aIsOrganizer && bIsOrganizer) return 1;

    // Harmadlagos: résztvevők száma szerint (több résztvevő előre)
    const aAttendeeCount = a.attendees ? a.attendees.length : 0;
    const bAttendeeCount = b.attendees ? b.attendees.length : 0;
    if (aAttendeeCount !== bAttendeeCount) {
      return bAttendeeCount - aAttendeeCount;
    }
    
    // Negyedleges: kezdési idő szerint (stabil rendezés)
    return a.start - b.start;
  });
  
  // A legelső meeting (legkorábbi, -graceMinutes-től indulva)
  const nextEvent = upcoming[0];
  
  // Keresünk azonos időpontú meetingeket
  const nextEventStartTime = nextEvent.start.getTime();
  const sameTimeEvents = upcoming.filter(e => e.start.getTime() === nextEventStartTime);
  
  // Meeting címe
  barViewTitle.textContent = nextEvent.subject.length > 35 ? nextEvent.subject.substring(0, 32) + '...' : nextEvent.subject;
  
  // Hány perc múlva kezdődik - közös komponens használata
  const timeUntilEl = createTimeUntilElement(nextEvent.start, 'barView-time-until');
  if (timeUntilEl) {
    // Töröljük a régi tartalmat és osztályokat
    barViewTimeUntil.textContent = '';
    barViewTimeUntil.className = 'barView-time-until';
    barViewTimeUntil.classList.remove('time-until-green', 'time-until-yellow', 'time-until-red');
    
    // Másoljuk az új elem tartalmát és osztályait
    barViewTimeUntil.textContent = timeUntilEl.textContent;
    barViewTimeUntil.className = timeUntilEl.className;
    barViewTimeUntil.classList.add('show');
    barViewSeparator.classList.add('show');
  }
  updateBarViewAlertState(timeUntilEl);
  
  // Időpont és hossz
  barViewTime.textContent = DateUtils.formatTime(nextEvent.start);
  barViewDuration.textContent = DateUtils.formatDuration(nextEvent.duration);
  
  // Szervező és résztvevők ikonok (ugyanúgy mint a contentView-ban)
  // Szervező ikon
  if (nextEvent.organizer) {
    const organizerEmail = nextEvent.organizer.email;
    const organizerPhoto = organizerEmail ? await loadUserPhoto(organizerEmail) : null;
    const organizerAvatar = document.createElement(organizerPhoto ? 'img' : 'div');
    organizerAvatar.className = 'barView-user-avatar';
    if (organizerPhoto) {
      organizerAvatar.src = organizerPhoto;
      organizerAvatar.alt = nextEvent.organizer.name;
    } else {
      organizerAvatar.className += ' monogram';
      organizerAvatar.textContent = getInitials(nextEvent.organizer.name);
    }
    organizerAvatar.title = nextEvent.organizer.name;
    barViewParticipants.appendChild(organizerAvatar);
  }
  
  // Elválasztó, ha van szervező és résztvevők is
  if (nextEvent.organizer && nextEvent.attendees && nextEvent.attendees.length > 0) {
    const sep = document.createTextNode(' | ');
    barViewParticipants.appendChild(sep);
  }
  
  // Első 3 résztvevő ikonok + számláló
  if (nextEvent.attendees && nextEvent.attendees.length > 0) {
    const first3Attendees = nextEvent.attendees.slice(0, 3);
    for (const attendee of first3Attendees) {
      const attendeeEmail = attendee.email;
      const attendeePhoto = attendeeEmail ? await loadUserPhoto(attendeeEmail) : null;
      const attendeeAvatar = document.createElement(attendeePhoto ? 'img' : 'div');
      attendeeAvatar.className = 'barView-user-avatar';
      if (attendeePhoto) {
        attendeeAvatar.src = attendeePhoto;
        attendeeAvatar.alt = attendee.name;
      } else {
        attendeeAvatar.className += ' monogram';
        attendeeAvatar.textContent = getInitials(attendee.name);
      }
      attendeeAvatar.title = attendee.name;
      barViewParticipants.appendChild(attendeeAvatar);
    }
    
    // Ha több mint 3 résztvevő van, mutassuk a "+x" szöveget
    if (nextEvent.attendees.length > 3) {
      const moreCount = document.createElement('span');
      moreCount.className = 'barView-more-count';
      moreCount.textContent = `+${nextEvent.attendees.length - 3}`;
      moreCount.title = `${nextEvent.attendees.length - 3} további résztvevő`;
      barViewParticipants.appendChild(moreCount);
    }
  }
  
  // Ha több meeting van ugyanabban az időpontban, mutassuk a "+x meeting" szöveget
  if (sameTimeEvents.length > 1) {
    const additionalCount = sameTimeEvents.length - 1;
    const moreMeetings = document.createElement('span');
    moreMeetings.className = 'barView-more-count';
    moreMeetings.textContent = ` | +${additionalCount} meeting`;
    moreMeetings.title = `${additionalCount} további meeting ugyanabban az időpontban`;
    barViewParticipants.appendChild(moreMeetings);
  }
  
  // Ha van Teams meeting URL, mutassuk a gombot és elválasztót
  if (nextEvent && nextEvent.onlineMeetingUrl) {
    barViewSeparator2.classList.add('show');
    barViewTeams.classList.add('show');
    btnTeamsBar.onclick = (e) => {
      e.stopPropagation();
      window.open(nextEvent.onlineMeetingUrl, '_blank');
    };
  }
}

async function refreshCalendar(showLoading = false) {
  if (showLoading && btnRefresh) {
    btnRefresh.classList.add('refreshing');
    btnRefresh.disabled = true;
  }

  if (!authState.isAuthenticated) {
    calendarEvents = [];
    await updateBarViewWithNextMeeting();
    if (isExpanded && !isSettingsOpen) {
      await renderCalendarList();
    }
    lastCalendarRefreshAt = null;
    updateCalendarRefreshLastDisplay();
    if (showLoading && btnRefresh) {
      btnRefresh.classList.remove('refreshing');
      btnRefresh.disabled = false;
    }
    return;
  }

  try {
    // Frissítjük a naptár adatokat az API-ból (mindig friss adatokat kérünk)
    calendarEvents = await window.calendar.getEvents();
    // Mind a lista, mind a kiemelt terület frissül minden frissítéskor
    await updateBarViewWithNextMeeting();
    if (isExpanded && !isSettingsOpen) {
      await renderCalendarList();
    }
    // Csak sikeres teljes frissítés után írjuk ki az utolsó frissítés idejét
    lastCalendarRefreshAt = DateUtils.now();
    updateCalendarRefreshLastDisplay();
  } catch (e) {
    console.error('Error refreshing calendar:', e);
  } finally {
    if (showLoading && btnRefresh) {
      btnRefresh.classList.remove('refreshing');
      btnRefresh.disabled = false;
    }
  }
}

async function toggleWidget() {
  if (isToggling) return;
  isToggling = true;
  try {
    isExpanded = await window.widget.toggle();
    if (!isExpanded && isSettingsOpen) {
      isSettingsOpen = await window.widget.toggleSettings();
    }
    updateUI();
  } finally {
    setTimeout(() => { isToggling = false; }, 300);
  }
}

async function toggleSettings() {
  isSettingsOpen = await window.widget.toggleSettings();
  updateUI();
}

async function updateUI() {
  widgetContainer.classList.toggle('expanded', isExpanded);

  if (isExpanded) {
    if (isSettingsOpen) {
      contentViewMain.classList.add('hide');
      contentViewSettings.classList.add('show');
      updateSettingsAuthUI();
    } else {
      // Ha nincs bejelentkezve, mutassuk a bejelentkezési felületet
      if (!authState.isAuthenticated) {
        contentViewMain.classList.add('hide');
        contentViewSettings.classList.add('show');
        updateSettingsAuthUI();
      } else {
        contentViewMain.classList.remove('hide');
        contentViewSettings.classList.remove('show');
        await renderCalendarList();
      }
    }
  } else {
    contentViewMain.classList.remove('hide');
    contentViewSettings.classList.remove('show');
  }

  await updateBarViewTitle();
}

async function updateBarViewTitle() {
  // A barView mostantól a következő meetinget mutatja
  await updateBarViewWithNextMeeting();
}

function updateSettingsAuthUI() {
  settingsLoginWrap.style.display = 'none';
  settingsUserWrap.style.display = 'none';
  settingsThemeWrap.style.display = 'none';
  settingsColorWrap.style.display = 'none';
  settingsMeetingWrap.style.display = 'none';
  settingsRefreshWrap.style.display = 'none';
  settingsAuthLoading.style.display = 'none';
  
  if (authState.isAuthenticated) {
    settingsUserWrap.style.display = 'flex';
    settingsThemeWrap.style.display = 'block';
    settingsColorWrap.style.display = 'block';
    settingsMeetingWrap.style.display = 'block';
    settingsRefreshWrap.style.display = 'block';
    
    // Téma beállítás betöltése
    if (themeSettings.theme === 'light') {
      themeLight.checked = true;
    } else {
      themeDark.checked = true;
    }
    
    // Színezési beállítás betöltése
    settingsColorEnabled.checked = colorSettings.enabled;
    colorGreenFrom.value = colorSettings.green.from;
    colorGreenTo.value = colorSettings.green.to;
    colorYellowFrom.value = colorSettings.yellow.from;
    colorYellowTo.value = colorSettings.yellow.to;
    colorRedFrom.value = colorSettings.red.from;
    colorRedTo.value = colorSettings.red.to;
    meetingGraceMinutesInput.value = meetingDisplaySettings.graceMinutes;
    calendarRefreshMinutesInput.value = calendarRefreshSettings.intervalMinutes;
    updateCalendarRefreshLastDisplay();
    
    settingsUserName.textContent = authState.userInfo?.displayName || authState.userInfo?.userPrincipalName || '–';
    settingsUserEmail.textContent = authState.userInfo?.userPrincipalName || authState.account?.username || '–';
    if (authState.profilePhoto) {
      settingsUserPhoto.src = authState.profilePhoto;
      settingsUserPhoto.style.display = 'block';
      settingsUserMonogram.style.display = 'none';
    } else {
      settingsUserPhoto.style.display = 'none';
      settingsUserMonogram.style.display = 'flex';
      const name = authState.userInfo?.displayName || authState.userInfo?.userPrincipalName || '?';
      settingsUserMonogram.textContent = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    }
  } else {
    settingsLoginWrap.style.display = 'flex';
  }
}

async function updateAuthState() {
  try {
    const wasAuthenticated = authState.isAuthenticated;
    const state = await window.auth.getState();
    authState.isAuthenticated = state.isAuthenticated;
    authState.account = state.account;
    authState.userInfo = state.userInfo || null;
    authState.profilePhoto = null;
    if (state.isAuthenticated) {
      authState.profilePhoto = await window.auth.getProfilePhoto();
      // Frissítsük a naptárt bejelentkezés után
      await refreshCalendar();
      // Ha most jelentkezett be és a settings view van nyitva, zárjuk be és mutassuk a meetingeket
      if (!wasAuthenticated && isExpanded && isSettingsOpen) {
        await toggleSettings();
      }
    } else {
      calendarEvents = [];
      await updateBarViewWithNextMeeting();
      // Ha kijelentkezett és a contentView nyitva van, mutassuk a bejelentkezést
      if (wasAuthenticated && isExpanded && !isSettingsOpen) {
        await toggleSettings();
      }
    }
    await updateBarViewTitle();
    await updateUI();
  } catch (e) {
    console.error('updateAuthState', e);
  }
}

async function handleLogin() {
  settingsLoginWrap.style.display = 'none';
  settingsAuthLoading.style.display = 'block';
  settingsUserWrap.style.display = 'none';
  try {
    const result = await window.auth.login();
    if (result.success) {
      await updateAuthState();
    } else {
      alert('Bejelentkezés sikertelen: ' + (result.error || 'Ismeretlen hiba'));
      settingsLoginWrap.style.display = 'flex';
    }
  } catch (e) {
    console.error('Login', e);
    alert('Bejelentkezési hiba: ' + e.message);
    settingsLoginWrap.style.display = 'flex';
  } finally {
    settingsAuthLoading.style.display = 'none';
  }
}

async function handleLogout() {
  settingsUserWrap.style.display = 'none';
  settingsAuthLoading.style.display = 'block';
  try {
    await window.auth.logout();
    await updateAuthState();
  } catch (e) {
    console.error('Logout', e);
  } finally {
    settingsAuthLoading.style.display = 'none';
    if (isExpanded && isSettingsOpen) updateSettingsAuthUI();
  }
}

// Eseménykezelők: barView kattintás = contentView toggle (a barView tartalma változatlan marad)
barViewData.addEventListener('click', (e) => {
  e.preventDefault();
  // Ha nincs bejelentkezve és nincs nyitva, akkor nyissuk meg és mutassuk a bejelentkezést
  if (!authState.isAuthenticated && !isExpanded) {
    toggleWidget().then(() => {
      // Ha még nincs bejelentkezve, akkor a settings view fog megjelenni (bejelentkezés)
      if (!authState.isAuthenticated && !isSettingsOpen) {
        toggleSettings();
      }
    });
  } else {
    toggleWidget();
  }
});


btnSettingsHeader.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettings();
});

btnLoginMicrosoft.addEventListener('click', (e) => {
  e.stopPropagation();
  handleLogin();
});

btnLogout.addEventListener('click', (e) => {
  e.stopPropagation();
  handleLogout();
});

btnCloseSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettings();
});

btnRefresh.addEventListener('click', async (e) => {
  e.stopPropagation();
  await refreshCalendar(true);
});

btnOutlookWeb.addEventListener('click', async (e) => {
  e.stopPropagation();
  await handleOpenOutlookCalendar();
});

btnTimeWeb.addEventListener('click', async (e) => {
  e.stopPropagation();
  await handleOpenTimeWeb();
});

btnJiraClockwork.addEventListener('click', async (e) => {
  e.stopPropagation();
  await handleOpenJiraClockwork();
});

btnBarExpand.addEventListener('click', async (e) => {
  e.stopPropagation();
  await handleToggleBarExpand();
});

// Toggle past meetings
let showPastMeetings = false;

btnTogglePast.addEventListener('click', (e) => {
  e.stopPropagation();
  showPastMeetings = !showPastMeetings;
  btnTogglePast.classList.toggle('active', showPastMeetings);
  
  // Mutassuk/elrejtsük az elmúlt meetingeket
  const pastMeetings = document.querySelectorAll('.meeting-past');
  pastMeetings.forEach(meeting => {
    meeting.style.display = showPastMeetings ? 'flex' : 'none';
  });
  
});

// Kilépés gomb (header-ben és settings-ben is)
function handleQuit() {
  window.app.quit();
}


if (btnQuitApp) {
  btnQuitApp.addEventListener('click', (e) => {
    e.stopPropagation();
    handleQuit();
  });
}

if (btnQuitHeader) {
  btnQuitHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    handleQuit();
  });
}

// Téma változtatása
themeDark.addEventListener('change', () => {
  if (themeDark.checked) {
    applyTheme('dark');
  }
});

themeLight.addEventListener('change', () => {
  if (themeLight.checked) {
    applyTheme('light');
  }
});

// Színezési beállítás változtatása
function updateColorSettings() {
  colorSettings.enabled = settingsColorEnabled.checked;
  colorSettings.green.from = parseInt(colorGreenFrom.value) || 30;
  colorSettings.green.to = parseInt(colorGreenTo.value) || 1440;
  colorSettings.yellow.from = parseInt(colorYellowFrom.value) || 10;
  colorSettings.yellow.to = parseInt(colorYellowTo.value) || 30;
  colorSettings.red.from = parseInt(colorRedFrom.value) || -5;
  colorSettings.red.to = parseInt(colorRedTo.value) || 10;
  
  saveColorSettings();
}

function updateMeetingDisplaySettings() {
  const parsed = parseInt(meetingGraceMinutesInput.value, 10);
  const minutes = Number.isFinite(parsed) ? Math.max(0, parsed) : 5;
  meetingDisplaySettings.graceMinutes = minutes;
  meetingGraceMinutesInput.value = minutes;
  saveMeetingDisplaySettings();
}

function updateCalendarRefreshSettings() {
  const parsed = parseInt(calendarRefreshMinutesInput.value, 10);
  const minutes = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
  calendarRefreshSettings.intervalMinutes = minutes;
  calendarRefreshMinutesInput.value = minutes;
  saveCalendarRefreshSettings();
  applyCalendarRefreshInterval();
  refreshCalendar();
}

async function refreshUIWithColorSettings() {
  // Frissítjük a UI-t
  await updateBarViewWithNextMeeting();
  if (isExpanded && !isSettingsOpen) {
    await renderCalendarList();
  }
}

async function refreshUIWithMeetingSettings() {
  await updateBarViewWithNextMeeting();
  if (isExpanded && !isSettingsOpen) {
    await renderCalendarList();
  }
}

settingsColorEnabled.addEventListener('change', async () => {
  updateColorSettings();
  await refreshUIWithColorSettings();
});

// Szín értékek változtatása
[colorGreenFrom, colorGreenTo, colorYellowFrom, colorYellowTo, colorRedFrom, colorRedTo].forEach(input => {
  input.addEventListener('change', async () => {
    updateColorSettings();
    await refreshUIWithColorSettings();
  });
  
  input.addEventListener('blur', async () => {
    updateColorSettings();
    await refreshUIWithColorSettings();
  });
});

meetingGraceMinutesInput.addEventListener('change', async () => {
  updateMeetingDisplaySettings();
  await refreshUIWithMeetingSettings();
});

meetingGraceMinutesInput.addEventListener('blur', async () => {
  updateMeetingDisplaySettings();
  await refreshUIWithMeetingSettings();
});

calendarRefreshMinutesInput.addEventListener('change', () => {
  updateCalendarRefreshSettings();
});

calendarRefreshMinutesInput.addEventListener('blur', () => {
  updateCalendarRefreshSettings();
});

// Main process állapot
window.widget.onState((expanded) => {
  isExpanded = expanded;
  updateUI();
});

window.widget.onSettingsState((open) => {
  isSettingsOpen = open;
  updateUI();
});

window.auth.onStateChanged(async (state) => {
  const wasAuthenticated = authState.isAuthenticated;
  authState.isAuthenticated = state.isAuthenticated;
  authState.account = state.account;
  authState.userInfo = state.userInfo || null;
  authState.profilePhoto = null;
  
  if (state.isAuthenticated) {
    authState.profilePhoto = await window.auth.getProfilePhoto();
    await refreshCalendar();
    // Ha most jelentkezett be és a settings view van nyitva, zárjuk be és mutassuk a meetingeket
    if (!wasAuthenticated && isExpanded && isSettingsOpen) {
      await toggleSettings();
    }
  } else {
    calendarEvents = [];
    await updateBarViewWithNextMeeting();
    // Ha kijelentkezett és a contentView nyitva van, mutassuk a bejelentkezést
    if (wasAuthenticated && isExpanded && !isSettingsOpen) {
      await toggleSettings();
    }
  }
  
  await updateBarViewTitle();
  await updateUI();
});

// Calendar events updated handler – mind a lista, mind a kiemelt terület frissül
window.calendar.onEventsUpdated(async (events) => {
  calendarEvents = Array.isArray(events) ? [...events] : [];
  await updateBarViewWithNextMeeting();
  if (isExpanded && !isSettingsOpen) {
    await renderCalendarList();
  }
  lastCalendarRefreshAt = DateUtils.now();
  updateCalendarRefreshLastDisplay();
});

// Init
window.widget.getState().then((s) => {
  isExpanded = s;
  updateUI();
});

window.widget.getSettingsState().then((s) => {
  isSettingsOpen = s;
  updateUI();
});

updateAuthState();

// Periódikus frissítés: main process küldi az events-updated-et percenként
