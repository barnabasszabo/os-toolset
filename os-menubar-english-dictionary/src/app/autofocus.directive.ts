import { AfterContentInit, Directive, ElementRef, Input } from '@angular/core';

@Directive({
  selector: '[appAutofocus]'
})
export class AutofocusDirective {

    public constructor(private el: ElementRef) {}

    // public ngAfterContentInit() {
    //     setTimeout(() => {
    //         this.el.nativeElement.focus();
    //     }, 500);
    // }

    ngAfterViewInit() {
      this.el.nativeElement.focus();
    }

}
