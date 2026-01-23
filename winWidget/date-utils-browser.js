// Böngésző-kompatibilis dátum kezelő modul dinamikus timezone-nal
// moment-timezone-t használ, amit CDN-ről töltünk be

// Alapértelmezett timezone
const DEFAULT_TIMEZONE = 'Europe/Budapest';

// Timezone mapping: GMT -> UTC, CET -> Europe/Budapest
const TIMEZONE_MAP = {
  'GMT': 'UTC',
  'CET': 'Europe/Budapest'
};

/**
 * Központi dátum kezelő modul dinamikus timezone-nal (böngésző verzió)
 */
const DateUtils = {
  /**
   * Visszaadja a jelenlegi timezone-t localStorage-ból vagy alapértelmezett
   * @returns {string}
   */
  getTimezone() {
    try {
      const saved = localStorage.getItem('timezoneSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.timezone && TIMEZONE_MAP[settings.timezone]) {
          return TIMEZONE_MAP[settings.timezone];
        }
      }
    } catch (e) {
      console.error('Error loading timezone settings:', e);
    }
    return DEFAULT_TIMEZONE;
  },

  /**
   * Visszaadja a jelenlegi időt a beállított timezone-ban
   * @returns {moment.Moment}
   */
  now() {
    return moment.tz(this.getTimezone());
  },

  /**
   * Konvertál egy Date objektumot moment objektummá a beállított timezone-ban
   * @param {Date} date - A konvertálandó dátum
   * @returns {moment.Moment}
   */
  toTimezone(date) {
    if (!date) return null;
    return moment.tz(date, this.getTimezone());
  },

  /**
   * @deprecated Használd a toTimezone() függvényt helyette
   * @param {Date} date - A konvertálandó dátum
   * @returns {moment.Moment}
   */
  toBudapest(date) {
    return this.toTimezone(date);
  },

  /**
   * Létrehoz egy moment objektumot a beállított timezone-ban
   * @param {number|string|Date|moment.Moment} input - Dátum input
   * @returns {moment.Moment}
   */
  create(input) {
    if (!input) return moment.tz(this.getTimezone());
    return moment.tz(input, this.getTimezone());
  },

  /**
   * Visszaadja a mai nap kezdetét (éjfél) a beállított timezone-ban
   * @param {Date|moment.Moment} date - Opcionális dátum, alapértelmezetten ma
   * @returns {moment.Moment}
   */
  dayStart(date = null) {
    const m = date ? this.toTimezone(date) : this.now();
    return m.clone().startOf('day');
  },

  /**
   * Visszaadja a nap végét (23:59:59.999) a beállított timezone-ban
   * @param {Date|moment.Moment} date - Opcionális dátum, alapértelmezetten ma
   * @returns {moment.Moment}
   */
  dayEnd(date = null) {
    const m = date ? this.toTimezone(date) : this.now();
    return m.clone().endOf('day');
  },

  /**
   * Hozzáad napokat egy dátumhoz
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} days - Hozzáadandó napok száma
   * @returns {moment.Moment}
   */
  addDays(date, days) {
    const m = this.toTimezone(date);
    return m.clone().add(days, 'days');
  },

  /**
   * Kivon napokat egy dátumból
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} days - Kivonandó napok száma
   * @returns {moment.Moment}
   */
  subtractDays(date, days) {
    const m = this.toTimezone(date);
    return m.clone().subtract(days, 'days');
  },

  /**
   * Hozzáad perceket egy dátumhoz
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} minutes - Hozzáadandó percek száma
   * @returns {moment.Moment}
   */
  addMinutes(date, minutes) {
    const m = this.toTimezone(date);
    return m.clone().add(minutes, 'minutes');
  },

  /**
   * Kivon perceket egy dátumból
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} minutes - Kivonandó percek száma
   * @returns {moment.Moment}
   */
  subtractMinutes(date, minutes) {
    const m = this.toTimezone(date);
    return m.clone().subtract(minutes, 'minutes');
  },

  /**
   * Hozzáad órákat egy dátumhoz
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} hours - Hozzáadandó órák száma
   * @returns {moment.Moment}
   */
  addHours(date, hours) {
    const m = this.toTimezone(date);
    return m.clone().add(hours, 'hours');
  },

  /**
   * Kiszámolja a percek különbségét két dátum között
   * @param {Date|moment.Moment} date1 - Első dátum
   * @param {Date|moment.Moment} date2 - Második dátum (alapértelmezetten most)
   * @returns {number} Percek különbsége (date1 - date2)
   */
  diffMinutes(date1, date2 = null) {
    const m1 = this.toTimezone(date1);
    const m2 = date2 ? this.toTimezone(date2) : this.now();
    return m1.diff(m2, 'minutes');
  },

  /**
   * Formázza a dátumot idő formátumban (HH:mm)
   * @param {Date|moment.Moment} date - A formázandó dátum
   * @returns {string}
   */
  formatTime(date) {
    const m = this.toTimezone(date);
    return m.format('HH:mm');
  },

  /**
   * Formázza a dátumot dátum formátumban
   * @param {Date|moment.Moment} date - A formázandó dátum
   * @param {number} dayIndex - Nap index (0 = ma, 1 = holnap, stb.)
   * @returns {string}
   */
  formatDate(date, dayIndex = null) {
    const m = this.toTimezone(date);
    const dateStr = m.format('dddd, MMMM Do');
    
    if (dayIndex === 0) {
      return `Ma (${dateStr})`;
    }
    
    return dateStr;
  },

  /**
   * Formázza az időtartamot percek alapján
   * @param {number} minutes - Percek száma
   * @returns {string}
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} perc`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} óra ${mins} perc` : `${hours} óra`;
  },

  /**
   * Formázza a hátralévő időt
   * @param {Date|moment.Moment} startDate - Kezdési dátum
   * @returns {string|null} Formázott idő vagy null, ha már túl régen volt
   */
  formatTimeUntil(startDate) {
    const diffMins = this.diffMinutes(startDate);
    
    // -3 percig mutatjuk (mert lehet késve megy be)
    if (diffMins < -3) {
      return null;
    }
    
    if (diffMins < 60) {
      return `${diffMins}p`;
    }
    
    const hours = Math.floor(diffMins / 60);
    return `${hours}ó`;
  },

  /**
   * Összehasonlítja, hogy két dátum ugyanazon a napon van-e a beállított timezone-ban
   * @param {Date|moment.Moment} date1 - Első dátum
   * @param {Date|moment.Moment} date2 - Második dátum (alapértelmezetten ma)
   * @returns {boolean}
   */
  isSameDay(date1, date2 = null) {
    const m1 = this.toTimezone(date1);
    const m2 = date2 ? this.toTimezone(date2) : this.now();
    return m1.isSame(m2, 'day');
  },

  /**
   * Konvertál moment objektumot JavaScript Date objektummá (UTC-ként)
   * @param {moment.Moment} momentObj - A konvertálandó moment objektum
   * @returns {Date}
   */
  toDate(momentObj) {
    if (!momentObj) return null;
    return momentObj.toDate();
  },

  /**
   * Konvertál moment objektumot ISO stringgé
   * @param {moment.Moment} momentObj - A konvertálandó moment objektum
   * @returns {string}
   */
  toISOString(momentObj) {
    if (!momentObj) return null;
    return momentObj.toISOString();
  },

  /**
   * Visszaadja a dátum komponenseit a beállított timezone-ban
   * @param {Date|moment.Moment} date - A dátum
   * @returns {Object} {year, month, day, hour, minute, second}
   */
  getDateComponents(date) {
    const m = this.toTimezone(date);
    return {
      year: m.year(),
      month: m.month(), // 0-11
      day: m.date(),
      hour: m.hour(),
      minute: m.minute(),
      second: m.second()
    };
  },

  /**
   * Ellenőrzi, hogy egy dátum a múltban van-e
   * @param {Date|moment.Moment} date - Az ellenőrizendő dátum
   * @param {number} thresholdMinutes - Küszöb percekben (alapértelmezetten -3)
   * @returns {boolean}
   */
  isPast(date, thresholdMinutes = -3) {
    const diffMins = this.diffMinutes(date);
    return diffMins < thresholdMinutes;
  },

  /**
   * Ellenőrzi, hogy egy dátum a jövőben van-e
   * @param {Date|moment.Moment} date - Az ellenőrizendő dátum
   * @returns {boolean}
   */
  isFuture(date) {
    const diffMins = this.diffMinutes(date);
    return diffMins > 0;
  },

  /**
   * Visszaadja a timezone konstanst (kompatibilitás miatt)
   * @returns {string}
   */
  getTimezoneConstant() {
    return this.getTimezone();
  }
};
