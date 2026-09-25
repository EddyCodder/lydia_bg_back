// LYD-53: sidecar minimo que implementa el contrato de API_AUDIO_CONVERTER
// que Evolution API ya espera (ver processAudio() en
// src/api/integrations/channel/meta/whatsapp.business.service.ts del fork,
// no tocado por esto): recibe el audio como multipart `file`, o como campo
// de texto `url`/`base64` dentro del mismo multipart (asi es como el fork
// arma el FormData), lo convierte a mp3 con ffmpeg y devuelve
// { audio: "<base64 mp3>" }. Se escribe a medida en vez de asumir una imagen
// de terceros ya lista, para no depender de un origen no verificado.
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

const PORT = process.env.PORT || 4040;
const API_KEY = process.env.API_AUDIO_CONVERTER_KEY || '';

const app = express();
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage() });

function requireApiKey(req, res, next) {
  if (!API_KEY || req.header('apikey') !== API_KEY) {
    return res.status(401).json({ error: 'apikey invalida o ausente' });
  }
  next();
}

async function resolveInputBuffer(req) {
  if (req.file) return req.file.buffer;
  if (req.body.url) {
    const response = await axios.get(req.body.url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
  if (req.body.base64) return Buffer.from(req.body.base64, 'base64');
  throw new Error('Sin audio de entrada: se esperaba file, url o base64');
}

function convertToMp3(buffer) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const output = ffmpeg(Readable.from(buffer))
      .toFormat('mp3')
      .on('error', (err) => reject(new Error(`ffmpeg fallo: ${err.message}`)))
      .pipe();
    output.on('data', (chunk) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/process-audio', requireApiKey, upload.single('file'), async (req, res) => {
  try {
    const input = await resolveInputBuffer(req);
    const mp3 = await convertToMp3(input);
    res.json({ audio: mp3.toString('base64') });
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : 'Error desconocido' });
  }
});

app.listen(PORT, () => {
  console.log(`lydia-audio-converter escuchando en :${PORT}`);
});
