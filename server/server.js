require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({dest: 'uploads/'});

ffmpeg.setFfmpegPath('ffmpeg/bin/ffmpeg.exe'); // Adjust the path as necessary for your installation

app.use(
  cors({
    origin: 'http://localhost:4200', // Allow requests from this origin
  })
);

async function query(filename) {
  const data = fs.readFileSync(filename);
  const fetch = (await import('node-fetch')).default; // Dynamic import of node-fetch
  const response = await fetch(
    'https://api-inference.huggingface.co/models/Baghdad99/saad-speech-recognition-hausa-audio-to-text',
    {
      headers: {
        Authorization: process.env.API_KEY,
      },
      method: 'POST',
      body: data,
    }
  );
  const result = await response.json();
  return result;
}

app.post('/mp3totext', upload.single('audio'), async (req, res) => {
  try {
    const audio = req.file;

    if (!audio) {
      console.error('No audio file uploaded');
      return res.status(400).send({message: 'No audio file uploaded'});
    }

    const text = await query(audio.path);
    console.log('Converted text:', text);
    res.json({text});
  } catch (error) {
    console.error('Error extracting audio:', error);
    res.status(500).send({message: 'Error extracting audio'});
  }
});

const extractAudio = videoFile => {
  return new Promise((resolve, reject) => {
    const outputStream = fs.createWriteStream(videoFile.path + '.mp3');

    ffmpeg()
      .input(videoFile.path)
      .output(outputStream)
      .outputFormat('mp3')
      .on('end', () => {
        console.log('Conversion finished!');
        resolve(videoFile.path + '.mp3');
      })
      .on('error', err => {
        console.error('Error during conversion:', err);
        reject(err);
      })
      .run();
  });
};

app.post('/mp4tomp3', upload.single('video'), async (req, res) => {
  try {
    const video = req.file;

    if (!video) {
      console.error('No video file uploaded');
      return res.status(400).send({message: 'No video file uploaded'});
    }

    if (!video.mimetype.startsWith('video/')) {
      console.error('Invalid file type. Please upload an MP4 video.');
      return res.status(400).send({message: 'Invalid file type. Please upload an MP4 video.'});
    }

    const audioFilePath = await extractAudio(video);

    console.log(`Audio file path: ${audioFilePath}`);

    res.download(audioFilePath, err => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).send({message: 'Error downloading audio file'});
      } else {
        console.log('Audio file sent to client');
      }
    });
  } catch (error) {
    console.error('Error extracting audio:', error);
    res.status(500).send({message: 'Error extracting audio'});
  }
});

app.post('/overlay-video', upload.fields([{name: 'mainVideo'}, {name: 'overlayVideo'}]), (req, res) => {
  const mainVideoPath = req.files.mainVideo[0].path;
  const overlayVideoPath = req.files.overlayVideo[0].path;
  const outputVideoPath = path.join(__dirname, 'uploads', 'output_video.mp4');

  console.log(`Main video path: ${mainVideoPath}`);
  console.log(`Overlay video path: ${overlayVideoPath}`);
  console.log(`Output video path: ${outputVideoPath}`);

  ffmpeg(mainVideoPath)
    .addInput(overlayVideoPath)
    .complexFilter([
      {
        filter: 'overlay',
        options: {
          x: 'main_w-overlay_w-10',
          y: 'main_h-overlay_h-10',
        },
      },
    ])
    .on('end', () => {
      res.download(outputVideoPath, err => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).send('Error processing video');
        } else {
          console.log('Overlay video sent to client');
          fs.unlink(mainVideoPath, () => {});
          fs.unlink(overlayVideoPath, () => {});
          fs.unlink(outputVideoPath, () => {});
        }
      });
    })
    .on('error', err => {
      console.error('Error:', err.message);
      res.status(500).send('Error processing video');
      fs.unlink(mainVideoPath, () => {});
      fs.unlink(overlayVideoPath, () => {});
    })
    .save(outputVideoPath);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
