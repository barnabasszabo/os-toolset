import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ElectronService } from '../core/services';

const { translate } = require("google-translate-api-browser");

const fields = `pronunciations,definitions,domains,etymologies,regions,registers,examples,variantForms`;
const strictMatch = "false";

@Component({
  selector: 'app-translate',
  templateUrl: './translate.component.html',
  styleUrls: ['./translate.component.scss']
})
export class TranslateComponent implements OnInit {

  @ViewChild('taskTextElem') taskTextElem: ElementRef;

  settingBlockDisplay = false;
  active = 1;
  searchText = ``;
  lastText = ``;
  onSubmitted = false;
  gTransRes: any;
  oxTransRes: any;
  sourceLang = `en`;
  foreignLang: string;
  transFromEng = true;

  oxfordAPI = {
    'Content-Type': 'application/json',
    'app_id': `1fed5fcb`,
    'app_key': `28e8c08ecd604d62bf8df77cc9a67d23`
  }

  constructor(private electronService: ElectronService) { }

  ngOnInit(): void {

    this.electronService.getIpcRenderer().send('onWindowShowSubscription');
    this.electronService.getIpcRenderer().on('onWindowShow', (event, args) => {
      console.log(`onWindowShow`, event, args);
      this.focusInputElem();
    });

    console.log(`Language navigator.browserLanguage`, navigator.language);
    this.resetForm();

    this.detectForeignLang();

    try {
      this.oxfordAPI = JSON.parse(localStorage.getItem(`oxford-api`)) || this.oxfordAPI;
    } catch (e) {}

  }

  saveSettings() {

  }

  resetForm() {
    this.searchText = null;
    this.onSubmitted = false;
    this.focusInputElem();
  }

  focusInputElem(event?) {
    console.log(`FIRED`, event);

    setTimeout(()=>{
      this.taskTextElem.nativeElement.focus();
    },0);
  }

  detectForeignLang() {
    let lang = `hu`;
    try {
      if (navigator.language.split(`-`)[0].toLowerCase() !== `en`) {
        lang = navigator.language.split(`-`)[0];
      }
    } catch (e) {}
    lang = localStorage.getItem(`target-lang`) || lang;
    this.foreignLang = lang;
  }

  setForeignLang(lang) {
    localStorage.setItem(`target-lang`, lang);
    this.detectForeignLang();
  }

  setOxfordAppId(appId) {
    this.oxfordAPI.app_id = appId;
    localStorage.setItem(`oxford-api`, JSON.stringify(this.oxfordAPI));
  }

  setOxfordAppKey(appKey) {
    this.oxfordAPI.app_key = appKey;
    localStorage.setItem(`oxford-api`, JSON.stringify(this.oxfordAPI));
  }

  async onSearch() {
    if (this.searchText) {
      this.onSubmitted = true;
      this.oxTransRes = null;
      this.gTransRes = null;

      const from = this.transFromEng ? this.sourceLang : this.foreignLang;
      const to = this.transFromEng ? this.foreignLang : this.sourceLang;
      translate(this.searchText, { from: from, to: to, raw: false }).then(data => this.gTransRes = data);
      this.oxfordSearch(this.searchText).then(data => this.oxTransRes = data);
      this.lastText = this.searchText;

      this.resetForm();
    }
  }

  async oxfordSearch(text: string) {
    if (text.indexOf(` `) < 0) {
      return await this.getFromOxfordApi(`https://od-api.oxforddictionaries.com:443/api/v2/entries/en-gb/${text}?fields=${fields}&strictMatch=${strictMatch}`);
    }
    return null;
  }

  async getFromOxfordApi(url: string): Promise<any> {
    return new Promise( (resolve, reject) => {
        fetch(url, {
                method: 'GET',
                headers: this.oxfordAPI,
            })
            .then(res => res.json())
            .then(json => resolve(json))
            .catch(err => reject(err));
    });
  }

  noteAsText(arr: any) {
    return arr.map(e => e.text).join(',');
  }

  replaceLang() {
    this.transFromEng = !this.transFromEng;
  }

}
