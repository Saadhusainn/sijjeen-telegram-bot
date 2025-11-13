const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

const bot = new Telegraf(BOT_TOKEN);

// Web server for Render
app.get('/', (req, res) => {
  res.send('🤖 Sijjeen Book Bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Web server running on port ${PORT}`);
});

// Store user sessions
const userSessions = new Map();

// Books database (will be loaded from external file)
let booksIndex = { single: [], multi: [] };
let allBooks = [];

// Load books from external file
async function loadBooksDatabase() {
    try {
        // Load from your GitHub raw URL
        const response = await axios.get('https://raw.githubusercontent.com/Saadhusainn/saadhusainn.github.io/refs/heads/main/books-index.js');
        
        // Extract the booksIndex object from the file content
        const fileContent = response.data;
        const booksMatch = fileContent.match(/const booksIndex = ({[\s\S]*?});/);
        
        if (booksMatch && booksMatch[1]) {
            booksIndex = eval(`(${booksMatch[1]})`);
            allBooks = [...booksIndex.single, ...booksIndex.multi];
            console.log(`✅ Loaded ${allBooks.length} books from database`);
        } else {
            console.log('❌ Could not parse books database');
        }
    } catch (error) {
        console.log('❌ Error loading books database:', error.message);
        // Fallback to empty database
        booksIndex = { single: [], multi: [] };
        allBooks = [];
    }
}

// Bot commands
bot.start((ctx) => {
  const welcomeText = `📚 *Welcome to Sijjeen Book Bot!* 

I can help you search Islamic books and create custom page selections.

*Available Commands:*
/search - Search for books by name
/books - Browse all books  
/help - Get help
/contact - Contact support

*Quick Start:* Use /search to find a book and create custom PDFs with selected pages!`;

  ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    ...Markup.keyboard([
      ['🔍 Search Books', '📚 Browse All'],
      ['🆘 Help', '📞 Contact']
    ]).resize()
  });
});

bot.help((ctx) => {
  const helpText = `*Sijjeen Bot Help*

*How to create custom PDFs:*
1. Use /search to find a book
2. Select a book from results  
3. Enter page numbers (e.g., 1-5,10,15)
4. Bot will create and send your custom PDF

*Examples:*
• "1-5" - Pages 1 to 5
• "1,3,5" - Pages 1, 3, and 5
• "1-3,5,7-10" - Mixed selection

*Commands:*
/search - Search books by name
/books - Show all books
/contact - Get support`;

  ctx.reply(helpText, { parse_mode: 'Markdown' });
});

bot.command('contact', (ctx) => {
  ctx.reply(`📞 *Contact Sijjeen Support*

*Telegram:* @DancingDinosaurs
*Instagram:* @sijjeen_
*Email:* sijjeen@proton.me

We're here to help you!`, { parse_mode: 'Markdown' });
});

// SEARCH COMMAND - Main feature
bot.command('search', (ctx) => {
  if (allBooks.length === 0) {
    ctx.reply('📚 Books database is still loading. Please try again in a moment.');
    return;
  }
  
  ctx.reply('🔍 *Enter book name to search:*', { 
    parse_mode: 'Markdown',
    ...Markup.keyboard([['🚫 Cancel']]).resize()
  });
  
  // Set user state to waiting for search term
  userSessions.set(ctx.chat.id, { state: 'awaiting_search' });
});

// BROWSE ALL BOOKS
bot.command('books', (ctx) => {
  if (allBooks.length === 0) {
    ctx.reply('📚 Books database is still loading. Please try again in a moment.');
    return;
  }

  // Show first 20 books with pagination
  const booksToShow = allBooks.slice(0, 20);
  const keyboard = booksToShow.map(book => [
    Markup.button.callback(
      `${book.type === 'multi' ? '📁' : '📄'} ${book.name}`,
      `select_book_${allBooks.indexOf(book)}`
    )
  ]);

  let message = `📚 *All Available Books (${allBooks.length} total):*\n\nShowing 1-20 of ${allBooks.length}`;
  
  if (allBooks.length > 20) {
    keyboard.push([Markup.button.callback('➡️ Next Page', 'books_page_2')]);
    message += '\n\nUse "Next Page" to see more books';
  }

  ctx.reply(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(keyboard)
  });
});

// Handle text messages for search
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.chat.id;
  const session = userSessions.get(userId);

  // Cancel action
  if (text === '🚫 Cancel') {
    userSessions.delete(userId);
    ctx.reply('❌ Action cancelled.', {
      ...Markup.removeKeyboard()
    });
    return;
  }

  // Handle search term
  if (session && session.state === 'awaiting_search') {
    const searchTerm = text.toLowerCase();
    const results = allBooks.filter(book => 
      book.name.toLowerCase().includes(searchTerm) ||
      (book.publisher && book.publisher.toLowerCase().includes(searchTerm)) ||
      (book.language && book.language.toLowerCase().includes(searchTerm))
    );

    if (results.length === 0) {
      ctx.reply('❌ No books found. Try different keywords or use /books to see all books.');
      userSessions.delete(userId);
      return;
    }

    // Show search results
    const keyboard = results.map(book => [
      Markup.button.callback(
        `${book.type === 'multi' ? '📁' : '📄'} ${book.name}`,
        `select_book_${allBooks.indexOf(book)}`
      )
    ]);

    ctx.reply(`🔍 *Found ${results.length} book(s):*`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(keyboard),
      ...Markup.removeKeyboard()
    });

    userSessions.delete(userId);
    return;
  }

  // Handle page number input
  if (session && session.state === 'awaiting_pages') {
    const pageInput = text.trim();
    
    // For now, we'll just send the file directly since PDF manipulation is complex
    // In a full implementation, you would extract pages here
    
    const book = session.selectedBook;
    
    if (book.type === 'single') {
      // For single books, send the file directly
      ctx.reply(`📚 *Book Selected:* ${book.name}\n\n📄 *Download Link:* [Click Here](${book.file})`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
    } else {
      // For multi-volume books, show volume selection
      const volumeKeyboard = book.volumes.map(volume => [
        Markup.button.callback(
          `📖 ${volume.name}`,
          `download_volume_${allBooks.indexOf(book)}_${book.volumes.indexOf(volume)}`
        )
      ]);

      ctx.reply(`📁 *Book Selected:* ${book.name}\n\nSelect a volume to download:`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(volumeKeyboard)
      });
    }

    userSessions.delete(userId);
    return;
  }

  // Handle button texts
  switch(text) {
    case '🔍 Search Books':
      ctx.reply('🔍 *Enter book name to search:*', { 
        parse_mode: 'Markdown',
        ...Markup.keyboard([['🚫 Cancel']]).resize()
      });
      userSessions.set(ctx.chat.id, { state: 'awaiting_search' });
      break;
    
    case '📚 Browse All':
      const keyboard = allBooks.slice(0, 20).map(book => [
        Markup.button.callback(
          `${book.type === 'multi' ? '📁' : '📄'} ${book.name}`,
          `select_book_${allBooks.indexOf(book)}`
        )
      ]);

      let browseMessage = `📚 *All Available Books (${allBooks.length} total):*\n\nShowing 1-20 of ${allBooks.length}`;
      
      if (allBooks.length > 20) {
        keyboard.push([Markup.button.callback('➡️ Next Page', 'books_page_2')]);
        browseMessage += '\n\nUse "Next Page" to see more books';
      }

      ctx.reply(browseMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboard)
      });
      break;
    
    case '🆘 Help':
      ctx.reply('Use /help for detailed instructions!');
      break;
    
    case '📞 Contact':
      ctx.reply('Use /contact to reach our support team!');
      break;
    
    default:
      if (!session) {
        ctx.reply('Use /search to find books or /help for instructions.');
      }
  }
});

// Handle book selection
bot.action(/select_book_(\d+)/, (ctx) => {
  const bookIndex = parseInt(ctx.match[1]);
  const book = allBooks[bookIndex];
  
  if (!book) {
    ctx.reply('❌ Book not found.');
    return;
  }

  let bookInfo = `📚 *Selected:* ${book.name}\n`;
  
  if (book.publisher) bookInfo += `🏢 *Publisher:* ${book.publisher}\n`;
  if (book.language) bookInfo += `🌐 *Language:* ${book.language}\n`;
  
  if (book.type === 'single') {
    bookInfo += `\n📄 *Single Volume Book*\n\n`;
    bookInfo += `Click the button below to download this book:`;
    
    ctx.editMessageText(bookInfo, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📥 Download Book', book.file)],
        [Markup.button.callback('🔍 Search Again', 'search_again')]
      ])
    });
  } else {
    bookInfo += `\n📁 *Multi-Volume Book*\n\n`;
    bookInfo += `Select a volume to download:`;
    
    const volumeKeyboard = book.volumes.map(volume => [
      Markup.button.callback(
        `📖 ${volume.name}`,
        `download_volume_${bookIndex}_${book.volumes.indexOf(volume)}`
      )
    ]);

    volumeKeyboard.push([Markup.button.callback('🔍 Search Again', 'search_again')]);

    ctx.editMessageText(bookInfo, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(volumeKeyboard)
    });
  }
});

// Handle volume download
bot.action(/download_volume_(\d+)_(\d+)/, (ctx) => {
  const bookIndex = parseInt(ctx.match[1]);
  const volumeIndex = parseInt(ctx.match[2]);
  const book = allBooks[bookIndex];
  
  if (!book || !book.volumes || !book.volumes[volumeIndex]) {
    ctx.reply('❌ Volume not found.');
    return;
  }

  const volume = book.volumes[volumeIndex];
  
  ctx.editMessageText(`📖 *Downloading:* ${book.name}\n📚 *Volume:* ${volume.name}\n\n[Click here to download](${volume.file})`, {
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
    ...Markup.inlineKeyboard([
      [Markup.button.url('📥 Download Volume', volume.file)],
      [Markup.button.callback('⬅️ Back to Book', `select_book_${bookIndex}`)]
    ])
  });

  // Send Telegram notification
  sendTelegramNotification(book.name, volume.name, 'Full Book', `${book.name}_${volume.name}.pdf`);
});

// Handle search again
bot.action('search_again', (ctx) => {
  ctx.editMessageText('🔍 *Enter book name to search:*', { 
    parse_mode: 'Markdown'
  });
  
  userSessions.set(ctx.chat.id, { state: 'awaiting_search' });
});

// Handle pagination
bot.action(/books_page_(\d+)/, (ctx) => {
  const page = parseInt(ctx.match[1]);
  const startIndex = (page - 1) * 20;
  const endIndex = startIndex + 20;
  const booksToShow = allBooks.slice(startIndex, endIndex);

  const keyboard = booksToShow.map(book => [
    Markup.button.callback(
      `${book.type === 'multi' ? '📁' : '📄'} ${book.name}`,
      `select_book_${allBooks.indexOf(book)}`
    )
  ]);

  // Add pagination controls
  const pagination = [];
  if (page > 1) {
    pagination.push(Markup.button.callback('⬅️ Previous', `books_page_${page - 1}`));
  }
  if (endIndex < allBooks.length) {
    pagination.push(Markup.button.callback('Next ➡️', `books_page_${page + 1}`));
  }
  
  if (pagination.length > 0) {
    keyboard.push(pagination);
  }

  ctx.editMessageText(`📚 *All Available Books (${allBooks.length} total):*\n\nShowing ${startIndex + 1}-${Math.min(endIndex, allBooks.length)} of ${allBooks.length}`, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(keyboard)
  });
});

// Telegram notification function
function sendTelegramNotification(bookName, volumeNum, pagesStr, filename) {
  const botToken = '8337207140:AAEYcvjIYPJIdgCNPi4Xy0N-fJbhHBpNuKc';
  const chatId = '1489034728';
  
  const message = `📥 New Book Download!\n\n📚 Book: ${bookName}\n🔢 Volume: ${volumeNum}\n📄 Selection: ${pagesStr}\n💾 File: ${filename}\n⏰ Time: ${new Date().toLocaleString()}`;
  
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  }).catch(error => {
    console.log('Telegram notification failed');
  });
}

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again or use /help for support.');
});

// Load books database on startup
loadBooksDatabase().then(() => {
  console.log('📚 Books database loaded successfully');
}).catch(err => {
  console.log('❌ Failed to load books database:', err);
});

// Start bot
bot.launch().then(() => {
  console.log('✅ Sijjeen Bot started successfully!');
}).catch(err => {
  console.error('❌ Bot failed to start:', err);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
