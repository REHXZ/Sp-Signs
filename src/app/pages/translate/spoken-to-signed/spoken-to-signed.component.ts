import {Component} from '@angular/core';

@Component({
  selector: 'app-spoken-to-signed',
  templateUrl: './spoken-to-signed.component.html',
  styleUrls: ['./spoken-to-signed.component.scss'],
})
export class SpokenToSignedComponent {
  originalVideoFile: File | null = null;

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.originalVideoFile = input.files[0];
    }
  }
}
