// LYD-53: sidecar minimo que implementa el contrato de API_AUDIO_CONVERTER
// que Evolution API ya espera (ver processAudio() en
// src/api/integrations/channel/meta/whatsapp.business.service.ts del fork):
// recibe el audio como multipart `file`, o como campo de texto `url`/`base64`
// dentro del mismo multipart (asi arma el FormData el fork), y lo convierte a
// ogg/opus mono 16kHz -- el unico formato que WhatsApp muestra como nota de
// voz real (burbuja compacta, forma de onda). Un mp3 tambien es reproducible
// para Meta, pero WhatsApp lo renderiza como adjunto de archivo generico (con
// nombre/extension visibles), no como nota de voz -- confirmado en produccion.
// Devuelve { audio: "<base64 ogg/opus>" }. Se escribe a medida en vez de
// asumir una imagen de terceros ya lista, para no depender de un origen no
// verificado.
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

// Mono, 16kHz, libopus -- espec de nota de voz de WhatsApp (Meta solo la
// renderiza como voice note con audio/ogg de codec opus; cualquier otro
// mimetype de audio, aunque reproducible, cae a adjunto de archivo generico).
function convertToVoiceNote(buffer) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const output = ffmpeg(Readable.from(buffer))
      .audioCodec('libopus')
      .audioChannels(1)
      .audioFrequency(16000)
      .toFormat('ogg')
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
    const ogg = await convertToVoiceNote(input);
    res.json({ audio: ogg.toString('base64') });
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : 'Error desconocido' });
  }
});

app.listen(PORT, () => {
  console.log(`lydia-audio-converter escuchando en :${PORT}`);
});
