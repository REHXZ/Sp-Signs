# About Repository

Welcome to our repository!!! This repository will show you our prototype turning videos to sign language actions.


## Clone the Repository

1. Open Visual Studio Code (VSCode) on your local machine.

2. Click on the "Source Control" icon in the left sidebar (the icon looks like a branch).

3. Click on the "Clone Repository" button.

4. In the repository URL input field, enter https://github.com/REHXZ/SPSigns.

5. Choose a local directory where you want to clone the repository.

6. Click on the "Clone" button to start the cloning process.


## Set up

* Download ffmpeg (https://www.gyan.dev/ffmpeg/builds/) & set routing for ffmpeg file inside server.js

* Create .env file and include your API key for HuggingFace model (e.g. API_KEY = "Bearer your_api_key")

    - Place your .env file inside the "server" folder 

* Do remember to save after rerouting and placing your API key inside .env file


### Backend

1) Open your terminal and go to server directory (`cd server`)

2) `npm i` to install node modules

3) To start backend, `npm run dev`


### Frontend

1) `npm i` to install node modules

2) To start frontend, `npm start`


## How Website Works

1) Add your video using "Choose File" button (video should be in mp4 format)

2) Click "Convert"

3) Enjoy the sign language actions based on the transcript of the video!!!


## Credits


### Referenced

* Github Repository about Sign Language Translation: https://github.com/sign/translate?tab=readme-ov-file 


### API Used

* HuggingFace: https://huggingface.co/Baghdad99/saad-speech-recognition-hausa-audio-to-text
