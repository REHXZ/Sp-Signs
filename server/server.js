require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure the path to ffmpeg is correct
ffmpeg.setFfmpegPath('ffmpeg-2024-07-04-git-03175b587c-full_build/bin/ffmpeg.exe'); // Adjust the path as necessary for your installation

// Use cors middleware
app.use(cors({
  origin: 'http://localhost:4200', // Allow requests from this origin
}));

async function query(filename) {
  const data = fs.readFileSync(filename);
  const response = await fetch(
    "https://api-inference.huggingface.co/models/Baghdad99/saad-speech-recognition-hausa-audio-to-text",
    {
      headers: {
        Authorization: process.env.API_KEY
      },
      method: "POST",
      body: data
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
      return res.status(400).send({ message: 'No audio file uploaded' });
    }

    // Assuming audio is uploaded correctly and stored in 'audio.path'
    const text = await query(audio.path);
    console.log('Converted text:', text);
    res.json({ text });
  } catch (error) {
    console.error('Error extracting audio:', error);
    res.status(500).send({ message: 'Error extracting audio' });
  }
});

const extractAudio = (videoFile) => {
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
      .on('error', (err) => {
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
      return res.status(400).send({ message: 'No video file uploaded' });
    }

    if (!video.mimetype.startsWith('video/')) {
      console.error('Invalid file type. Please upload an MP4 video.');
      return res.status(400).send({ message: 'Invalid file type. Please upload an MP4 video.' });
    }

    const audioFilePath = await extractAudio(video);

    res.download(audioFilePath, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).send({ message: 'Error downloading audio file' });
      } else {
        console.log('Audio file sent to client');
        // Optionally, you can clean up the temporary video and audio files here
        // fs.unlinkSync(video.path);
        // fs.unlinkSync(audioFilePath);
      }
    });
  } catch (error) {
    console.error('Error extracting audio:', error);
    res.status(500).send({ message: 'Error extracting audio' });
  }
});

app.post('/overlay-video', upload.fields([{ name: 'mainVideo' }, { name: 'overlayVideo' }]), (req, res) => {
  const mainVideoPath = req.files.mainVideo[0].path;
  const overlayVideoPath = req.files.overlayVideo[0].path;
  const outputVideoPath = path.join(__dirname, 'uploads', 'output_video.mp4');

  ffmpeg(mainVideoPath)
    .addInput(overlayVideoPath)
    .complexFilter([
      {
        filter: 'overlay',
        options: {
          x: 'main_w-overlay_w',
          y: 'main_h-overlay_h'
        }
      }
    ])
    .on('end', () => {
      res.sendFile(outputVideoPath, err => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).send('Error processing video');
        }
        fs.unlink(mainVideoPath, () => {});
        fs.unlink(overlayVideoPath, () => {});
        fs.unlink(outputVideoPath, () => {});
      });
    })
    .on('error', (err) => {
      console.error('Error:', err.message);
      res.status(500).send('Error processing video');
      fs.unlink(mainVideoPath, () => {});
      fs.unlink(overlayVideoPath, () => {});
    })
    .save(outputVideoPath);
});

const PORT = process.env.PORT || 5000; // Set the port to 5000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
