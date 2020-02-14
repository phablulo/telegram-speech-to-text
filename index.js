const fs = require('fs')
const request  = require('request')
const stb = require('stream-to-buffer')
const TelegramBot = require('node-telegram-bot-api')

if (process.argv.length < 5) {
  console.error('Usage: node index.js GOOLE_SPEECH_TO_TEXT_API_KEY TELEGRAM_BOT_KEY language')
  process.exit(1)
}
const [google_api_key, TELEGRAM_BOT_KEY, language] = process.argv.slice(2)
const bot = new TelegramBot(TELEGRAM_BOT_KEY, {polling: true})
let duration = 0


function streamToBuffer(stream) {
  return new Promise((rs, rj) =>
    stb(stream, (err, buff) => err ? rj(err) : rs(buff))
  )
}
async function toText(audio) {
  audio = {content: audio.toString('base64')}
  const config = {
    encoding: 'OGG_OPUS',
    sampleRateHertz: 16000,
    languageCode: language,
  }
  return new Promise((resolve, reject) =>
    request({
      method: 'POST',
      url: `https://speech.googleapis.com/v1/speech:recognize?key=${google_api_key}`,
      json: { audio, config }
    }, (err, response, body) => {
      if (err) return reject(err)
      if (response.statusCode !== 200) return reject(new Error('Status Code: '+response.statusCode))
      return resolve(body.results.map(result => result.alternatives[0].transcript).join('\n'))
    })
  )
}
bot.on('voice', msg => {
  const id = msg.chat.id
  console.log('Received message with duration '+msg.voice.duration+'s')
  console.log('Total duration: '+(duration += msg.voice.duration))
  if (duration >= 3600) {
    return bot.sendMessage(id, 'Yo, I\'ve exceeded my 60min quota :(', {reply_to_message_id: msg.message_id})
  }
  streamToBuffer(bot.getFileStream(msg.voice.file_id))
  .then(data => toText(data))
  .then(message => `.:TRANSCRIPTION:.\n\n${message}`)
  .then(message => message && bot.sendMessage(id, message, {reply_to_message_id: msg.message_id}))
  .catch(error => {
    bot.sendMessage(id, 'Tive erro!')
    bot.sendMessage(id, error.message || error.error || ''+error)
    if (error.stack) bot.sendMessage(id, error.stack)
    console.error(error)
  })
})
