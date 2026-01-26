const moment = require('moment-timezone');

const timeZone = 'Europe/Budapest';

/**
 * Központi dátum kezelő modul fix timezone-nal
 */
class DateUtils {
  /**
   * Visszaadja a használt timezone-t
   * @returns {string}
   */
  static getTimezone() {
    return timeZone;
  }

  /**
   * Visszaadja a jelenlegi időt a beállított timezone-ban
   * @returns {moment.Moment}
   */
  static now() {
    return moment.tz(this.getTimezone());
  }

  /**
   * Konvertál egy Date objektumot moment objektummá a beállított timezone-ban
   * @param {Date} date - A konvertálandó dátum
   * @returns {moment.Moment}
   */
  static toTimezone(date) {
    if (!date) return null;
    return moment.tz(date, this.getTimezone());
  }

  /**
   * Létrehoz egy moment objektumot a beállított timezone-ban
   * @param {number|string|Date|moment.Moment} input - Dátum input
   * @returns {moment.Moment}
   */
  static create(input) {
    if (!input) return moment.tz(this.getTimezone());
    return moment.tz(input, this.getTimezone());
  }

  /**
   * UTC dátum string konvertálása timezone Date objektummá
   * @param {string} dateTime - UTC dátum string
   * @returns {Date|null}
   */
  static fromUtcToTimeZone(dateTime) {
    if (!dateTime) return null;
    return moment.utc(dateTime).tz(this.getTimezone()).toDate();
  }

  /**
   * Visszaadja a mai nap kezdetét (éjfél) a beállított timezone-ban
   * @param {Date|moment.Moment} date - Opcionális dátum, alapértelmezetten ma
   * @returns {moment.Moment}
   */
  static dayStart(date = null) {
    const m = date ? this.toTimezone(date) : this.now();
    return m.clone().startOf('day');
  }

  /**
   * Visszaadja a nap végét (23:59:59.999) a beállított timezone-ban
   * @param {Date|moment.Moment} date - Opcionális dátum, alapértelmezetten ma
   * @returns {moment.Moment}
   */
  static dayEnd(date = null) {
    const m = date ? this.toTimezone(date) : this.now();
    return m.clone().endOf('day');
  }

  /**
   * Hozzáad napokat egy dátumhoz
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} days - Hozzáadandó napok száma
   * @returns {moment.Moment}
   */
  static addDays(date, days) {
    const m = this.toTimezone(date);
    return m.clone().add(days, 'days');
  }

  /**
   * Kivon napokat egy dátumból
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} days - Kivonandó napok száma
   * @returns {moment.Moment}
   */
  static subtractDays(date, days) {
    const m = this.toTimezone(date);
    return m.clone().subtract(days, 'days');
  }

  /**
   * Hozzáad perceket egy dátumhoz
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} minutes - Hozzáadandó percek száma
   * @returns {moment.Moment}
   */
  static addMinutes(date, minutes) {
    const m = this.toTimezone(date);
    return m.clone().add(minutes, 'minutes');
  }

  /**
   * Kivon perceket egy dátumból
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} minutes - Kivonandó percek száma
   * @returns {moment.Moment}
   */
  static subtractMinutes(date, minutes) {
    const m = this.toTimezone(date);
    return m.clone().subtract(minutes, 'minutes');
  }

  /**
   * Hozzáad órákat egy dátumhoz
   * @param {Date|moment.Moment} date - Kiindulási dátum
   * @param {number} hours - Hozzáadandó órák száma
   * @returns {moment.Moment}
   */
  static addHours(date, hours) {
    const m = this.toTimezone(date);
    return m.clone().add(hours, 'hours');
  }

  /**
   * Kiszámolja a percek különbségét két dátum között
   * @param {Date|moment.Moment} date1 - Első dátum
   * @param {Date|moment.Moment} date2 - Második dátum (alapértelmezetten most)
   * @returns {number} Percek különbsége (date1 - date2)
   */
  static diffMinutes(date1, date2 = null) {
    const m1 = this.toTimezone(date1);
    const m2 = date2 ? this.toTimezone(date2) : this.now();
    return m1.diff(m2, 'minutes');
  }

  /**
   * Formázza a dátumot idő formátumban (HH:mm)
   * @param {Date|moment.Moment} date - A formázandó dátum
   * @returns {string}
   */
  static formatTime(date) {
    const m = this.toTimezone(date);
    return m.format('HH:mm');
  }

  /**
   * Formázza a dátumot dátum formátumban
   * @param {Date|moment.Moment} date - A formázandó dátum
   * @param {number} dayIndex - Nap index (0 = ma, 1 = holnap, stb.)
   * @returns {string}
   */
  static formatDate(date, dayIndex = null) {
    const m = this.toTimezone(date);
    const dateStr = m.format('dddd, MMMM Do');
    
    if (dayIndex === 0) {
      return `Ma (${dateStr})`;
    }
    
    return dateStr;
  }

  /**
   * Formázza az időtartamot percek alapján
   * @param {number} minutes - Percek száma
   * @returns {string}
   */
  static formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} perc`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} óra ${mins} perc` : `${hours} óra`;
  }

  /**
   * Formázza a hátralévő időt
   * @param {Date|moment.Moment} startDate - Kezdési dátum
   * @returns {string|null} Formázott idő vagy null, ha már túl régen volt
   */
  static formatTimeUntil(startDate, graceMinutes = 5) {
    const diffMins = this.diffMinutes(startDate);
    
    // -graceMinutes percig mutatjuk (mert lehet késve megy be)
    if (diffMins < -graceMinutes) {
      return null;
    }
    
    if (diffMins < 60) {
      return `${diffMins}p`;
    }
    
    const hours = Math.floor(diffMins / 60);
    return `${hours}ó`;
  }

  /**
   * Formázza, mennyi ideje fut a meeting
   * @param {Date|moment.Moment} startDate - Kezdési dátum
   * @param {Date|moment.Moment|null} now - Aktuális idő (opcionális)
   * @returns {string|null}
   */
  static formatElapsedSince(startDate, now = null) {
    if (!startDate) return null;
    const nowMoment = now ? this.toTimezone(now) : this.now();
    const diffMins = Math.max(0, this.diffMinutes(nowMoment, startDate));
    if (diffMins < 60) {
      return `${diffMins}p`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}ó ${mins}p` : `${hours}ó`;
  }

  /**
   * Összehasonlítja, hogy két dátum ugyanazon a napon van-e a beállított timezone-ban
   * @param {Date|moment.Moment} date1 - Első dátum
   * @param {Date|moment.Moment} date2 - Második dátum (alapértelmezetten ma)
   * @returns {boolean}
   */
  static isSameDay(date1, date2 = null) {
    const m1 = this.toTimezone(date1);
    const m2 = date2 ? this.toTimezone(date2) : this.now();
    return m1.isSame(m2, 'day');
  }

  /**
   * Konvertál moment objektumot JavaScript Date objektummá (UTC-ként)
   * @param {moment.Moment} momentObj - A konvertálandó moment objektum
   * @returns {Date}
   */
  static toDate(momentObj) {
    if (!momentObj) return null;
    return momentObj.toDate();
  }

  /**
   * Konvertál moment objektumot ISO stringgé
   * @param {moment.Moment} momentObj - A konvertálandó moment objektum
   * @returns {string}
   */
  static toISOString(momentObj) {
    if (!momentObj) return null;
    return momentObj.toISOString();
  }

  /**
   * Visszaadja a dátum komponenseit a beállított timezone-ban
   * @param {Date|moment.Moment} date - A dátum
   * @returns {Object} {year, month, day, hour, minute, second}
   */
  static getDateComponents(date) {
    const m = this.toTimezone(date);
    return {
      year: m.year(),
      month: m.month(), // 0-11
      day: m.date(),
      hour: m.hour(),
      minute: m.minute(),
      second: m.second()
    };
  }

  /**
   * Ellenőrzi, hogy egy dátum a múltban van-e
   * @param {Date|moment.Moment} date - Az ellenőrizendő dátum
   * @param {number} thresholdMinutes - Küszöb percekben (alapértelmezetten -5)
   * @returns {boolean}
   */
  static isPast(date, thresholdMinutes = -5) {
    const diffMins = this.diffMinutes(date);
    return diffMins < thresholdMinutes;
  }

  /**
   * Ellenőrzi, hogy egy meeting már véget ért-e
   * @param {Date|moment.Moment} endDate - Meeting vége
   * @param {Date|moment.Moment|null} now - Aktuális idő (opcionális)
   * @returns {boolean}
   */
  static isEnded(endDate, now = null) {
    if (!endDate) return false;
    const endMoment = this.toTimezone(endDate);
    const nowMoment = now ? this.toTimezone(now) : this.now();
    return endMoment.isBefore(nowMoment);
  }

  /**
   * Ellenőrzi, hogy egy meeting épp tart-e
   * @param {Date|moment.Moment} startDate - Meeting kezdete
   * @param {Date|moment.Moment} endDate - Meeting vége
   * @param {Date|moment.Moment|null} now - Aktuális idő (opcionális)
   * @returns {boolean}
   */
  static isOngoing(startDate, endDate, now = null) {
    if (!startDate || !endDate) return false;
    const startMoment = this.toTimezone(startDate);
    const endMoment = this.toTimezone(endDate);
    const nowMoment = now ? this.toTimezone(now) : this.now();
    const started = startMoment.isSame(nowMoment) || startMoment.isBefore(nowMoment);
    return started && endMoment.isAfter(nowMoment);
  }

  /**
   * Ellenőrzi, hogy egy dátum a jövőben van-e
   * @param {Date|moment.Moment} date - Az ellenőrizendő dátum
   * @returns {boolean}
   */
  static isFuture(date) {
    const diffMins = this.diffMinutes(date);
    return diffMins > 0;
  }

  /**
   * Visszaadja a timezone konstanst (kompatibilitás miatt)
   * @returns {string}
   */
  static getTimezoneConstant() {
    return this.getTimezone();
  }
}

module.exports = DateUtils;
