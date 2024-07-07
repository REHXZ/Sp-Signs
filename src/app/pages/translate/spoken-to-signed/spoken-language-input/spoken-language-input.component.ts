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

  @Input() isMobile = false;

  @ViewChild('originalVideo') originalVideo!: ElementRef<HTMLVideoElement>;

  private originalVideoFile: File | null = null;
  private signLanguageVideoBlob: Blob | null = null;

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
      this.uploadVideo(file); // Ensure the video is uploaded for further processing
    }
  }

  uploadVideo(file: File): void {
    const formData = new FormData();
    formData.append('video', file);

    this.http.post<{videoPath: string}>('http://localhost:5000/upload-video', formData).subscribe({
      next: response => {
        console.log('Video uploaded successfully:', response.videoPath);
        if (response.videoPath.endsWith('.mp4')) {
          this.displayVideo(response.videoPath); // Display video before processing
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

  displayVideo(videoPath: string): void {
    const videoUrl = `http://localhost:5000${videoPath}`; // Update this line to use the correct video URL
    console.log('Video URL:', videoUrl);
    this.originalVideo.nativeElement.src = videoUrl;
    this.originalVideo.nativeElement.load();
    this.originalVideo.nativeElement.play().catch(error => console.error('Error playing video:', error));
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
              }

              if (typeof fileContent === 'string') {
                this.text.setValue(fileContent);
                this.store.dispatch(new SetSpokenLanguageText(fileContent));
                this.store.dispatch(new SuggestAlternativeText());
              } else {
                console.error('Expected fileContent to be a string, but got:', typeof fileContent);
              }

              // Simulate receiving the sign language video blob and calling handleSignLanguageVideo
              const signLanguageVideoBlob = new Blob(); // Replace this with actual Blob data
              this.handleSignLanguageVideo(signLanguageVideoBlob);
            },
            error: err => console.error('Error converting MP3 to text:', err),
          });
        },
        error: err => console.error('Error converting MP4 to MP3:', err),
      });
    } else {
      console.error('Invalid video file format:', videoPath);
    }
  }

  handleSignLanguageVideo(videoBlob: Blob) {
    console.log('handleSignLanguageVideo called with Blob:', videoBlob);
    if (videoBlob instanceof Blob) {
      console.log('Blob size:', videoBlob.size); // Log Blob size
      if (videoBlob.size > 0) {
        this.signLanguageVideoBlob = videoBlob;
        this.tryOverlayAndDisplay();
      } else {
        console.error('Blob is empty.');
      }
    } else {
      console.error('Expected a Blob for sign language video, but got:', videoBlob);
    }
  }

  private tryOverlayAndDisplay() {
    console.log('tryOverlayAndDisplay called');
    if (this.signLanguageVideoBlob && this.originalVideoFile) {
      this.overlayAndDisplay();
    }
  }

  private overlayAndDisplay() {
    console.log('overlayAndDisplay called');
    const formData = new FormData();
    formData.append('mainVideo', this.originalVideoFile as File);
    formData.append('overlayVideo', this.signLanguageVideoBlob, 'signLanguage.mp4');

    this.convertService.overlayVideos(formData).subscribe({
      next: blob => {
        console.log('Overlay successful', blob);
        this.downloadFile(blob, 'overlayed_video.mp4');
      },
      error: err => console.error('Error overlaying videos:', err),
    });
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
    if (this.originalVideoFile && this.signLanguageVideoBlob) {
      this.overlayAndDisplay();
    }
  }
}
