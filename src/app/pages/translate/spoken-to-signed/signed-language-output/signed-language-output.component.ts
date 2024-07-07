import {Component, OnInit, ViewChild, ElementRef} from '@angular/core';
import {Observable} from 'rxjs';
import {PoseViewerSetting} from '../../../../modules/settings/settings.state';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {Store} from '@ngxs/store';
import {takeUntil, tap} from 'rxjs/operators';
import {
  CopySignedLanguageVideo,
  DownloadSignedLanguageVideo,
  ShareSignedLanguageVideo,
} from '../../../../modules/translate/translate.actions';
import {BaseComponent} from '../../../../components/base/base.component';
import {Capacitor} from '@capacitor/core';
import {getMediaSourceClass} from '../../pose-viewers/playable-video-encoder';

@Component({
  selector: 'app-signed-language-output',
  templateUrl: './signed-language-output.component.html',
  styleUrls: ['./signed-language-output.component.scss'],
})
export class SignedLanguageOutputComponent extends BaseComponent implements OnInit {
  @ViewChild('overlayVideo') overlayVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('originalVideo') originalVideo!: ElementRef<HTMLVideoElement>;

  poseViewerSetting$!: Observable<PoseViewerSetting>;
  pose$!: Observable<string>;
  video$!: Observable<string>;

  videoUrl: string | null = null;
  safeVideoUrl: SafeUrl | null = null;
  overlaySafeVideoUrl: SafeUrl | null = null;
  isSharingSupported: boolean;

  constructor(private store: Store, private domSanitizer: DomSanitizer) {
    super();

    this.poseViewerSetting$ = this.store.select<PoseViewerSetting>(state => state.settings.poseViewer);
    this.pose$ = this.store.select<string>(state => state.translate.signedLanguagePose);
    this.video$ = this.store.select<string>(state => state.translate.signedLanguageVideo);

    this.isSharingSupported = Capacitor.isNativePlatform() || ('navigator' in globalThis && 'share' in navigator);
  }

  ngOnInit(): void {
    this.video$
      .pipe(
        tap(url => {
          if (url) {
            this.videoUrl = url;
            this.safeVideoUrl = this.domSanitizer.bypassSecurityTrustUrl(url);
            if (this.originalVideo && this.originalVideo.nativeElement) {
              this.originalVideo.nativeElement.src = this.safeVideoUrl.toString();
              this.originalVideo.nativeElement.load();
              this.originalVideo.nativeElement
                .play()
                .catch(error => console.error('Error playing original video:', error));
            }
          } else {
            this.videoUrl = null;
            this.safeVideoUrl = null;
          }
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe();
  }

  setOverlayVideoUrl(url: string): void {
    this.overlaySafeVideoUrl = this.domSanitizer.bypassSecurityTrustUrl(url);
    if (this.overlayVideo && this.overlayVideo.nativeElement) {
      this.overlayVideo.nativeElement.src = this.overlaySafeVideoUrl.toString();
      this.overlayVideo.nativeElement.load();
      this.overlayVideo.nativeElement.play().catch(error => console.error('Error playing overlay video:', error));
    }
  }

  triggerDownload(): void {
    if (!this.videoUrl) {
      console.warn('No video URL available for download');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = this.videoUrl;
      link.setAttribute('download', 'video.mp4');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error during video download:', error);
    }
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
    if (video.paused && this.safeVideoUrl) {
      video.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }

  async createVideoMediaSource() {
    if (!this.videoUrl) {
      return null;
    }

    try {
      const res = await fetch(this.videoUrl);
      const blob = await res.blob();

      const mediaSourceClass = getMediaSourceClass();
      if (!mediaSourceClass) {
        return null;
      }

      const mediaSource = new mediaSourceClass();
      mediaSource.addEventListener('sourceopen', async () => {
        const sourceBuffer = mediaSource.addSourceBuffer(blob.type);
        sourceBuffer.addEventListener('updateend', () => {
          if (!sourceBuffer.updating && mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
        });
        sourceBuffer.appendBuffer(await blob.arrayBuffer());
      });

      return mediaSource;
    } catch (error) {
      console.error('Error creating video media source:', error);
      return null;
    }
  }

  async onVideoError(event: ErrorEvent) {
    if (this.safeVideoUrl === null) {
      return;
    }

    const video = event.target as HTMLVideoElement;
    if (!video.srcObject) {
      try {
        this.safeVideoUrl = null;
        video.disableRemotePlayback = true; // Disable AirPlay, must be used for ManagedMediaSource
        video.srcObject = await this.createVideoMediaSource();
      } catch (error) {
        console.error('Error handling video error:', error);
      }
    }
  }
}
