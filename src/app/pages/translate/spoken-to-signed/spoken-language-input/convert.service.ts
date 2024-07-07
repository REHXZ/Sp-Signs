import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConvertService {
  constructor(private http: HttpClient) {}

  convertMp4ToMp3(data: {videoPath: string}): Observable<Blob> {
    return this.http.post<Blob>('http://localhost:5000/mp4tomp3', data, {
      responseType: 'blob' as 'json',
    });
  }

  getTextFromMp3(mp3Blob: Blob): Observable<any> {
    const formData = new FormData();
    formData.append('audio', mp3Blob, 'audio.mp3');

    return this.http.post<any>('http://localhost:5000/mp3totext', formData);
  }

  overlayVideos(formData: FormData): Observable<Blob> {
    return this.http.post<Blob>('http://localhost:5000/overlay-video', formData, {
      responseType: 'blob' as 'json',
    });
  }
}
