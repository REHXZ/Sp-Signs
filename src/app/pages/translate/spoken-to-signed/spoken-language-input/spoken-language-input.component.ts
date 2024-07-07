import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
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
import {HttpClient} from '@angular/common/http';

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
  modelLoadingError: boolean = false;
  estimatedTime: number = 0;

  @Input() isMobile = false;
  @Output() videoFileSelected = new EventEmitter<File>();

  @ViewChild('originalVideo') originalVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('signedLanguageOutput') signedLanguageOutput!: ElementRef<any>;
  @ViewChild('modalButton') modalButton!: ElementRef<HTMLButtonElement>;

  private originalVideoFile: File | null = null;
  private signLanguageVideoPath: File | null = null;

  constructor(
    private store: Store,
    private convertService: ConvertService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
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
    this.signedLanguageOutput.nativeElement.signLanguageVideoReady.subscribe((file: File) => {
      this.handleSignLanguageVideo(file);
    });
  }

  setText(text: string) {
    this.store.dispatch(new SetSpokenLanguageText(text));
  }

  setDetectedLanguage() {
    this.store.dispatch(new SetSpokenLanguage(this.detectedLanguage));
  }

  handleFileInput(event: Event): void {
    console.log(`Uploaded File detected and handled.`);
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.originalVideoFile = file;
      this.videoFileSelected.emit(file);
      this.uploadVideo(file); // Ensure the video is uploaded for further processing
      this.modalButton.nativeElement.click();
    }
  }

  uploadVideo(file: File): void {
    console.log(`Uploaded File is sending API call to download it...`);
    const formData = new FormData();
    formData.append('video', file);

    this.http.post<{videoPath: string}>('http://localhost:5000/upload-video', formData).subscribe({
      next: response => {
        console.log('Video uploaded successfully:', response.videoPath);
        if (response.videoPath.endsWith('.mp4')) {
          this.processVideo(response.videoPath);
        } else {
          console.error('Uploaded file is not in MP4 format:', response.videoPath);
        }
      },
      error: err => {
        console.error('Error uploading video:', err);
      },
    });
  }

  processVideo(videoPath: string): void {
    if (videoPath.endsWith('.mp4')) {
      this.convertService.convertMp4ToMp3({videoPath}).subscribe({
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
                this.modelLoadingError = true;
                this.estimatedTime = data.estimated_time;
              }

              if (typeof fileContent === 'string') {
                this.text.setValue(fileContent);
                this.store.dispatch(new SetSpokenLanguageText(fileContent));
                this.store.dispatch(new SuggestAlternativeText());
              } else {
                console.error('Expected fileContent to be a string, but got:', typeof fileContent);
              }
            },
            error: err => {
              console.error('Error converting MP3 to text:', err);
              if (
                err.error &&
                err.error === 'Model Baghdad99/saad-speech-recognition-hausa-audio-to-text is currently loading'
              ) {
                this.modelLoadingError = true;
                this.estimatedTime = err.estimated_time;
              }
            },
          });
        },
        error: err => console.error('Error converting MP4 to MP3:', err),
      });
    } else {
      console.error('Invalid video file format:', videoPath);
    }
  }

  handleSignLanguageVideo(file: File) {
    console.log('handleSignLanguageVideo called with File:', file);
    if (file instanceof File) {
      this.signLanguageVideoPath = file;
      this.tryOverlayAndDisplay();
    } else {
      console.error('Expected a File for sign language video, but got:', file);
    }
  }

  private tryOverlayAndDisplay() {
    console.log('tryOverlayAndDisplay called');
    if (this.signLanguageVideoPath && this.originalVideoFile) {
      this.overlayAndDisplay();
    }
  }

  private overlayAndDisplay() {
    // Implementation removed as per request
  }

  private downloadFile(blob: Blob, filename: string) {
    console.log('downloadFile called');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnChanges() {
    if (this.originalVideoFile && this.signLanguageVideoPath) {
      this.overlayAndDisplay();
    }
  }
}
