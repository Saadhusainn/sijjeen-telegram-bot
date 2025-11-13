const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Bot token from environment variable
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Basic web server for health checks
app.get('/', (req, res) => {
  res.send('🤖 Sijjeen Telegram Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// ===== YOUR BOT CODE STARTS HERE =====
// (Paste all your bot code from the previous example here)
// Make sure to use the complete code with all the commands and handlers

bot.start((ctx) => {
    const welcomeText = `📚 *Welcome to Sijjeen Book Bot!* 

I'm your assistant for creating beautiful book collages with highlighting features from Sijjeen.

*Available Commands:*
/books - Browse available books
/upload - Upload your own PDF
/collage - Create a book collage
/help - Get help
/contact - Contact support`;

    ctx.reply(welcomeText, {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
            ['📚 Browse Books', '🖼️ Create Collage'],
            ['📤 Upload PDF', 'ℹ️ Help']
        ]).resize()
    });
});

// Add all your other command handlers here...
// /help, /contact, /books, etc.

// Error handling
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again or use /help for support.');
});

// Start bot
console.log('🚀 Starting Sijjeen Telegram Bot...');
bot.launch().then(() => {
    console.log('✅ Sijjeen Bot is running successfully!');
}).catch(err => {
    console.error('❌ Failed to start bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
