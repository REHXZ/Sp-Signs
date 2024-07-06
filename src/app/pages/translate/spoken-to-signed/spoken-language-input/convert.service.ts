import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConvertService {
    private backendUrl = 'http://localhost:5000'; // Set the backend URL to localhost:5000
  
    constructor(private http: HttpClient) {}
  
    convertMp4ToMp3(file: File): Observable<Blob> {
      const formData = new FormData();
      formData.append('video', file);
      return this.http.post(`${this.backendUrl}/mp4tomp3`, formData, { responseType: 'blob' });
    }
  
    getTextFromMp3(file: Blob): Observable<any> {
      const formData = new FormData();
      formData.append('audio', file, 'audio.mp3');
      return this.http.post(`${this.backendUrl}/mp3totext`, formData);
    }
  
    overlayVideos(formData: FormData): Observable<Blob> {
      return this.http.post(`${this.backendUrl}/overlay-video`, formData, { responseType: 'blob' });
    }
  }
  