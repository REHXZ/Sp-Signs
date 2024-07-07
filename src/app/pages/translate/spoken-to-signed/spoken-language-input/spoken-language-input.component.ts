import {Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef} from '@angular/core';
import {FormControl} from '@angular/forms';
import {debounce, distinctUntilChanged, skipWhile, takeUntil, tap} from 'rxjs/operators';
import {interval, Observable} from 'rxjs';
import {Store} from '@ngxs/store';
import {
  SetSpokenLanguage,
  SetSpokenLanguageText,
  SuggestAlternativeText,
} from '../../../../modules/translate/translate.actions';
import {TranslateStateModel} from '../../../../modules/translate/translate.state';
import {BaseComponent} from '../../../../components/base/base.component';
import {ConvertService} from './convert.service';

@Component({
  selector: 'app-spoken-language-input',
  templateUrl: './spoken-language-input.component.html',
  styleUrls: ['./spoken-language-input.component.scss'],
})
export class SpokenLanguageInputComponent extends BaseComponent implements OnInit, AfterViewInit {
  translate$: Observable<TranslateStateModel>;
  text$: Observable<string>;
  normalizedText$: Observable<string>;

  text = new FormControl();
  maxTextLength = 500;
  detectedLanguage: string = '';
  spokenLanguage: string = '';

  @Input() isMobile = false;

  @ViewChild('originalVideo') originalVideo!: ElementRef<HTMLVideoElement>;

  private originalVideoFile: File | null = null;
  private signLanguageVideoBlob: Blob | null = null;

  constructor(private store: Store, private convertService: ConvertService, private cdr: ChangeDetectorRef) {
    super();
    this.translate$ = this.store.select<TranslateStateModel>(state => state.translate);
    this.text$ = this.store.select<string>(state => state.translate.spokenLanguageText);
    this.normalizedText$ = this.store.select<string>(state => state.translate.normalizedSpokenLanguageText);
  }

  ngOnInit() {
    this.translate$
      .pipe(
        tap(({spokenLanguage, detectedLanguage}) => {
          this.detectedLanguage = detectedLanguage;
          this.spokenLanguage = spokenLanguage ?? detectedLanguage;
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe();

    const initialText = '';
    this.text.setValue(initialText);

    this.store.dispatch(new SetSpokenLanguageText(initialText));
    this.store.dispatch(new SuggestAlternativeText());

    this.text.valueChanges
      .pipe(
        debounce(() => interval(300)),
        skipWhile(text => !text),
        distinctUntilChanged((a, b) => {
          const trimmedA = typeof a === 'string' ? a.trim() : '';
          const trimmedB = typeof b === 'string' ? b.trim() : '';
          return trimmedA === trimmedB;
        }),
        tap(text => {
          if (typeof text === 'string') {
            this.store.dispatch(new SetSpokenLanguageText(text));
          }
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe();

    this.text.valueChanges
      .pipe(
        debounce(() => interval(1000)),
        distinctUntilChanged((a, b) => {
          const trimmedA = typeof a === 'string' ? a.trim() : '';
          const trimmedB = typeof b === 'string' ? b.trim() : '';
          return trimmedA === trimmedB;
        }),
        tap(text => {
          if (typeof text === 'string') {
            this.store.dispatch(new SuggestAlternativeText());
          }
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe();

    this.text$
      .pipe(
        tap(text => {
          if (typeof text === 'string') {
            this.text.setValue(text);
          }
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe();
  }

  ngAfterViewInit() {
    // Ensure ViewChild elements are set
  }

  setText(text: string) {
    this.store.dispatch(new SetSpokenLanguageText(text));
  }

  setDetectedLanguage() {
    this.store.dispatch(new SetSpokenLanguage(this.detectedLanguage));
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.originalVideoFile = file;
      this.originalVideo.nativeElement.src = URL.createObjectURL(file);
      this.cdr.detectChanges(); // Manually trigger change detection
      this.convertService.convertMp4ToMp3(file).subscribe({
        next: mp3Blob => {
          console.log('MP3 conversion successful', mp3Blob);
          this.convertService.getTextFromMp3(mp3Blob).subscribe({
            next: data => {
              console.log('Text extraction successful', data);
              let fileContent = '';
              if (typeof data.text === 'string') {
                fileContent = data.text;
              } else if (typeof data.text === 'object' && 'text' in data.text) {
                fileContent = data.text.text;
              } else {
                console.error('Unexpected response format:', data);
              }

              if (typeof fileContent === 'string') {
                this.text.setValue(fileContent);
                this.store.dispatch(new SetSpokenLanguageText(fileContent));
                this.store.dispatch(new SuggestAlternativeText());
              } else {
                console.error('Expected fileContent to be a string, but got:', typeof fileContent);
              }
            },
            error: err => console.error('Error converting MP3 to text:', err),
          });
        },
        error: err => console.error('Error converting MP4 to MP3:', err),
      });
    }
  }

  handleSignLanguageVideo(videoBlob: Blob) {
    if (videoBlob instanceof Blob) {
      this.signLanguageVideoBlob = videoBlob;
      this.tryOverlayAndDisplay();
    } else {
      console.error('Expected a Blob for sign language video, but got:', videoBlob);
    }
  }

  private tryOverlayAndDisplay() {
    if (this.signLanguageVideoBlob && this.originalVideoFile) {
      this.overlayAndDisplay();
    }
  }

  private overlayAndDisplay() {
    const formData = new FormData();
    formData.append('mainVideo', this.originalVideoFile as File);
    formData.append('overlayVideo', this.signLanguageVideoBlob, 'signLanguage.mp4');

    this.convertService.overlayVideos(formData).subscribe({
      next: blob => {
        console.log('Overlay successful', blob);
        const overlayVideoUrl = URL.createObjectURL(blob);
        const overlayVideoElement = document.createElement('video');
        overlayVideoElement.src = overlayVideoUrl;
        overlayVideoElement.controls = true;
        overlayVideoElement.style.position = 'absolute';
        overlayVideoElement.style.bottom = '10px';
        overlayVideoElement.style.right = '10px';
        overlayVideoElement.style.width = '150px'; // Adjust as needed
        overlayVideoElement.style.height = 'auto';
        overlayVideoElement.style.zIndex = '10';
        this.originalVideo.nativeElement.parentElement.appendChild(overlayVideoElement);
        this.cdr.detectChanges(); // Manually trigger change detection
      },
      error: err => console.error('Error overlaying videos:', err),
    });
  }

  ngOnChanges() {
    if (this.originalVideoFile && this.signLanguageVideoBlob) {
      this.overlayAndDisplay();
    }
  }
}
