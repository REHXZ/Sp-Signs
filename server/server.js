require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  },
});

const upload = multer({storage: storage});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

ffmpeg.setFfmpegPath('ffmpeg/bin/ffmpeg.exe'); // Adjust the path as necessary for your installation

app.use(cors({origin: 'http://localhost:4200'})); // Allow requests from this origin
app.use(express.json()); // Add this middleware to parse JSON bodies

// Middleware to add COOP and COEP headers
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

async function query(filename) {
  const data = fs.readFileSync(filename);
  const fetch = (await import('node-fetch')).default;
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

    console.log(`Starting conversion for: ${videoFile.path}`); // Log file path

    ffmpeg()
      .input(videoFile.path)
      .output(outputStream)
      .outputFormat('mp3')
      .on('start', commandLine => {
        console.log('Spawned Ffmpeg with command: ' + commandLine); // Log the command being run
      })
      .on('progress', progress => {
        console.log(`Processing: ${progress.percent}% done`); // Log progress
      })
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

app.post('/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({message: 'No video file uploaded'});
  }

  const videoPath = req.file.path;
  res.send({videoPath: `/uploads/${path.basename(videoPath)}`});
});

app.post('/mp4tomp3', async (req, res) => {
  try {
    const {videoPath} = req.body;

    if (!videoPath || !videoPath.endsWith('.mp4')) {
      console.error('Invalid file format. Please upload MP4 videos.');
      return res.status(400).send({message: 'Invalid file format. Please upload MP4 videos.'});
    }

    const fullPath = path.join(__dirname, videoPath);

    console.log(`Received request to convert video: ${fullPath}`); // Log the received request

    if (!fs.existsSync(fullPath)) {
      console.error('File does not exist:', fullPath);
      return res.status(400).send({message: 'File does not exist'});
    }

    const audioFilePath = await extractAudio({path: fullPath});

    console.log(`Audio file path: ${audioFilePath}`); // Log the audio file path

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

app.get('/download-video', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.status(400).send({message: 'No video URL provided'});
    }

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const filePath = path.join(__dirname, 'uploads', 'signLanguage.mp4');
    fs.writeFileSync(filePath, buffer);

    res.json({filePath: filePath});
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).send({message: 'Error fetching video', error: error.message});
  }
});

app.post('/overlay-video', upload.fields([{name: 'mainVideo'}, {name: 'overlayVideo'}]), (req, res) => {
  const mainVideoPath = req.files.mainVideo[0].path;
  const overlayVideoPath = req.files.overlayVideo[0].path;
  const outputVideoPath = path.join(__dirname, 'uploads', 'output_video-' + Date.now() + '.mp4');

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
