import {Component, OnInit, EventEmitter, Output, Input, OnChanges, SimpleChanges} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PoseViewerSetting} from '../../../../modules/settings/settings.state';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {Store} from '@ngxs/store';
import {takeUntil, tap} from 'rxjs/operators';
import {
  CopySignedLanguageVideo,
  DownloadSignedLanguageVideo,
  ShareSignedLanguageVideo,
} from '../../../../modules/translate/translate.actions';
import {Capacitor} from '@capacitor/core';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-signed-language-output',
  templateUrl: './signed-language-output.component.html',
  styleUrls: ['./signed-language-output.component.scss'],
})
export class SignedLanguageOutputComponent implements OnInit, OnChanges {
  poseViewerSetting$!: Observable<PoseViewerSetting>;
  pose$!: Observable<string>;
  video$!: Observable<string>;

  videoUrl: string;
  safeVideoUrl: SafeUrl;
  isSharingSupported: boolean;
  private ngUnsubscribe: Subject<void> = new Subject<void>();
  private overlayInProgress: boolean = false;

  @Input() originalVideoFile: File | null = null;
  @Output() signLanguageVideoReady = new EventEmitter<File>();

  constructor(private store: Store, private domSanitizer: DomSanitizer, private http: HttpClient) {
    this.poseViewerSetting$ = this.store.select<PoseViewerSetting>(state => state.settings.poseViewer);
    this.pose$ = this.store.select<string>(state => state.translate.signedLanguagePose);
    this.video$ = this.store.select<string>(state => state.translate.signedLanguageVideo);
    this.isSharingSupported = Capacitor.isNativePlatform() || ('navigator' in globalThis && 'share' in navigator);
  }

  ngOnInit(): void {
    this.video$
      .pipe(
        tap(url => {
          this.videoUrl = url;
          this.safeVideoUrl = url ? this.domSanitizer.bypassSecurityTrustUrl(url) : null;
          if (url && !this.overlayInProgress) {
            this.downloadSkeletonVideo(url);
          }
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.originalVideoFile && changes.originalVideoFile.currentValue && !this.overlayInProgress) {
      this.triggerDownload();
    }
  }

  downloadSkeletonVideo(url: string): void {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], 'signLanguage.mp4', {type: 'video/mp4'});
        this.signLanguageVideoReady.emit(file);
        this.uploadSignLanguageVideo(file);
      })
      .catch(error => console.error('Error downloading skeleton video:', error));
  }

  triggerDownload(): void {
    if (this.overlayInProgress) {
      return;
    }
    this.overlayInProgress = true;

    fetch(this.videoUrl)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], 'signLanguage.mp4', {type: 'video/mp4'});
        this.signLanguageVideoReady.emit(file);
        this.uploadSignLanguageVideo(file);
      })
      .catch(error => {
        console.error('Error downloading skeleton video:', error);
        this.overlayInProgress = false;
      });
  }

  uploadSignLanguageVideo(file: File): void {
    const formData = new FormData();
    formData.append('overlayVideo', file);

    if (this.originalVideoFile) {
      formData.append('mainVideo', this.originalVideoFile);
    } else {
      console.error('Original video file is not available');
      this.overlayInProgress = false;
      return;
    }

    this.http.post('http://localhost:5000/overlay-video', formData, {responseType: 'blob'}).subscribe({
      next: blob => {
        console.log('Overlay successful', blob);
        this.downloadFile(blob, 'overlayed_video.mp4');
        this.overlayInProgress = false;
      },
      error: err => {
        console.error('Error overlaying videos:', err);
        this.overlayInProgress = false;
      },
    });
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyTranslation(): void {
    this.store.dispatch(CopySignedLanguageVideo);
  }

  downloadTranslation(): void {
    this.store.dispatch(DownloadSignedLanguageVideo);
  }

  shareTranslation(): void {
    this.store.dispatch(ShareSignedLanguageVideo);
  }

  playVideoIfPaused(event: MouseEvent): void {
    const video = event.target as HTMLVideoElement;
    if (video.paused) {
      video.play().then().catch();
    }
  }

  async onVideoError(event: ErrorEvent) {
    if (this.safeVideoUrl === null) {
      return;
    }

    const video = event.target as HTMLVideoElement;
    video.src = this.videoUrl;
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
