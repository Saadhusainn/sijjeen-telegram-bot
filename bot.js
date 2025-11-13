const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

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

// Create temp directory for collage processing
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

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

// PDF to Image conversion (simplified - in production you'd use pdf2pic or similar)
async function convertPDFToImages(pdfUrl, pages) {
    // This is a simplified version - in production you'd use a proper PDF processing library
    // For demo purposes, we'll create mock images
    console.log(`Converting PDF pages: ${pages} from ${pdfUrl}`);
    
    const images = [];
    for (const page of pages) {
        // Create a mock image for each page
        const canvas = createCanvas(800, 1200);
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 800, 1200);
        
        // Page border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, 700, 1100);
        
        // Page content mock
        ctx.fillStyle = '#333';
        ctx.font = 'bold 40px Arial';
        ctx.fillText(`Page ${page}`, 350, 200);
        
        ctx.font = '20px Arial';
        ctx.fillText('Book Page Preview', 320, 250);
        ctx.fillText('Actual PDF content would appear here', 250, 300);
        
        // Convert to buffer
        const buffer = canvas.toBuffer('image/jpeg');
        images.push(buffer);
    }
    
    return images;
}

// Create collage from images
async function createCollage(images, layout = '2x2') {
    const [rows, cols] = layout.split('x').map(Number);
    const imageWidth = 800;
    const imageHeight = 1200;
    
    const collageWidth = imageWidth * cols;
    const collageHeight = imageHeight * rows;
    
    const canvas = createCanvas(collageWidth, collageHeight);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, collageWidth, collageHeight);
    
    // Arrange images in grid
    for (let i = 0; i < images.length && i < rows * cols; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = col * imageWidth;
        const y = row * imageHeight;
        
        try {
            const img = await loadImage(images[i]);
            ctx.drawImage(img, x, y, imageWidth, imageHeight);
            
            // Add border between images
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, imageWidth, imageHeight);
        } catch (error) {
            console.error('Error drawing image:', error);
        }
    }
    
    return canvas.toBuffer('image/jpeg');
}

// Parse page range input
function parsePageInput(input, maxPages = 100) {
    const pages = new Set();
    const parts = input.split(',');
    
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (start && end && start <= end) {
                for (let i = start; i <= Math.min(end, maxPages); i++) {
                    pages.add(i);
                }
            }
        } else {
            const page = parseInt(part);
            if (page && page <= maxPages) {
                pages.add(page);
            }
        }
    }
    
    return Array.from(pages).sort((a, b) => a - b);
}

// Bot commands
bot.start((ctx) => {
  const welcomeText = `📚 *Welcome to Sijjeen Book Bot!* 

I can help you search Islamic books and create custom page collages.

*Available Commands:*
/search - Search for books by name
/books - Browse all books  
/help - Get help
/contact - Contact support

*New Feature:* Create beautiful collages of book pages!`;

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

*How to create collages:*
1. Use /search to find a book
2. Select a book from results  
3. Choose "🖼️ Make Collage" option
4. Enter page numbers (e.g., 1-5,10,15)
5. Bot will create and send your collage preview
6. Click "📥 Get Final Collage" to receive high-quality version

*Page Input Examples:*
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

  // Handle page number input for collage
  if (session && session.state === 'awaiting_collage_pages') {
    const pageInput = text.trim();
    const book = session.selectedBook;
    
    try {
      // Parse page numbers
      const pages = parsePageInput(pageInput, 50); // Limit to 50 pages for collage
      
      if (pages.length === 0) {
        ctx.reply('❌ Invalid page numbers. Please use format like: 1-5,10,15');
        return;
      }
      
      if (pages.length > 16) {
        ctx.reply('❌ Maximum 16 pages allowed for collage. Please select fewer pages.');
        return;
      }
      
      // Show processing message
      const processingMsg = await ctx.reply('🔄 Creating your collage... This may take a moment.');
      
      // Get file URL (for single books or first volume of multi books)
      let fileUrl;
      if (book.type === 'single') {
        fileUrl = book.file;
      } else {
        fileUrl = book.volumes[0].file; // Use first volume for multi-volume books
      }
      
      // Convert PDF pages to images (simplified - in production use proper PDF library)
      const pageImages = await convertPDFToImages(fileUrl, pages);
      
      // Determine collage layout based on number of pages
      let layout;
      if (pages.length <= 4) layout = '2x2';
      else if (pages.length <= 9) layout = '3x3';
      else layout = '4x4';
      
      // Create collage
      const collageBuffer = await createCollage(pageImages, layout);
      
      // Save collage info to session for final download
      const collageId = Date.now().toString();
      const collagePath = path.join(tempDir, `${collageId}.jpg`);
      fs.writeFileSync(collagePath, collageBuffer);
      
      userSessions.set(userId, {
        ...session,
        collageId: collageId,
        collagePath: collagePath,
        selectedPages: pages
      });
      
      // Send preview with download button
      await ctx.deleteMessage(processingMsg.message_id);
      
      await ctx.replyWithPhoto(
        { source: collageBuffer },
        {
          caption: `🖼️ *Collage Preview for ${book.name}*\n\n📄 Pages: ${pages.join(', ')}\n\nClick the button below to get the high-quality collage file:`,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📥 Get Final Collage', `download_collage_${collageId}`)],
            [Markup.button.callback('🔄 Create New Collage', `select_book_${allBooks.indexOf(book)}`)]
          ])
        }
      );
      
      // Update session state
      userSessions.set(userId, { 
        ...session, 
        state: 'collage_ready',
        collageId: collageId,
        collagePath: collagePath 
      });
      
    } catch (error) {
      console.error('Collage creation error:', error);
      ctx.reply('❌ Error creating collage. Please try again with different pages.');
      userSessions.delete(userId);
    }
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

// Handle book selection - NEW: Show options menu
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
  
  bookInfo += `\n*Choose an option:*`;
  
  const keyboard = [
    [Markup.button.callback('📥 Download Book', `download_full_${bookIndex}`)],
    [Markup.button.callback('👀 View Book Info', `view_info_${bookIndex}`)],
    [Markup.button.callback('🖼️ Make Collage', `make_collage_${bookIndex}`)]
  ];

  ctx.editMessageText(bookInfo, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(keyboard)
  });
});

// Handle download full book
bot.action(/download_full_(\d+)/, (ctx) => {
  const bookIndex = parseInt(ctx.match[1]);
  const book = allBooks[bookIndex];
  
  if (!book) {
    ctx.reply('❌ Book not found.');
    return;
  }

  if (book.type === 'single') {
    ctx.editMessageText(`📚 *Downloading:* ${book.name}\n\n[Click here to download](${book.file})`, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
      ...Markup.inlineKeyboard([
        [Markup.button.url('📥 Download Book', book.file)],
        [Markup.button.callback('⬅️ Back to Options', `select_book_${bookIndex}`)]
      ])
    });
  } else {
    const volumeKeyboard = book.volumes.map(volume => [
      Markup.button.callback(
        `📖 ${volume.name}`,
        `download_volume_${bookIndex}_${book.volumes.indexOf(volume)}`
      )
    ]);

    volumeKeyboard.push([Markup.button.callback('⬅️ Back to Options', `select_book_${bookIndex}`)]);

    ctx.editMessageText(`📁 *Book:* ${book.name}\n\nSelect a volume to download:`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(volumeKeyboard)
    });
  }
});

// Handle view book info
bot.action(/view_info_(\d+)/, (ctx) => {
  const bookIndex = parseInt(ctx.match[1]);
  const book = allBooks[bookIndex];
  
  if (!book) {
    ctx.reply('❌ Book not found.');
    return;
  }

  let bookInfo = `📚 *Book Details:* ${book.name}\n\n`;
  
  if (book.publisher) bookInfo += `🏢 *Publisher:* ${book.publisher}\n`;
  if (book.language) bookInfo += `🌐 *Language:* ${book.language}\n`;
  if (book.type) bookInfo += `📖 *Type:* ${book.type === 'single' ? 'Single Volume' : 'Multi-Volume'}\n`;
  
  if (book.type === 'multi' && book.volumes) {
    bookInfo += `\n📚 *Volumes:*\n`;
    book.volumes.forEach(volume => {
      bookInfo += `• ${volume.name}\n`;
    });
  }

  ctx.editMessageText(bookInfo, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back to Options', `select_book_${bookIndex}`)]
    ])
  });
});

// Handle make collage option
bot.action(/make_collage_(\d+)/, (ctx) => {
  const bookIndex = parseInt(ctx.match[1]);
  const book = allBooks[bookIndex];
  
  if (!book) {
    ctx.reply('❌ Book not found.');
    return;
  }

  const userId = ctx.from.id;
  userSessions.set(userId, {
    state: 'awaiting_collage_pages',
    selectedBook: book
  });

  ctx.editMessageText(`🖼️ *Create Collage for:* ${book.name}\n\n📝 *Enter page numbers:*\n\n*Examples:*\n• 1-5 (pages 1 to 5)\n• 1,3,5 (pages 1, 3, and 5)\n• 1-3,5,7-10 (mixed selection)\n\n*Note:* Maximum 16 pages allowed for collage.`, {
    parse_mode: 'Markdown',
    ...Markup.keyboard([['🚫 Cancel']]).resize()
  });
});

// Handle collage download
bot.action(/download_collage_([^_]+)/, async (ctx) => {
  const collageId = ctx.match[1];
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  
  if (!session || session.collageId !== collageId) {
    ctx.reply('❌ Collage not found or expired. Please create a new one.');
    return;
  }
  
  try {
    // Send the final collage as document (higher quality)
    await ctx.replyWithDocument(
      { source: session.collagePath },
      {
        caption: `🖼️ *Your Custom Collage*\n📚 Book: ${session.selectedBook.name}\n📄 Pages: ${session.selectedPages.join(', ')}\n\nEnjoy your collage! 🎨`,
        parse_mode: 'Markdown'
      }
    );
    
    // Clean up temp file
    try {
      fs.unlinkSync(session.collagePath);
    } catch (error) {
      console.error('Error deleting temp file:', error);
    }
    
    userSessions.delete(userId);
    
  } catch (error) {
    console.error('Error sending collage:', error);
    ctx.reply('❌ Error sending collage. Please try again.');
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

// Clean up temp files periodically
setInterval(() => {
  const now = Date.now();
  const files = fs.readdirSync(tempDir);
  
  files.forEach(file => {
    const filePath = path.join(tempDir, file);
    const stats = fs.statSync(filePath);
    
    // Delete files older than 1 hour
    if (now - stats.mtimeMs > 60 * 60 * 1000) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up temp file: ${file}`);
    }
  });
}, 30 * 60 * 1000); // Run every 30 minutes

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
