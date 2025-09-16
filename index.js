/*
 * BERVIZ MD V1 🍁
 * BOT YANG DICIPTAKAN OLEH MARSELLNOTDEV  DIKEMAS DALAM BAHASA NODE JS DENGAN     SEBAGIAN FITUR YANG LUMAYAN BANYAK
 * THANK TO : * MARSELLNOTDEV ( # DEV)
                * GEBY ( # GIRLFRIEND )
 */
const { Telegraf, Markup, session } = require("telegraf");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const setting = require("./setting");
const { exec, execSync } = require("child_process");
const crypto = require("crypto");
const chalk = require("chalk");

// Load dari setting.js
const BOT_TOKEN = setting.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN belum diisi di setting.js");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ==== FILE STORAGE ====
const adminFile = path.join(__dirname, "./database/admin.json");
const premiumFile = path.join(__dirname, "./database/premium.json");
const limitFile = path.join(__dirname, "./database/limit.json");
const groupFile = path.join(__dirname, "./database/groupSettings.json");
const autoAiFile = "./database/autoAiGroups.json";


// Runtime
function formatRuntime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${days} Hari, ${hours} Jam, ${minutes} Menit, ${secs} Detik`;
}

const startTime = Math.floor(Date.now() / 1000); // Simpan waktu mulai bot

function getBotRuntime() {
  const now = Math.floor(Date.now() / 1000);
  return formatRuntime(now - startTime);
}

// Kecepatan Bot
function getSpeed() {
  const startTime = process.hrtime();
  return getBotSpeed(startTime); // Panggil fungsi yang sudah dibuat
}

// Kalau file belum ada, buat default []

if (!fs.existsSync(autoAiFile)) {
fs.writeFileSync(autoAiFile, JSON.stringify([]));
}

// Load data dari file

let autoAiGroups = JSON.parse(fs.readFileSync(autoAiFile, "utf8"));

// Fungsi untuk save autoAiGroups ke file

function saveAutoAiGroups() {
fs.writeFileSync(autoAiFile, JSON.stringify(autoAiGroups, null, 2));
}
// Tanggal Hari ini
function getCurrentDate() {
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return now.toLocaleDateString("id-ID", options); // Format: Senin, 6 Maret 2025
}

// FUNCTION GROUP FITUR 
// ==== GROUP SECURITY SYSTEM ====
function loadGroups() {
  if (!fs.existsSync(groupFile)) {
    fs.writeFileSync(groupFile, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(groupFile, "utf8"));
}

function saveGroups(data) {
  fs.writeFileSync(groupFile, JSON.stringify(data, null, 2));
}

let groupSettings = loadGroups();

function getGroupSettings(chatId) {
  if (!groupSettings[chatId]) {
    groupSettings[chatId] = {
      antilink: false,
      antispam: false,
      welcome: true,
      goodbye: true,
    };
    saveGroups(groupSettings);
  }
  return groupSettings[chatId];
}

// ==== ADMIN CHECK ====
async function isGroupAdmin(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

// Fungsi untuk API removebg
async function removeBgFromUrl(imageUrl) {
  const res = await axios.get(`https://api.zenzxz.my.id/tools/removebg?url=${encodeURIComponent(imageUrl)}`);
  if (!res.data || !res.data.status || !res.data.result) throw new Error("API gagal atau data tidak valid");
  return res.data.result;
}

// FUNCTION PREM DAN ADMIN 

function loadJson(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let adminData = loadJson(adminFile, { admins: [] });
let premiumData = loadJson(premiumFile, { premium: [] });

// ==== CHECKER ====
function isAdmin(userId) {
  return adminData.admins.includes(userId);
}

function isPremium(userId) {
  return premiumData.premium.includes(userId);
}

// ==== LIMIT SYSTEM DENGAN JSON ====
const LIMIT_PER_DAY = 5; // ganti sesuai kebutuhan

function loadLimits() {
  if (!fs.existsSync(limitFile)) {
    fs.writeFileSync(limitFile, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(limitFile, "utf8"));
}

function saveLimits(data) {
  fs.writeFileSync(limitFile, JSON.stringify(data, null, 2));
}

let userLimits = loadLimits();

function checkLimit(userId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (!userLimits[userId]) {
    userLimits[userId] = { count: 0, date: today };
    saveLimits(userLimits);
  }

  // reset kalau hari sudah ganti
  if (userLimits[userId].date !== today) {
    userLimits[userId] = { count: 0, date: today };
    saveLimits(userLimits);
  }

  return userLimits[userId];
}

function useLimit(userId) {
  const data = checkLimit(userId);
  data.count++;
  userLimits[userId] = data;
  saveLimits(userLimits);
}

// Simpan hasil pencarian per user
// key: userId -> { list: NormalizedVideo[], page: number }
const searchResults = new Map();

// Util: normalisasi item dari API search agar field konsisten
function normalizeSearchItem(it = {}) {
  // title
  const title =
    it.title || it.name || it.videoTitle || it.video_title || "Unknown";

  // channel / author
  const channel =
    it.channel ||
    it.author ||
    it.uploader ||
    it.owner ||
    it.channelName ||
    it.channel_name ||
    "Unknown";

  // duration
  const duration =
    it.duration ||
    it.timestamp ||
    it.length ||
    it.lengthText ||
    it.length_text ||
    it.duration_text ||
    "-";

  // image / thumbnail
  let image =
    it.image ||
    it.thumbnail ||
    it.thumb ||
    (Array.isArray(it.thumbnails) && it.thumbnails[0]?.url) ||
    (it.thumbnail?.url ? it.thumbnail.url : null);

  // url (link youtube)
  let url =
    it.url ||
    it.link ||
    it.permalink ||
    (it.videoId ? `https://www.youtube.com/watch?v=${it.videoId}` : null) ||
    (it.id ? `https://www.youtube.com/watch?v=${it.id}` : null);

  return { title, channel, duration, image, url };
}

// Util: ambil array hasil dari berbagai kemungkinan bentuk response
function extractResultsPayload(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.videos)) return data.videos;
  if (data.result && Array.isArray(data.result.videos)) return data.result.videos;
  return [];
}

// Start
// ====== Helper Function ======
function getBotRuntime() {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getCurrentDate() {
  return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

// ====== Users DB (simpan user yang start bot) ======
let users = new Set();
function saveUsers(set) {
  fs.writeFileSync("./database/users.json", JSON.stringify([...set], null, 2));
}

bot.use((ctx, next) => {
  if (ctx.callbackQuery) {
    console.log("DEBUG CALLBACK:", ctx.callbackQuery.data);
  }
  return next();
});

// ====== Start Command ======
bot.start(async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);

  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
        [
      { text: "ᴏᴡɴ ᴍᴇɴᴜ", callback_data: "ownmenu" },
      { text: "ꜰᴜɴ ᴍᴇɴᴜ", callback_data: "funmenu" },
      { text: "ᴛʜᴀɴᴋ ᴛᴏ", callback_data: "tqto" },
        ],
        [
      { text: "ᴛᴏᴏʟꜱ ᴍᴇɴᴜ", callback_data: "toolsmenu" },
      { text: "ꜱᴛᴀʟᴋ ᴍᴇɴᴜ", callback_data: "stalkmenu" },
      { text: "ᴀɪ ᴍᴇɴᴜ", callback_data: "aimenu" }
        ],
      [{ text: "ᴅᴏᴡɴ ᴍᴇɴᴜ", callback_data: "downmenu" }],
      [{ text: "ᴘʀɪᴍʙᴏɴ ᴍᴇɴᴜ", callback_data: "primbonmenu", }],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「 𝐈𝐧𝐟𝐨𝐫𝐦𝐚𝐭𝐢𝐨𝐧 𝐁𝐨𝐭 」──ⓘ</b>
<b>│▢ 𝙲𝚛𝚎𝚊𝚝𝚘𝚛: @marsellmawujadidev</b>
<b>│▢ 𝙱𝚘𝚝𝙽𝚊𝚖𝚎: 𝙱𝚎𝚛𝚟𝚒𝚣 𝙰𝚜𝚜𝚒𝚜𝚝𝚎𝚗</b>
<b>│▢ Vᴇʀsɪᴏɴ: 1.0</b>
<b>│▢ 𝙻𝚊𝚗𝚐𝚞𝚊𝚐𝚎: 𝙹𝚊𝚟𝚊 𝚂𝚌𝚛𝚒𝚙𝚝</b>
<b>│▢ 𝚁𝚞𝚗𝚝𝚒𝚖𝚎: ${runtime}</b>
<b>│▢ 𝚃𝚊𝚗𝚐𝚐𝚊𝚕: ${date}</b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('ownmenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐎𝐰𝐧 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /promote </b>
<b>│▢ /mute </b>
<b>│▢ /kick </b>
<b>│▢ /unmute </b>
<b>│▢ /addpremium </b>
<b>│▢ /delpremium </b>
<b>│▢ /listpremium</b>
<b>│▢ /addadmin </b>
<b>│▢ /deladmin </b>
<b>│▢ /listadmin</b>
<b>│▢ /antilink</b>
<b>│▢ /antispam</b>
<b>│▢ /welcome</b>
<b>│▢ /goodbye</b>
<b>│▢ /unpromote </b>
<b>│▢ /info </b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('funmenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐅𝐮𝐧 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /brat</b>
<b>│▢ /bratvid</b>
<b>│▢ /cekkhodam</b>
<b>│▢ /cektolol</b>
<b>│▢ /cekcantik</b>
<b>│▢ /cekganteng</b>
<b>│▢ /cekkontol</b>
<b>│▢ /cekmemek</b>
<b>│▢ /gombalan</b>
<b>│▢ /gombalin</b>
<b>│▢ /galau</b>
<b>│▢ /caklontong</b>
<b>│▢ /asahotak</b>
<b>│▢ /tebaklirik</b>
<b>│▢ /tebaklagu</b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('stalkmenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐒𝐭𝐚𝐥𝐤 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /igstalk </b>
<b>│▢ /ttstalk </b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('downmenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐃𝐨𝐰𝐧 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /ytmp3 </b>
<b>│▢ /ytmp4 </b>
<b>│▢ /yt </b>
<b>│▢ /spotify </b>
<b>│▢ /spotifydl_ </b>
<b>│▢ /ttdown </b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('aimenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐀𝐢 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /geby</b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('toolsmenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐓𝐨𝐨𝐥𝐬 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /tourl</b>
<b>│▢ /decodebase64</b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

bot.action('tqto', async (ctx) => {
 const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  // hilangkan loading di tombol
  await ctx.answerCbQuery();

  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ᴍʏ ɪɢ", url: "https://www.instagram.com/marszlmanurung_______" },
      { text: "ʜɪꜱ ɪɢ", url: "https://www.instagram.com/bel._sinaga" },
      { text: "ᴏᴡɴ ꜱᴄ", url: "https://t.me/marsellmawujadidev" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁

👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐓𝐡𝐚𝐧𝐤 𝐓𝐨 🍁 」──ⓘ</b>
<b>│▢ 𝗧𝘂𝗵𝗮𝗻 𝗬𝗺𝗲 ( 𝗚𝗼𝗱 )</b>
<b>│▢ 𝗠𝗮𝗿𝘀𝗲𝗹 𝗠𝗮𝗻𝘂𝗿𝘂𝗻𝗴 ( 𝗗𝗲𝘃 )</b>
<b>│▢ 𝗚𝗲𝗯𝘆 ( 𝗠𝘆 𝗚𝗶𝗿𝗹𝗳𝗿𝗶𝗲𝗻𝗱 )</b>
<b>│▢ 𝗔𝗹𝗹 𝗠𝘆 𝗙𝗿𝗶𝗲𝗻𝗱𝘀</b>
<b>┗───────────────────ⓘ</b>
</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }, 1000);
});

bot.action('primbonmenu', async (ctx) => {
  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak Diketahui";
  const chatId = ctx.from.id;
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  // simpan user
  users.add(ctx.from.id);
  saveUsers(users);
  await ctx.answerCbQuery();
  // typing action
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  const inlineKeyboard = [
    [
      { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "/backmenu_" },
    ],
  ];

  setTimeout(async () => {
    await ctx.replyWithPhoto("https://files.catbox.moe/cq0qc5.jpg", {
      caption: `<blockquote>𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡 🍁
      
👋 Halooo ${username}, saya adalah 𝗕𝗘𝗥𝗩𝗜𝗭 𝗔𝗦𝗦𝗜𝗦𝗧𝗘𝗡, yang siap membantu kamu dengan fitur yang disediakan oleh pencipta ku 

<b>┏─「  𝐏𝐫𝐢𝐦𝐛𝐨𝐧 𝐌𝐞𝐧𝐮 🍁 」──ⓘ</b>
<b>│▢ /zodiak </b>
<b>│▢ /artinama </b>
<b>│▢ /kecocokan</b>
<b>│▢ /tafsirmimpi </b>
<b>┗───────────────────ⓘ</b>

</blockquote>
      `,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  }, 1000);
});

// === Command /yt (YouTube Search dengan thumbnail + pagination) ===
bot.command("yt", async (ctx) => {
  try {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) return ctx.reply("❌ Masukkan judul atau link YouTube!");

    const searchUrl = `https://api.zenzxz.my.id/search/youtube?q=${encodeURIComponent(
      query
    )}`;

    const { data } = await axios.get(searchUrl);
    const rawList = extractResultsPayload(data);

    const list = rawList
      .map(normalizeSearchItem)
      .filter((v) => v && v.url); // harus punya url agar MP3/MP4 bisa jalan

    if (list.length === 0) return ctx.reply("❌ Tidak ada hasil.");

    const userId = ctx.from.id;
    searchResults.set(userId, { list, page: 0 });

    await sendSearchResult(ctx, userId, 0);
  } catch (err) {
    console.error("❌ Error /yt:", err?.response?.status || err.message);
    ctx.reply("⚠️ Terjadi error saat mencari video.");
  }
});

// Kirim 1 item hasil sesuai halaman
async function sendSearchResult(ctx, userId, page) {
  const store = searchResults.get(userId);
  if (!store) return ctx.reply("❌ Data pencarian tidak ditemukan.");
  const { list } = store;
  if (page < 0 || page >= list.length) return;

  const vid = list[page];

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("🎵 MP3", `ytmp3:${page}`),
      Markup.button.callback("🎥 MP4", `ytmp4:${page}`),
    ],
    [
      ...(page > 0 ? [Markup.button.callback("⬅️ Prev", `ytprev:${page - 1}`)] : []),
      ...(page < list.length - 1
        ? [Markup.button.callback("➡️ Next", `ytnext:${page + 1}`)]
        : []),
    ],
  ]);

  const caption = `
┏╼━━━━「  𝗬𝘁 𝗦𝗲𝗮𝗿𝗰𝗵 🍁 」━━━━━━━╾┓
╎🎬 *${vid.title}*\n
╎👤 Channel: ${vid.channel}\n
╎⏱ Duration: ${vid.duration}\n\n_${page + 1} dari ${list.length}_
┗╼━━━━━━━━━━━━━━━━━━━━━━╾┛
`;

  try {
    if (vid.image) {
      await ctx.replyWithPhoto({ url: vid.image }, { caption, parse_mode: "Markdown", ...keyboard });
    } else {
      await ctx.reply(caption, { parse_mode: "Markdown", ...keyboard });
    }
  } catch (e) {
    // fallback kalau thumbnail error
    await ctx.reply(caption, { parse_mode: "Markdown", ...keyboard });
  }
}

// === Handler tombol Next/Prev ===
bot.action(/ytnext:(\d+)/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1], 10);
    const store = searchResults.get(ctx.from.id);
    if (!store) return ctx.answerCbQuery("Data tidak ada.");
    store.page = page;
    await sendSearchResult(ctx, ctx.from.id, page);
    await ctx.answerCbQuery();
  } catch {}
});

bot.action(/ytprev:(\d+)/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1], 10);
    const store = searchResults.get(ctx.from.id);
    if (!store) return ctx.answerCbQuery("Data tidak ada.");
    store.page = page;
    await sendSearchResult(ctx, ctx.from.id, page);
    await ctx.answerCbQuery();
  } catch {}
});

// Helper ambil link download dari berbagai kemungkinan field
function pickDownloadUrl(obj = {}) {
  return (
    obj.downloadUrl ||
    obj.download_url ||
    obj.link ||
    obj.url ||
    obj.dl_link ||
    null
  );
}

// === Handler tombol MP3 ===
bot.action(/ytmp3:(\d+)/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1], 10);
    const vid = searchResults.get(ctx.from.id)?.list?.[page];
    if (!vid) return ctx.reply("❌ Data tidak ditemukan.");

    await ctx.reply("🎵 Sedang menyiapkan file MP3...");

    const apiUrl = `https://api.zenzxz.my.id/downloader/ytmp3?url=${encodeURIComponent(
      vid.url
    )}`;
    const { data } = await axios.get(apiUrl);

    const ok = data?.status ?? true; // beberapa API tidak pakai 'status'
    const dl = pickDownloadUrl(data?.result || data);

    if (!ok || !dl) return ctx.reply("❌ Gagal convert ke MP3.");

    await ctx.replyWithAudio(
      { url: dl },
      {
        title: (data.result && data.result.title) || vid.title || "Audio",
        performer:
          (data.result && (data.result.author || data.result.uploader)) ||
          vid.channel ||
          "Unknown",
      }
    );
  } catch (err) {
    console.error("❌ Error ytmp3:", err?.response?.status || err.message);
    ctx.reply("⚠️ Error saat download MP3.");
  }
});

// === Handler tombol MP4 ===
bot.action(/ytmp4:(\d+)/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1], 10);
    const vid = searchResults.get(ctx.from.id)?.list?.[page];
    if (!vid) return ctx.reply("❌ Data tidak ditemukan.");

    await ctx.reply("🎥 Sedang menyiapkan file MP4...");

    const apiUrl = `https://api.zenzxz.my.id/downloader/ytmp4?url=${encodeURIComponent(
      vid.url
    )}`;
    const { data } = await axios.get(apiUrl);

    const ok = data?.status ?? true;
    const dl = pickDownloadUrl(data?.result || data);

    if (!ok || !dl) return ctx.reply("❌ Gagal convert ke MP4.");

    await ctx.replyWithVideo(
      { url: dl },
      { caption: `🎬 ${((data.result && data.result.title) || vid.title || "Video")}` }
    );
  } catch (err) {
    console.error("❌ Error ytmp4:", err?.response?.status || err.message);
    ctx.reply("⚠️ Error saat download MP4.");
  }
});

// 📌 FITUR bratvid
bot.command("bratvid", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /bratvid haiii...");
  if (text.length > 100) return ctx.reply("⚠️ Karakter terbatas, max 100!");

  const tempDir = path.join(process.cwd(), "session");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const framePaths = [];

  try {
    // ambil frame per kata
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      const currentText = words.slice(0, i + 1).join(" ");
      const res = await axios
        .get(
          `https://api.zenzxz.my.id/maker/bratvid?text=${encodeURIComponent(
            currentText
          )}`,
          { responseType: "arraybuffer" }
        )
        .catch((e) => e.response);

      if (!res || !res.data) return ctx.reply("❌ Gagal ambil frame dari API");

      const framePath = path.join(tempDir, `frame${i}.mp4`);
      fs.writeFileSync(framePath, res.data);
      framePaths.push(framePath);
    }

    if (framePaths.length === 0) return ctx.reply("⚠️ Tidak ada frame dihasilkan.");

    // bikin file list buat concat
    const fileListPath = path.join(tempDir, "filelist.txt");
    let fileListContent = framePaths
      .map((frame) => `file '${frame}'\nduration 0.7`)
      .join("\n");
    fileListContent += `\nfile '${
      framePaths[framePaths.length - 1]
    }'\nduration 2`;
    fs.writeFileSync(fileListPath, fileListContent);

    // hasil video + stiker webm
    const outputVideoPath = path.join(tempDir, "output.mp4");
    const outputStickerPath = path.join(tempDir, "output.webm");

    // concat jadi video mp4
    execSync(
      `ffmpeg -y -f concat -safe 0 -i ${fileListPath} -vf "fps=30,format=yuv420p,scale=512:512:flags=lanczos" -c:v libx264 -preset ultrafast ${outputVideoPath}`,
      { stdio: "ignore" }
    );
    if (!fs.existsSync(outputVideoPath)) return ctx.reply("❌ Error bikin video.");

    // convert ke stiker WEBM animasi
    execSync(
      `ffmpeg -y -i ${outputVideoPath} -c:v libvpx-vp9 -b:v 1M -an -fs 2560k ${outputStickerPath}`,
      { stdio: "ignore" }
    );
    if (!fs.existsSync(outputStickerPath)) return ctx.reply("❌ Error bikin sticker.");

    // kirim stiker animasi
    await ctx.replyWithSticker({ source: outputStickerPath });

    // bersihkan file
    framePaths.forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
    [fileListPath, outputVideoPath, outputStickerPath].forEach((f) =>
      fs.existsSync(f) ? fs.unlinkSync(f) : null
    );
  } catch (e) {
    console.error(e);
    ctx.reply("❌ Terjadi kesalahan dalam proses.");
  }
});

bot.command("brat", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /brat marsell ganteng");

  await ctx.reply("⏳ Wait...");

  const imageUrl = `https://api.zenzxz.my.id/maker/brat?text=${encodeURIComponent(
    text
  )}`;
  const inputPath = path.join(__dirname, "temp_image.jpg");
  const outputPath = path.join(__dirname, "sticker.webp");

  try {
    // download gambar
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(inputPath, response.data);

    // convert ke sticker webp
    exec(
      `ffmpeg -y -i ${inputPath} -vf "scale=512:512:force_original_aspect_ratio=decrease" -c:v libwebp -lossless 1 -q:v 80 -preset default -an -vsync 0 ${outputPath}`,
      async (error) => {
        if (error) {
          console.error("❌ Gagal konversi:", error);
          return ctx.reply("❌ Gagal membuat stiker");
        }

        // kirim stiker
        await ctx.replyWithSticker({ source: outputPath });

        // hapus file sementara
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      }
    );
  } catch (err) {
    console.error("❌ Error:", err);
    ctx.reply("❌ Gagal membuat stiker");
  }
});

function escapeHTML(text = "") {
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

bot.command("igstalk", async (ctx) => {
  let text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /igstalk username");

  text = text.trim().replace(/\s+/g, "");
  if (!text) return ctx.reply("❌ Username tidak valid!");

  try {
    const res = await axios.get(
      `https://api.zenzxz.my.id/stalker/instagram?username=${encodeURIComponent(text)}`
    );

    const data = res.data;
    console.log("DEBUG IGSTALK:", data);

    if (!data || !data.result) {
      return ctx.reply("❌ Username tidak ditemukan atau API error!");
    }

    const user = data.result;

    let caption = `📸 <b>Instagram Stalker</b>\n\n`;
    caption += `👤 <b>Username:</b> ${escapeHTML(user.username) || "-"}\n`;
    caption += `📛 <b>Nickname:</b> ${escapeHTML(user.name || user.full_name) || "-"}\n`;
    caption += `🆔 <b>ID:</b> ${escapeHTML(user.id?.toString() || "-")}\n`;
    caption += `📝 <b>Bio:</b> ${escapeHTML(user.bio || user.biography || "-")}\n`;
    caption += `📌 <b>Posts:</b> ${user.posts || user.media_count || "0"}\n`;
    caption += `👥 <b>Followers:</b> ${user.followers || "0"}\n`;
    caption += `➡️ <b>Following:</b> ${user.following || "0"}\n`;
    caption += `🌍 <b>Website:</b> ${escapeHTML(user.external_url || "-")}\n`;
    caption += `✅ <b>Verified:</b> ${user.is_verified ? "Yes" : "No"}\n`;
    caption += `🔒 <b>Private:</b> ${user.is_private ? "Yes" : "No"}\n`;

    const photoUrl = user.profile_pic || user.profile_pic_url || null;

    if (photoUrl) {
      await ctx.replyWithPhoto(
        { url: photoUrl },
        { caption, parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(caption, { parse_mode: "HTML" });
    }
  } catch (e) {
    console.error("❌ IGSTALK Error:", e.message);
    ctx.reply("❌ Gagal mengambil data Instagram (mungkin API down).");
  }
});


bot.command("ttstalk", async (ctx) => {
  let text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /ttstalk username");

  text = text.trim().replace(/\s+/g, "");
  if (!text) return ctx.reply("❌ Username tidak valid!");

  try {
    const res = await axios.get(
      `https://api.zenzxz.my.id/stalker/tiktok?username=${encodeURIComponent(text)}`
    );

    const data = res.data;

    // 🔍 DEBUG supaya tahu struktur API
    console.log("RAW DATA:", JSON.stringify(data, null, 2));

    if (!data || !data.result) {
      return ctx.reply("❌ Username tidak ditemukan atau API error!");
    }

    // user info (kadang ada di result.user, kadang di result langsung)
    const user = data.result.user || data.result || {};

    // ambil stats (cek di user.stats, user.statsV2, atau data.result.stats)
    const stats = user.stats || user.statsV2 || data.result.stats || {};

    // fungsi escape biar aman ditampilkan
    const escapeHTML = (str = "") =>
      str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // caption yang bakal dikirim
    let caption = `🎵 <b>TikTok Stalker</b>\n\n`;
    caption += `👤 <b>Username:</b> ${escapeHTML(user.uniqueId || "-")}\n`;
    caption += `📛 <b>Nickname:</b> ${escapeHTML(user.nickname || "-")}\n`;
    caption += `🆔 <b>ID:</b> ${escapeHTML(user.id?.toString() || "-")}\n`;
    caption += `📝 <b>Bio:</b> ${escapeHTML(user.signature || "-")}\n\n`;

    // statistik
    caption += `🎥 <b>Videos:</b> ${stats.videoCount || stats.video_count || "0"}\n`;
    caption += `👥 <b>Followers:</b> ${stats.followerCount || stats.fans || "0"}\n`;
    caption += `➡️ <b>Following:</b> ${stats.followingCount || stats.following || "0"}\n`;
    caption += `❤️ <b>Hearts:</b> ${stats.heart || stats.heartCount || stats.likes || "0"}\n`;
    caption += `👫 <b>Friends:</b> ${stats.friendCount || stats.friends || "0"}\n`;
    caption += `✅ <b>Verified:</b> ${user.verified ? "Yes" : "No"}\n`;

    // ambil foto profil
    const photoUrl =
      user.avatarLarger || user.avatarMedium || user.avatarThumb || null;

    if (photoUrl) {
      await ctx.replyWithPhoto({ url: photoUrl }, { caption, parse_mode: "HTML" });
    } else {
      await ctx.reply(caption, { parse_mode: "HTML" });
    }
  } catch (e) {
    console.error("❌ TTSTALK Error:", e.message);
    ctx.reply("❌ Gagal mengambil data TikTok (mungkin API down).");
  }
});


// 🔥 Command khusus: /geby

// Escape untuk Markdown biar aman
function escapeMarkdown(text) {
  return text
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/`/g, "\\`");
}

bot.command("geby", async (ctx) => {
  const userText = ctx.message?.text?.split(" ").slice(1).join(" ") || "";
  if (!userText) return ctx.reply("Contoh: /geby Hai apa kabar?");

  try {
    const systemPrompt =
      "Kamu adalah Geby, AI cewek imut yang suka menjawab manja, genit, singkat, kadang bercanda. Gunakan bahasa gaul anak muda Indonesia, jangan formal. Selalu jawab pertanyaan user dengan gaya Geby.";

    const finalPrompt = `${systemPrompt}\n\nUser: ${userText}\nGeby:`;

    const url = `https://api.zenzxz.my.id/ai/gpt4o?prompt=${encodeURIComponent(finalPrompt)}`;
    const res = await axios.get(url, { timeout: 15000 });
    const d = res.data;

    console.log("🔥 DEBUG raw response:", d);

    // Helper: cari string jawaban di dalam response (robust untuk berbagai struktur)
    function extractText(obj) {
      if (obj == null) return null;

      if (typeof obj === "string") {
        const s = obj.trim();
        // jika string berisi JSON, coba parse
        if ((s.startsWith("{") || s.startsWith("[")) && s.length > 0) {
          try {
            return extractText(JSON.parse(s));
          } catch (e) {
            // bukan JSON, lanjut return string
          }
        }
        return s || null;
      }

      if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

      if (Array.isArray(obj)) {
        for (const el of obj) {
          const t = extractText(el);
          if (t) return t;
        }
      } else if (typeof obj === "object") {
        // cek key umum dulu
        const keys = ["reply", "response", "result", "output", "text", "content", "data", "answer", "message", "choices"];
        for (const k of keys) {
          if (k in obj) {
            const t = extractText(obj[k]);
            if (t) return t;
          }
        }
        // fallback: periksa semua nilai object
        for (const val of Object.values(obj)) {
          const t = extractText(val);
          if (t) return t;
        }
      }

      return null;
    }

    let aiResponse = extractText(d);

    // kalau gak dapet apa-apa, kasih fallback
    if (!aiResponse) aiResponse = "Maaf, respon API tidak bisa dibaca.";

    // Hapus intro berulang seperti "Hai, aku Geby ..." supaya jawaban lebih to the point
    aiResponse = aiResponse
      .replace(/^\s*(hi|hai|halo|hei)[^\n]{0,60}geby[:,.\s\-]*/i, "")
      .replace(/^\s*(aku|saya)\s+geby[:,.\s\-]*/i, "")
      .trim();

    // Kalau setelah hapus jadi kosong, kembalikan original extract (jaga-jaga)
    if (!aiResponse) {
      aiResponse = extractText(d) || "Maaf, respon API tidak bisa dibaca.";
    }

    await ctx.reply(aiResponse, { reply_to_message_id: ctx.message.message_id });
  } catch (err) {
    console.error("❌ Error API:", err?.response?.data || err?.message || err);
    await ctx.reply("Ups! Geby lagi error atau API down 😢");
  }
});

// Tambah premium
bot.command("addpremium", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Kamu bukan admin!");
  if (!userId) return ctx.reply("❌ Contoh: /addpremium 123456789");

  const uid = parseInt(userId);
  if (!premiumData.premium.includes(uid)) {
    premiumData.premium.push(uid);
    saveJson(premiumFile, premiumData);
  }
  ctx.reply(`✅ User ${uid} ditambahkan ke premium.`);
});

// Hapus premium
bot.command("delpremium", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Kamu bukan admin!");
  if (!userId) return ctx.reply("❌ Contoh: /delpremium 123456789");

  const uid = parseInt(userId);
  premiumData.premium = premiumData.premium.filter((id) => id !== uid);
  saveJson(premiumFile, premiumData);

  ctx.reply(`✅ User ${uid} dihapus dari premium.`);
});

// List premium
bot.command("listpremium", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Kamu bukan admin!");
  if (premiumData.premium.length === 0) return ctx.reply("⚠️ Belum ada user premium.");
  ctx.reply("👑 Premium Users:\n" + premiumData.premium.map((id) => `- ${id}`).join("\n"));
});

// Tambah admin
bot.command("addadmin", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Kamu bukan admin!");
  if (!userId) return ctx.reply("❌ Contoh: /addadmin 123456789");

  const uid = parseInt(userId);
  if (!adminData.admins.includes(uid)) {
    adminData.admins.push(uid);
    saveJson(adminFile, adminData);
  }
  ctx.reply(`✅ User ${uid} ditambahkan sebagai admin.`);
});

// Hapus admin
bot.command("deladmin", (ctx) => {
  const userId = ctx.message.text.split(" ")[1];
  if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Kamu bukan admin!");
  if (!userId) return ctx.reply("❌ Contoh: /deladmin 123456789");

  const uid = parseInt(userId);
  adminData.admins = adminData.admins.filter((id) => id !== uid);
  saveJson(adminFile, adminData);

  ctx.reply(`✅ User ${uid} dihapus dari admin.`);
});

// List admin
bot.command("listadmin", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("❌ Kamu bukan admin!");
  if (adminData.admins.length === 0) return ctx.reply("⚠️ Belum ada admin.");
  ctx.reply("🛠 Admins:\n" + adminData.admins.map((id) => `- ${id}`).join("\n"));
});

// ==== SETTINGS COMMAND ====
bot.command("settings", async (ctx) => {
  if (!(await isGroupAdmin(ctx))) return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");

  const settings = getGroupSettings(ctx.chat.id);

  let text = `⚙️ *Pengaturan Grup*\n\n`;
  text += `🔗 Anti-link: ${settings.antilink ? "✅ ON" : "❌ OFF"}\n`;
  text += `🤖 Anti-spam: ${settings.antispam ? "✅ ON" : "❌ OFF"}\n`;
  text += `👋 Welcome: ${settings.welcome ? "✅ ON" : "❌ OFF"}\n`;
  text += `🚪 Goodbye: ${settings.goodbye ? "✅ ON" : "❌ OFF"}\n\n`;
  text += `Gunakan: /antilink, /antispam, /welcome, /goodbye untuk toggle.`;

  ctx.reply(text, { parse_mode: "Markdown" });
});

// ==== TOGGLE COMMANDS ====
["antilink", "antispam", "welcome", "goodbye"].forEach((cmd) => {
  bot.command(cmd, async (ctx) => {
    if (!(await isGroupAdmin(ctx))) return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");

    const settings = getGroupSettings(ctx.chat.id);
    settings[cmd] = !settings[cmd];
    saveGroups(groupSettings);

    ctx.reply(`✅ ${cmd} sekarang: ${settings[cmd] ? "ON" : "OFF"}`);
  });
});

// ==== ANTI-LINK ====
bot.on("message", async (ctx, next) => {
  const settings = getGroupSettings(ctx.chat.id);
  if (settings.antilink && ctx.chat.type.endsWith("group")) {
    const text = ctx.message.text || "";
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    const whitelist = ["youtube.com", "youtu.be", "t.me"];

    if (linkRegex.test(text)) {
      const allowed = whitelist.some((w) => text.includes(w));
      if (!allowed) {
        try {
          await ctx.deleteMessage();
          return ctx.reply(`⚠️ @${ctx.from.username || ctx.from.id} link tidak diizinkan!`);
        } catch (e) {
          console.error("Gagal hapus pesan:", e.message);
        }
      }
    }
  }
  return next();
});

// ==== ANTI-SPAM ====
const spamTracker = {}; // {userId: {count, lastTime}}

bot.on("message", async (ctx, next) => {
  const settings = getGroupSettings(ctx.chat.id);
  if (settings.antispam && ctx.chat.type.endsWith("group")) {
    const userId = ctx.from.id;
    const now = Date.now();

    if (!spamTracker[userId]) {
      spamTracker[userId] = { count: 1, lastTime: now };
    } else {
      const diff = now - spamTracker[userId].lastTime;
      if (diff < 5000) {
        spamTracker[userId].count++;
      } else {
        spamTracker[userId].count = 1;
      }
      spamTracker[userId].lastTime = now;

      if (spamTracker[userId].count > 5) {
        try {
          await ctx.restrictChatMember(userId, { permissions: { can_send_messages: false } });
          ctx.reply(`🚫 @${ctx.from.username || userId} dibatasi karena spam!`);
          spamTracker[userId].count = 0;
        } catch (e) {
          console.error("Gagal restrict user:", e.message);
        }
      }
    }
  }
  return next();
});

// ==== WELCOME & GOODBYE ====
bot.on("new_chat_members", (ctx) => {
  const settings = getGroupSettings(ctx.chat.id);
  if (settings.welcome) {
    ctx.reply(`👋 Selamat datang ${ctx.message.new_chat_members.map((u) => u.first_name).join(", ")} di grup ${ctx.chat.title}!`);
  }
});

bot.on("left_chat_member", (ctx) => {
  const settings = getGroupSettings(ctx.chat.id);
  if (settings.goodbye) {
    ctx.reply(`🚪 ${ctx.message.left_chat_member.first_name} telah keluar dari grup.`);
  }
});

// ==== KICK USER ====
bot.command("kick", async (ctx) => {
  if (!(await isGroupAdmin(ctx))) {
    return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");
  }

  let targetId;
  const args = ctx.message.text.split(" ").slice(1);

  if (ctx.message.reply_to_message) {
    // kalau pakai reply
    targetId = ctx.message.reply_to_message.from.id;
  } else if (args[0]) {
    // kalau pakai id manual
    targetId = parseInt(args[0]);
  } else {
    return ctx.reply("❌ Contoh: /kick  atau reply pesan user.");
  }

  try {
    await ctx.kickChatMember(targetId);
    ctx.reply(`✅ User ${targetId} berhasil di-kick dari grup.`);
  } catch (e) {
    console.error("Kick gagal:", e.message);
    ctx.reply("⚠️ Gagal kick user (mungkin bot bukan admin / tidak punya izin).");
  }
});

// ==== PROMOTE USER ====
bot.command("promote", async (ctx) => {
  if (!(await isGroupAdmin(ctx))) {
    return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");
  }

  let targetId;
  const args = ctx.message.text.split(" ").slice(1);

  if (ctx.message.reply_to_message) {
    targetId = ctx.message.reply_to_message.from.id;
  } else if (args[0]) {
    targetId = parseInt(args[0]);
  } else {
    return ctx.reply("❌ Contoh: /promote  atau reply pesan user.");
  }

  try {
    await ctx.promoteChatMember(targetId, {
      can_change_info: true,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_promote_members: false, // jangan kasih promote full biar aman
    });

    ctx.reply(`✅ User ${targetId} berhasil dipromosikan jadi admin.`);
  } catch (e) {
    console.error("Promote gagal:", e.message);
    ctx.reply("⚠️ Gagal promote user (bot harus admin dengan izin promote).");
  }
});

// ==== UNPROMOTE USER ====
bot.command("unpromote", async (ctx) => {
  if (!(await isGroupAdmin(ctx))) {
    return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");
  }

  let targetId;
  const args = ctx.message.text.split(" ").slice(1);

  if (ctx.message.reply_to_message) {
    targetId = ctx.message.reply_to_message.from.id;
  } else if (args[0]) {
    targetId = parseInt(args[0]);
  } else {
    return ctx.reply("❌ Contoh: /unpromote  atau reply pesan user.");
  }

  try {
    await ctx.promoteChatMember(targetId, {
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false,
    });

    ctx.reply(`✅ User ${targetId} berhasil dicabut dari admin.`);
  } catch (e) {
    console.error("Unpromote gagal:", e.message);
    ctx.reply("⚠️ Gagal unpromote user (bot harus admin dengan izin promote).");
  }
});

// ==== Helper parse waktu ====
function parseDuration(str) {
  const match = /^(\d+)([smhd])$/.exec(str);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  let ms = 0;
  if (unit === "s") ms = num * 1000;
  if (unit === "m") ms = num * 60 * 1000;
  if (unit === "h") ms = num * 60 * 60 * 1000;
  if (unit === "d") ms = num * 24 * 60 * 60 * 1000;
  return ms;
}

// ==== MUTE USER ====
bot.command("mute", async (ctx) => {
  if (!(await isGroupAdmin(ctx))) {
    return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");
  }

  const args = ctx.message.text.split(" ").slice(1);
  let targetId;
  let duration;

  if (ctx.message.reply_to_message) {
    targetId = ctx.message.reply_to_message.from.id;
    if (args[0]) duration = parseDuration(args[0]);
  } else if (args[0]) {
    targetId = parseInt(args[0]);
    if (args[1]) duration = parseDuration(args[1]);
  } else {
    return ctx.reply("❌ Contoh:\n/mute  [1h]\natau reply pesan: /mute 10m");
  }

  try {
    if (duration) {
      const until = Math.floor((Date.now() + duration) / 1000); // dalam detik
      await ctx.restrictChatMember(targetId, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        },
        until_date: until,
      });
      ctx.reply(`🔇 User ${targetId} berhasil di-mute selama ${args[1] || args[0]}.`);
    } else {
      await ctx.restrictChatMember(targetId, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        },
      });
      ctx.reply(`🔇 User ${targetId} berhasil di-mute (tanpa batas waktu).`);
    }
  } catch (e) {
    console.error("Mute gagal:", e.message);
    ctx.reply("⚠️ Gagal mute user (bot harus admin dengan izin restrict).");
  }
});

// ==== UNMUTE USER ====
bot.command("unmute", async (ctx) => {
  if (!(await isGroupAdmin(ctx))) {
    return ctx.reply("❌ Hanya admin grup yang bisa pakai perintah ini.");
  }

  const args = ctx.message.text.split(" ").slice(1);
  let targetId;

  if (ctx.message.reply_to_message) {
    targetId = ctx.message.reply_to_message.from.id;
  } else if (args[0]) {
    targetId = parseInt(args[0]);
  } else {
    return ctx.reply("❌ Contoh: /unmute  atau reply pesan user.");
  }

  try {
    await ctx.restrictChatMember(targetId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      },
    });
    ctx.reply(`🔊 User ${targetId} berhasil di-unmute (boleh chat lagi).`);
  } catch (e) {
    console.error("Unmute gagal:", e.message);
    ctx.reply("⚠️ Gagal unmute user (bot harus admin dengan izin restrict).");
  }
});


// ==== CEK KHODAM ====
bot.command("cekkhodam", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply(`❌ Contoh: /cekkhodam nama kamu`);

  await sendKhodam(ctx, text);
});

// ==== HANDLER TOMBOL INLINE ====
bot.action(/cekkhodam:(.+)/, async (ctx) => {
  const text = ctx.match[1];
  await sendKhodam(ctx, text, true);
});

// ==== FUNCTION KIRIM KHODAM ====
async function sendKhodam(ctx, text, isCallback = false) {
  try {
    const res = await axios.get("https://raw.githubusercontent.com/nazedev/database/refs/heads/master/random/cekkhodam.json");
    const data = res.data;

    const hasil = data[Math.floor(Math.random() * data.length)];

    const message = `
┏╼━━━「  𝗖𝗲𝗸 𝗞𝗵𝗼𝗱𝗮𝗺 🍁 」━━━━╾┓
╎🔮 Khodam dari *${text}*
╎adalah *${hasil.nama}*\n_${hasil.deskripsi}_
┗╼━━━━━━━━━━━━━━━━━━━━━╾┛
`;

    if (isCallback) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Cek Lagi", `cekkhodam:${text}`)]
        ])
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Cek Lagi", `cekkhodam:${text}`)]
        ])
      });
    }
  } catch (e) {
    const fallback = ["Dokter Indosiar", "Sigit Rendang", "Ustadz Sinetron", "Bocil epep"];
    const random = fallback[Math.floor(Math.random() * fallback.length)];
    const message = `🔮 Khodam dari *${text}* adalah *${random}*`;

    if (isCallback) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Cek Lagi", `cekkhodam:${text}`)]
        ])
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Cek Lagi", `cekkhodam:${text}`)]
        ])
      });
    }
  }
}

bot.command("info", async (ctx) => {
  let target = ctx.from; // default user yg pakai command

  // kalau reply ke pesan user lain
  if (ctx.message.reply_to_message) {
    target = ctx.message.reply_to_message.from;
  }

  const userId = target.id;
  const username = target.username ? `@${target.username}` : "❌ Tidak ada username";
  const firstName = target.first_name || "";
  const lastName = target.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  const text = `
┏╼━━「  𝗜𝗻𝗳𝗼 🍁 」━━━━━━╾┓
╎🆔 *ID Telegram:* \`${userId}\`
╎👤 *Nama:* ${fullName}
╎🔗 *Username:* ${username}
┗╼━━━━━━━━━━━━━━━━━━╾┛
`;

  ctx.reply(text, { parse_mode: "Markdown" });
});

// ==== HANDLER AUTO REPLY AI ====
bot.on("message", async (ctx, next) => {
  if (!autoAiGroups.includes(ctx.chat.id)) return next();

  const text = ctx.message.text;
  if (!text) return next(); // skip kalau bukan teks
  if (text.startsWith("/")) return next(); // skip command

  const botUsername = ctx.botInfo.username; // username bot

  // hanya respon kalau ada mention bot
  if (!(ctx.message.entities && ctx.message.entities.some(e => e.type === "mention" && text.includes(`@${botUsername}`)))) {
    return next();
  }

  // hapus mention dari prompt biar lebih natural
  const prompt = text.replace(`@${botUsername}`, "").trim();
  if (!prompt) return next();

  try {
    const res = await axios.get(`https://api.zenzxz.my.id/ai/gpt4o?prompt=${encodeURIComponent(prompt)}`);
    const aiReply = res.data.result || "⚠️ AI tidak bisa menjawab sekarang.";
    ctx.reply(aiReply, { reply_to_message_id: ctx.message.message_id });
  } catch (e) {
    console.error("AutoAI Error:", e.message);
    ctx.reply("⚠️ Gagal mendapatkan respon dari AI.");
  }
});

// ==== TIKTOK DOWNLOADER ====
bot.command("ttdown", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) {
    return ctx.reply(`❌ Salah input!\nContoh: /ttdown https://vt.tiktok.com/xxxx/`);
  }

  try {
    const res = await axios.get(
      `https://api.zenzxz.my.id/downloader/tiktok?url=${encodeURIComponent(text)}`
    );

    const down = res.data?.result?.data;
    if (!down || !down.play) {
      return ctx.reply("⚠️ Gagal mengambil data TikTok. Coba link lain.");
    }

    // kirim video
    await ctx.replyWithVideo(
      { url: down.play },
      {
        caption: `
┏╼━━━「  𝗧𝗶𝗸𝗧𝗼𝗸 𝗗𝗼𝘄𝗻 🍁 」━━━━━━━╾┓
╎📌 Judul: ${down.title || "-"}
╎⏳ Durasi: ${down.duration || "-"} detik
╎👤 Author: ${down.author || "-"}
╎❤️ Likes: ${down.digg_count || "-"} | 👁️ Views: ${down.play_count || "-"}
┗╼━━━━━━━━━━━━━━━━━━╾┛
        `,
        parse_mode: "Markdown"
      }
    );

    // cek kalau ada musik
    const audioUrl = down.music || down.music_info?.play || null;
    if (audioUrl) {
      await ctx.replyWithAudio(
        { url: audioUrl },
        {
          title: down.music_info?.title || "TikTok Sound",
          performer: down.music_info?.author || "Unknown"
        }
      );
    }

  } catch (e) {
    console.error("TTDOWN error:", e);
    await ctx.reply("⚠️ Error ambil data TikTok. Coba ulangi lagi nanti.");
  }
});

// ==== COMMAND /removebg ====
bot.command("removebg", async (ctx) => {
  try {
    // Pastikan command ini dipakai dengan reply
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.photo) {
      return ctx.reply("❌ Reply ke foto yang ingin dihapus backgroundnya dengan command /removebg");
    }

    // Ambil foto resolusi terbesar dari pesan yang direply
    const photoArr = ctx.message.reply_to_message.photo;
    const fileId = photoArr[photoArr.length - 1].file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    // Hapus background via API
    const resultUrl = await removeBgFromUrl(fileUrl);
    await ctx.replyWithPhoto(
      { url: resultUrl },
      { caption: "🖼 Background berhasil dihapus!" }
    );
  } catch (e) {
    console.error("RemoveBG Error:", e.message);
    ctx.reply("⚠️ Gagal menghapus background, coba lagi.");
  }
});

// ==== /qc untuk bikin stiker quote dengan data user ====
bot.command("qc", async (ctx) => {
  const reply = ctx.message.reply_to_message;
  if (!reply || !reply.text) {
    return ctx.reply("❌ Reply ke teks yang ingin dijadikan stiker dengan command /qc");
  }

  const text = reply.text;
  const user = reply.from; // data user yang direply

  // Ambil nama lengkap
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const username = user.username ? `@${user.username}` : fullName;

  // Ambil foto profil user (PP)
  let photoUrl = null;
  try {
    const photos = await ctx.telegram.getUserProfilePhotos(user.id, 0, 1);
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      const file = await ctx.telegram.getFile(fileId);
      photoUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    }
  } catch (e) {
    console.log("Tidak ada foto profil:", e.message);
  }

  // Kasih pilihan tema
  await ctx.reply("🎨 Pilih tema untuk stiker QC:", {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("🌑 Dark", `qc:${encodeURIComponent(text)}:${encodeURIComponent(fullName)}:${encodeURIComponent(username)}:${encodeURIComponent(photoUrl || "")}:dark`)],
      [Markup.button.callback("🌕 Light", `qc:${encodeURIComponent(text)}:${encodeURIComponent(fullName)}:${encodeURIComponent(username)}:${encodeURIComponent(photoUrl || "")}:light`)],
      [Markup.button.callback("🔵 Blue", `qc:${encodeURIComponent(text)}:${encodeURIComponent(fullName)}:${encodeURIComponent(username)}:${encodeURIComponent(photoUrl || "")}:blue`)],
    ]),
  });
});

// ==== HANDLER GENERATE STIKER ====
bot.action(/qc:(.+):(.+):(.+):(.+):(.*)/, async (ctx) => {
  const [text, fullName, username, photoUrl, theme] = ctx.match.slice(1).map(decodeURIComponent);

  try {
    // Panggil API QC
    const res = await axios.get("https://api.zenzxz.my.id/maker/quotedchat", {
      params: {
        text,
        name: fullName,
        username,
        avatar: photoUrl,
        theme,
      },
    });

    const imgUrl = res.data.result;
    if (!imgUrl) throw new Error("API gagal generate");

    await ctx.replyWithSticker({ url: imgUrl });

    // Tombol generate ulang
    await ctx.reply("🔄 Mau generate lagi?", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Generate Lagi", `qc:${encodeURIComponent(text)}:${encodeURIComponent(fullName)}:${encodeURIComponent(username)}:${encodeURIComponent(photoUrl || "")}:${theme}`)],
      ]),
    });
  } catch (e) {
    console.error("QC Sticker Error:", e.message);
    ctx.reply("⚠️ Gagal membuat stiker, coba lagi.");
  }
});

// ===== Command /gombalan =====
bot.command("gombalan", async (ctx) => {
  const bucin = [
    "Aku memilih untuk sendiri, bukan karena menunggu yang sempurna, tetapi butuh yang tak pernah menyerah.",
    "Seorang yang single diciptakan bersama pasangan yang belum ditemukannya.",
    "Jomblo. Mungkin itu cara Tuhan untuk mengatakan 'Istirahatlah dari cinta yang salah'.",
    "Jomblo adalah anak muda yang mendahulukan pengembangan pribadinya untuk cinta yang lebih berkelas nantinya.",
    "Aku bukan mencari seseorang yang sempurna, tapi aku mencari orang yang menjadi sempurna berkat kelebihanku.",
    "Pacar orang adalah jodoh kita yang tertunda.",
    "Jomblo pasti berlalu. Semua ada saatnya, saat semua kesendirian menjadi sebuah kebersamaan dengannya kekasih halal. Bersabarlah.",
    "Romeo rela mati untuk juliet, Jack mati karena menyelamatkan Rose. Intinya, kalau tetap mau hidup, jadilah single.",
    "Aku mencari orang bukan dari kelebihannya tapi aku mencari orang dari ketulusan hatinya.",
    "Jodoh bukan sendal jepit, yang kerap tertukar. Jadi teruslah berada dalam perjuangan yang semestinya.",
    "Kalau kamu jadi senar gitar, aku nggak mau jadi gitarisnya. Karena aku nggak mau mutusin kamu.",
    "Bila mencintaimu adalah ilusi, maka izinkan aku berimajinasi selamanya.",
    "Sayang... Tugas aku hanya mencintaimu, bukan melawan takdir.",
    "Saat aku sedang bersamamu rasanya 1 jam hanya 1 detik, tetapi jika aku jauh darimu rasanya 1 hari menjadi 1 tahun.",
    "Kolak pisang tahu sumedang, walau jarak membentang cintaku takkan pernah hilang.",
    "Aku ingin menjadi satu-satunya, bukan salah satunya.",
    "Aku tidak bisa berjanji untuk menjadi yang baik. Tapi aku berjanji akan selalu mendampingi kamu.",
    "Kalau aku jadi wakil rakyat aku pasti gagal, gimana mau mikirin rakyat kalau yang selalu ada dipikiran aku hanyalah dirimu.",
    "Lihat kebunku, penuh dengan bunga. Lihat matamu, hatiku berbunga-bunga.",
    "Berjanjilah untuk terus bersamaku sekarang, esok, dan selamanya.",
    "Rindu tidak hanya muncul karena jarak yang terpisah. Tapi juga karena keinginan yang tidak terwujud.",
    "Kamu tidak akan pernah jauh dariku, kemanapun aku pergi kamu selalu ada, karena kamu selalu di hatiku, yang jauh hanya raga kita bukan hati kita.",
    "Aku tahu dalam setiap tatapanku, kita terhalang oleh jarak dan waktu. Tapi aku yakin kalau nanti kita pasti bisa bersatu.",
    "Merindukanmu tanpa pernah bertemu sama halnya dengan menciptakan lagu yang tak pernah ternyayikan.",
    "Ada kalanya jarak selalu menjadi penghalang antara aku sama kamu, namun tetap saja di hatiku kita selalu dekat.",
    "Jika hati ini tak mampu membendung segala kerinduan, apa daya tak ada yang bisa aku lakukan selain mendoakanmu.",
    "Mungkin di saat ini aku hanya bisa menahan kerinduan ini. Sampai tiba saatnya nanti aku bisa bertemu dan melepaskan kerinduan ini bersamamu.",
    "Melalui rasa rindu yang bergejolak dalam hati, di situ terkadang aku sangat membutuhkan dekap peluk kasih sayangmu.",
    "Dalam dinginnya malam, tak kuingat lagi; Berapa sering aku memikirkanmu juga merindukanmu.",
    "Merindukanmu itu seperti hujan yang datang tiba-tiba dan bertahan lama. Dan bahkan setelah hujan reda, rinduku masih terasa.",
    "Sejak mengenalmu bawaannya aku pengen belajar terus, belajar menjadi yang terbaik buat kamu.",
    "Tahu gak perbedaan pensi sama wajah kamu? Kalau pensil tulisannya bisa dihapus, tapi kalau wajah kamu gak akan ada yang bisa hapus dari pikiran aku.",
    "Bukan Ujian Nasional besok yang harus aku khawatirkan, tapi ujian hidup yang aku lalui setelah kamu meninggalkanku.",
    "Satu hal kebahagiaan di sekolah yang terus membuatku semangat adalah bisa melihat senyumanmu setiap hari.",
    "Kamu tahu gak perbedaanya kalau ke sekolah sama ke rumah kamu? Kalo ke sekolah pasti yang di bawa itu buku dan pulpen, tapi kalo ke rumah kamu, aku cukup membawa hati dan cinta.",
    "Aku gak sedih kok kalo besok hari senin, aku sedihnya kalau gak ketemu kamu.",
    "Momen cintaku tegak lurus dengan momen cintamu. Menjadikan cinta kita sebagai titik ekuilibrium yang sempurna.",
    "Aku rela ikut lomba lari keliling dunia, asalkan engkai yang menjadi garis finishnya.",
    "PR-ku adalah merindukanmu. Lebih kuat dari Matematika, lebih luas dari Fisika, lebih kerasa dari Biologi.",
    "Cintaku kepadamu itu bagaikan metabolisme, yang gak akan berhenti sampai mati.",
    "Kalau jelangkungnya kaya kamu, dateng aku jemput, pulang aku anter deh.",
    "Makan apapun aku suka asal sama kamu, termasuk makan ati.",
    "Cinta itu kaya hukuman mati. Kalau nggak ditembak, ya digantung.",
    "Mencintaimu itu kayak narkoba: sekali coba jadi candu, gak dicoba bikin penasaran, ditinggalin bikin sakaw.",
    "Gue paling suka ngemil karena ngemil itu enak. Apalagi ngemilikin kamu sepenuhnya...",
    "Dunia ini cuma milik kita berdua. Yang lainnya cuma ngontrak.",
    "Bagi aku, semua hari itu adalah hari Selasa. Selasa di Surga bila dekat denganmu...",
    "Bagaimana kalau kita berdua jadi komplotan penjahat? Aku curi hatimu dan kamu curi hatiku.",
    "Kamu itu seperti kopi yang aku seruput pagi ini. Pahit, tapi bikin nagih.",
    "Aku sering cemburu sama lipstikmu. Dia bisa nyium kamu tiap hari, dari pagi sampai malam.",
    "Hanya mendengar namamu saja sudah bisa membuatku tersenyum seperti orang bodoh.",
    "Aku tau teman wanitamu bukan hanya satu, dan menyukaimu pun bukan hanya aku.",
    "Semenjak aku berhenti berharap pada dirimu, aku jadi tidak semangat dalam segala hal..",
    "Denganmu, jatuh cinta adalah patah hati paling sengaja.",
    "Sangat sulit merasakan kebahagiaan hidup tanpa kehadiran kamu disisiku.",
    "Melalui rasa rindu yang bergejolak dalam hati, di situ terkadang aku sangat membutuhkan dekap peluk kasih sayangmu.",
    "Sendainya kamu tahu, sampai saat ini aku masih mencintaimu.",
    "Terkadang aku iri sama layangan..talinya putus saja masih dikejar kejar dan gak rela direbut orang lain...",
    "Aku tidak tahu apa itu cinta, sampai akhirnya aku bertemu denganmu. Tapi, saat itu juga aku tahu rasanya patah hati.",
    "Mengejar itu capek, tapi lebih capek lagi menunggu\nMenunggu kamu menyadari keberadaanku...",
    "Jangan berhenti mencinta hanya karena pernah terluka. Karena tak ada pelangi tanpa hujan, tak ada cinta sejati tanpa tangisan.",
    "Aku punya sejuta alasan unutk melupakanmu, tapi tak ada yang bisa memaksaku untuk berhenti mencintaimu.",
    "Terkadang seseorang terasa sangat bodoh hanya untuk mencintai seseorang.",
    "Kamu adalah patah hati terbaik yang gak pernah aku sesali.",
    "Bukannya tak pantas ditunggu, hanya saja sering memberi harapan palsu.",
    "Sebagian diriku merasa sakit, Mengingat dirinya yang sangat dekat, tapi tak tersentuh.",
    "Hal yang terbaik dalam mencintai seseorang adalah dengan diam-diam mendo akannya.",
    "Kuharap aku bisa menghilangkan perasaan ini secepat aku kehilanganmu.",
    "Demi cinta kita menipu diri sendiri. Berusaha kuat nyatanya jatuh secara tak terhormat.",
    "Anggaplah aku rumahmu, jika kamu pergi kamu mengerti kemana arah pulang. Menetaplah bila kamu mau dan pergilah jika kamu bosan...",
    "Aku bingung, apakah aku harus kecewa atu tidak? Jika aku kecewa, emang siapa diriku baginya?\n\nKalau aku tidak kecewa, tapi aku menunggu ucapannya.",
    "Rinduku seperti ranting yang tetap berdiri.Meski tak satupun lagi dedaunan yang menemani, sampai akhirnya mengering, patah, dan mati.",
    "Kurasa kita sekarang hanya dua orang asing yang memiliki kenangan yang sama.",
    "Buatlah aku bisa membencimu walau hanya beberapa menit, agar tidak terlalu berat untuk melupakanmu.",
    "Aku mencintaimu dengan segenap hatiku, tapi kau malah membagi perasaanmu dengan orang lain.",
    "Mencintaimu mungkin menghancurkanku, tapi entah bagaimana meninggalkanmu tidak memperbaikiku.",
    "Kamu adalah yang utama dan pertama dalam hidupku. Tapi, aku adalah yang kedua bagimu.",
    "Jika kita hanya bisa dipertemukan dalam mimpi, aku ingin tidur selamanya.",
    "Melihatmu bahagia adalah kebahagiaanku, walaupun bahagiamu tanpa bersamaku.",
    "Aku terkadang iri dengan sebuah benda. Tidak memiliki rasa namun selalu dibutuhkan. Berbeda dengan aku yang memiliki rasa, namun ditinggalkan dan diabaikan...",
    "Bagaimana mungkin aku berpindah jika hanya padamu hatiku bersinggah?",
    "Kenangan tentangmu sudah seperti rumah bagiku. Sehingga setiap kali pikiranku melayang, pasti ujung-ujungnya akan selalu kembali kepadamu.",
    "Kenapa tisue bermanfaat? Karena cinta tak pernah kemarau. - Sujiwo Tejo",
    "Kalau mencintaimu adalah kesalahan, yasudah, biar aku salah terus saja.",
    "Sejak kenal kamu, aku jadi pengen belajar terus deh. Belajar jadi yang terbaik buat kamu.",
    "Ada yang bertingkah bodoh hanya untuk melihatmu tersenyum. Dan dia merasa bahagia akan hal itu.",
    "Aku bukan orang baik, tapi akan belajar jadi yang terbaik untuk kamu.",
    "Kita tidak mati, tapi lukanya yang membuat kita tidak bisa berjalan seperti dulu lagi.",
    "keberadaanmu bagaikan secangkir kopi yang aku butuhkan setiap pagi, yang dapat mendorongku untuk tetap bersemangat menjalani hari.",
    "Aku mau banget ngasih dunia ke kamu. Tapi karena itu nggak mungkin, maka aku akan kasih hal yang paling penting dalam hidupku, yaitu duniaku.",
    "Mending sing humoris tapi manis, ketimbang sok romantis tapi akhire tragis.",
    "Ben akhire ora kecewa, dewe kudu ngerti kapan waktune berharap lan kapan kudu mandeg.",
    "Aku ki wong Jowo seng ora ngerti artine 'I Love U'. Tapi aku ngertine mek 'Aku tresno awakmu'.",
    "Ora perlu ayu lan sugihmu, aku cukup mok setiani wes seneng ra karuan.",
    "Cintaku nang awakmu iku koyok kamera, fokus nang awakmu tok liyane mah ngeblur.",
    "Saben dino kegowo ngimpi tapi ora biso nduweni.",
    "Ora ketemu koe 30 dino rasane koyo sewulan.",
    "Aku tanpamu bagaikan sego kucing ilang karete. Ambyar.",
    "Pengenku, Aku iso muter wektu. Supoyo aku iso nemokne kowe lewih gasik. Ben Lewih dowo wektuku kanggo urip bareng sliramu.",
    "Aku ora pernah ngerti opo kui tresno, kajaba sak bare ketemu karo sliramu.",
    "Cinta aa ka neng moal leungit-leungit sanajan aa geus kawin deui.",
    "Kasabaran kaula aya batasna, tapi cinta kaula ka anjeun henteu aya se epna.",
    "Kanyaah akang moal luntur najan make Bayclean.",
    "Kenangan endah keur babarengan jeung anjeun ek tuluy diinget-inget nepi ka poho.",
    "Kuring moal bakal tiasa hirup sorangan, butuh bantosan jalmi sejen.",
    "Nyaahna aa ka neg teh jiga tukang bank keur nagih hutang (hayoh mumuntil).",
    "Kasabaran urang aya batasna, tapi cinta urang ka maneh moal aya beakna.",
    "Hayang rasana kuring ngarangkai kabeh kata cinta anu aya di dunya ieu, terus bade ku kuring kumpulkeun, supaya anjeun nyaho gede pisan rasa cinta kuring ka anjeun.",
    "Tenang wae neng, ari cinta Akang mah sapertos tembang krispatih; Tak lekang oleh waktu.",
    "Abdi sanes jalmi nu sampurna pikeun anjeun, sareng sanes oge nu paling alus kanggo anjeun. Tapi nu pasti, abdi jalmi hiji-hijina nu terus emut ka anjeun.",
    "Cukup jaringan aja yang hilang, kamu jangan.",
    "Sering sih dibikin makan ati. Tapi menyadari kamu masih di sini bikin bahagia lagi.",
    "Musuhku adalah mereka yang ingin memilikimu juga.",
    "Banyak yang selalu ada, tapi kalo cuma kamu yang aku mau, gimana?",
    "Jam tidurku hancur dirusak rindu.",
    "Cukup China aja yang jauh, cinta kita jangan.",
    "Yang penting itu kebahagiaan kamu, aku sih gak penting..",
    "Cuma satu keinginanku, dicintai olehmu..",
    "Aku tanpamu bagaikan ambulans tanpa wiuw wiuw wiuw.",
    "Cukup antartika aja yang jauh. Antarkita jangan.",
"Kamu tau gak beda nya kamu sama milea?,iya sama sama ngangenin."
  ];

  const gombal = bucin[Math.floor(Math.random() * bucin.length)];
  await ctx.reply(`💕 ${gombal}`);
});

// ===== Command /gombalin @username =====
bot.command("gombalin", async (ctx) => {
  const bucin = [
    "Aku memilih untuk sendiri, bukan karena menunggu yang sempurna, tetapi butuh yang tak pernah menyerah.",
    "Seorang yang single diciptakan bersama pasangan yang belum ditemukannya.",
    "Jomblo. Mungkin itu cara Tuhan untuk mengatakan 'Istirahatlah dari cinta yang salah'.",
    "Jomblo adalah anak muda yang mendahulukan pengembangan pribadinya untuk cinta yang lebih berkelas nantinya.",
    "Aku bukan mencari seseorang yang sempurna, tapi aku mencari orang yang menjadi sempurna berkat kelebihanku.",
    "Pacar orang adalah jodoh kita yang tertunda.",
    "Jomblo pasti berlalu. Semua ada saatnya, saat semua kesendirian menjadi sebuah kebersamaan dengannya kekasih halal. Bersabarlah.",
    "Romeo rela mati untuk juliet, Jack mati karena menyelamatkan Rose. Intinya, kalau tetap mau hidup, jadilah single.",
    "Aku mencari orang bukan dari kelebihannya tapi aku mencari orang dari ketulusan hatinya.",
    "Jodoh bukan sendal jepit, yang kerap tertukar. Jadi teruslah berada dalam perjuangan yang semestinya.",
    "Kalau kamu jadi senar gitar, aku nggak mau jadi gitarisnya. Karena aku nggak mau mutusin kamu.",
    "Bila mencintaimu adalah ilusi, maka izinkan aku berimajinasi selamanya.",
    "Sayang... Tugas aku hanya mencintaimu, bukan melawan takdir.",
    "Saat aku sedang bersamamu rasanya 1 jam hanya 1 detik, tetapi jika aku jauh darimu rasanya 1 hari menjadi 1 tahun.",
    "Kolak pisang tahu sumedang, walau jarak membentang cintaku takkan pernah hilang.",
    "Aku ingin menjadi satu-satunya, bukan salah satunya.",
    "Aku tidak bisa berjanji untuk menjadi yang baik. Tapi aku berjanji akan selalu mendampingi kamu.",
    "Kalau aku jadi wakil rakyat aku pasti gagal, gimana mau mikirin rakyat kalau yang selalu ada dipikiran aku hanyalah dirimu.",
    "Lihat kebunku, penuh dengan bunga. Lihat matamu, hatiku berbunga-bunga.",
    "Berjanjilah untuk terus bersamaku sekarang, esok, dan selamanya.",
    "Rindu tidak hanya muncul karena jarak yang terpisah. Tapi juga karena keinginan yang tidak terwujud.",
    "Kamu tidak akan pernah jauh dariku, kemanapun aku pergi kamu selalu ada, karena kamu selalu di hatiku, yang jauh hanya raga kita bukan hati kita.",
    "Aku tahu dalam setiap tatapanku, kita terhalang oleh jarak dan waktu. Tapi aku yakin kalau nanti kita pasti bisa bersatu.",
    "Merindukanmu tanpa pernah bertemu sama halnya dengan menciptakan lagu yang tak pernah ternyayikan.",
    "Ada kalanya jarak selalu menjadi penghalang antara aku sama kamu, namun tetap saja di hatiku kita selalu dekat.",
    "Jika hati ini tak mampu membendung segala kerinduan, apa daya tak ada yang bisa aku lakukan selain mendoakanmu.",
    "Mungkin di saat ini aku hanya bisa menahan kerinduan ini. Sampai tiba saatnya nanti aku bisa bertemu dan melepaskan kerinduan ini bersamamu.",
    "Melalui rasa rindu yang bergejolak dalam hati, di situ terkadang aku sangat membutuhkan dekap peluk kasih sayangmu.",
    "Dalam dinginnya malam, tak kuingat lagi; Berapa sering aku memikirkanmu juga merindukanmu.",
    "Merindukanmu itu seperti hujan yang datang tiba-tiba dan bertahan lama. Dan bahkan setelah hujan reda, rinduku masih terasa.",
    "Sejak mengenalmu bawaannya aku pengen belajar terus, belajar menjadi yang terbaik buat kamu.",
    "Tahu gak perbedaan pensi sama wajah kamu? Kalau pensil tulisannya bisa dihapus, tapi kalau wajah kamu gak akan ada yang bisa hapus dari pikiran aku.",
    "Bukan Ujian Nasional besok yang harus aku khawatirkan, tapi ujian hidup yang aku lalui setelah kamu meninggalkanku.",
    "Satu hal kebahagiaan di sekolah yang terus membuatku semangat adalah bisa melihat senyumanmu setiap hari.",
    "Kamu tahu gak perbedaanya kalau ke sekolah sama ke rumah kamu? Kalo ke sekolah pasti yang di bawa itu buku dan pulpen, tapi kalo ke rumah kamu, aku cukup membawa hati dan cinta.",
    "Aku gak sedih kok kalo besok hari senin, aku sedihnya kalau gak ketemu kamu.",
    "Momen cintaku tegak lurus dengan momen cintamu. Menjadikan cinta kita sebagai titik ekuilibrium yang sempurna.",
    "Aku rela ikut lomba lari keliling dunia, asalkan engkai yang menjadi garis finishnya.",
    "PR-ku adalah merindukanmu. Lebih kuat dari Matematika, lebih luas dari Fisika, lebih kerasa dari Biologi.",
    "Cintaku kepadamu itu bagaikan metabolisme, yang gak akan berhenti sampai mati.",
    "Kalau jelangkungnya kaya kamu, dateng aku jemput, pulang aku anter deh.",
    "Makan apapun aku suka asal sama kamu, termasuk makan ati.",
    "Cinta itu kaya hukuman mati. Kalau nggak ditembak, ya digantung.",
    "Mencintaimu itu kayak narkoba: sekali coba jadi candu, gak dicoba bikin penasaran, ditinggalin bikin sakaw.",
    "Gue paling suka ngemil karena ngemil itu enak. Apalagi ngemilikin kamu sepenuhnya...",
    "Dunia ini cuma milik kita berdua. Yang lainnya cuma ngontrak.",
    "Bagi aku, semua hari itu adalah hari Selasa. Selasa di Surga bila dekat denganmu...",
    "Bagaimana kalau kita berdua jadi komplotan penjahat? Aku curi hatimu dan kamu curi hatiku.",
    "Kamu itu seperti kopi yang aku seruput pagi ini. Pahit, tapi bikin nagih.",
    "Aku sering cemburu sama lipstikmu. Dia bisa nyium kamu tiap hari, dari pagi sampai malam.",
    "Hanya mendengar namamu saja sudah bisa membuatku tersenyum seperti orang bodoh.",
    "Aku tau teman wanitamu bukan hanya satu, dan menyukaimu pun bukan hanya aku.",
    "Semenjak aku berhenti berharap pada dirimu, aku jadi tidak semangat dalam segala hal..",
    "Denganmu, jatuh cinta adalah patah hati paling sengaja.",
    "Sangat sulit merasakan kebahagiaan hidup tanpa kehadiran kamu disisiku.",
    "Melalui rasa rindu yang bergejolak dalam hati, di situ terkadang aku sangat membutuhkan dekap peluk kasih sayangmu.",
    "Sendainya kamu tahu, sampai saat ini aku masih mencintaimu.",
    "Terkadang aku iri sama layangan..talinya putus saja masih dikejar kejar dan gak rela direbut orang lain...",
    "Aku tidak tahu apa itu cinta, sampai akhirnya aku bertemu denganmu. Tapi, saat itu juga aku tahu rasanya patah hati.",
    "Mengejar itu capek, tapi lebih capek lagi menunggu\nMenunggu kamu menyadari keberadaanku...",
    "Jangan berhenti mencinta hanya karena pernah terluka. Karena tak ada pelangi tanpa hujan, tak ada cinta sejati tanpa tangisan.",
    "Aku punya sejuta alasan unutk melupakanmu, tapi tak ada yang bisa memaksaku untuk berhenti mencintaimu.",
    "Terkadang seseorang terasa sangat bodoh hanya untuk mencintai seseorang.",
    "Kamu adalah patah hati terbaik yang gak pernah aku sesali.",
    "Bukannya tak pantas ditunggu, hanya saja sering memberi harapan palsu.",
    "Sebagian diriku merasa sakit, Mengingat dirinya yang sangat dekat, tapi tak tersentuh.",
    "Hal yang terbaik dalam mencintai seseorang adalah dengan diam-diam mendo akannya.",
    "Kuharap aku bisa menghilangkan perasaan ini secepat aku kehilanganmu.",
    "Demi cinta kita menipu diri sendiri. Berusaha kuat nyatanya jatuh secara tak terhormat.",
    "Anggaplah aku rumahmu, jika kamu pergi kamu mengerti kemana arah pulang. Menetaplah bila kamu mau dan pergilah jika kamu bosan...",
    "Aku bingung, apakah aku harus kecewa atu tidak? Jika aku kecewa, emang siapa diriku baginya?\n\nKalau aku tidak kecewa, tapi aku menunggu ucapannya.",
    "Rinduku seperti ranting yang tetap berdiri.Meski tak satupun lagi dedaunan yang menemani, sampai akhirnya mengering, patah, dan mati.",
    "Kurasa kita sekarang hanya dua orang asing yang memiliki kenangan yang sama.",
    "Buatlah aku bisa membencimu walau hanya beberapa menit, agar tidak terlalu berat untuk melupakanmu.",
    "Aku mencintaimu dengan segenap hatiku, tapi kau malah membagi perasaanmu dengan orang lain.",
    "Mencintaimu mungkin menghancurkanku, tapi entah bagaimana meninggalkanmu tidak memperbaikiku.",
    "Kamu adalah yang utama dan pertama dalam hidupku. Tapi, aku adalah yang kedua bagimu.",
    "Jika kita hanya bisa dipertemukan dalam mimpi, aku ingin tidur selamanya.",
    "Melihatmu bahagia adalah kebahagiaanku, walaupun bahagiamu tanpa bersamaku.",
    "Aku terkadang iri dengan sebuah benda. Tidak memiliki rasa namun selalu dibutuhkan. Berbeda dengan aku yang memiliki rasa, namun ditinggalkan dan diabaikan...",
    "Bagaimana mungkin aku berpindah jika hanya padamu hatiku bersinggah?",
    "Kenangan tentangmu sudah seperti rumah bagiku. Sehingga setiap kali pikiranku melayang, pasti ujung-ujungnya akan selalu kembali kepadamu.",
    "Kenapa tisue bermanfaat? Karena cinta tak pernah kemarau. - Sujiwo Tejo",
    "Kalau mencintaimu adalah kesalahan, yasudah, biar aku salah terus saja.",
    "Sejak kenal kamu, aku jadi pengen belajar terus deh. Belajar jadi yang terbaik buat kamu.",
    "Ada yang bertingkah bodoh hanya untuk melihatmu tersenyum. Dan dia merasa bahagia akan hal itu.",
    "Aku bukan orang baik, tapi akan belajar jadi yang terbaik untuk kamu.",
    "Kita tidak mati, tapi lukanya yang membuat kita tidak bisa berjalan seperti dulu lagi.",
    "keberadaanmu bagaikan secangkir kopi yang aku butuhkan setiap pagi, yang dapat mendorongku untuk tetap bersemangat menjalani hari.",
    "Aku mau banget ngasih dunia ke kamu. Tapi karena itu nggak mungkin, maka aku akan kasih hal yang paling penting dalam hidupku, yaitu duniaku.",
    "Mending sing humoris tapi manis, ketimbang sok romantis tapi akhire tragis.",
    "Ben akhire ora kecewa, dewe kudu ngerti kapan waktune berharap lan kapan kudu mandeg.",
    "Aku ki wong Jowo seng ora ngerti artine 'I Love U'. Tapi aku ngertine mek 'Aku tresno awakmu'.",
    "Ora perlu ayu lan sugihmu, aku cukup mok setiani wes seneng ra karuan.",
    "Cintaku nang awakmu iku koyok kamera, fokus nang awakmu tok liyane mah ngeblur.",
    "Saben dino kegowo ngimpi tapi ora biso nduweni.",
    "Ora ketemu koe 30 dino rasane koyo sewulan.",
    "Aku tanpamu bagaikan sego kucing ilang karete. Ambyar.",
    "Pengenku, Aku iso muter wektu. Supoyo aku iso nemokne kowe lewih gasik. Ben Lewih dowo wektuku kanggo urip bareng sliramu.",
    "Aku ora pernah ngerti opo kui tresno, kajaba sak bare ketemu karo sliramu.",
    "Cinta aa ka neng moal leungit-leungit sanajan aa geus kawin deui.",
    "Kasabaran kaula aya batasna, tapi cinta kaula ka anjeun henteu aya se epna.",
    "Kanyaah akang moal luntur najan make Bayclean.",
    "Kenangan endah keur babarengan jeung anjeun ek tuluy diinget-inget nepi ka poho.",
    "Kuring moal bakal tiasa hirup sorangan, butuh bantosan jalmi sejen.",
    "Nyaahna aa ka neg teh jiga tukang bank keur nagih hutang (hayoh mumuntil).",
    "Kasabaran urang aya batasna, tapi cinta urang ka maneh moal aya beakna.",
    "Hayang rasana kuring ngarangkai kabeh kata cinta anu aya di dunya ieu, terus bade ku kuring kumpulkeun, supaya anjeun nyaho gede pisan rasa cinta kuring ka anjeun.",
    "Tenang wae neng, ari cinta Akang mah sapertos tembang krispatih; Tak lekang oleh waktu.",
    "Abdi sanes jalmi nu sampurna pikeun anjeun, sareng sanes oge nu paling alus kanggo anjeun. Tapi nu pasti, abdi jalmi hiji-hijina nu terus emut ka anjeun.",
    "Cukup jaringan aja yang hilang, kamu jangan.",
    "Sering sih dibikin makan ati. Tapi menyadari kamu masih di sini bikin bahagia lagi.",
    "Musuhku adalah mereka yang ingin memilikimu juga.",
    "Banyak yang selalu ada, tapi kalo cuma kamu yang aku mau, gimana?",
    "Jam tidurku hancur dirusak rindu.",
    "Cukup China aja yang jauh, cinta kita jangan.",
    "Yang penting itu kebahagiaan kamu, aku sih gak penting..",
    "Cuma satu keinginanku, dicintai olehmu..",
    "Aku tanpamu bagaikan ambulans tanpa wiuw wiuw wiuw.",
    "Cukup antartika aja yang jauh. Antarkita jangan.",
"Kamu tau gak beda nya kamu sama milea?,iya sama sama ngangenin."
  ];
  
  const gombal = bucin[Math.floor(Math.random() * bucin.length)];
  const entities = ctx.message.entities || [];
  const mentionEntity = entities.find((e) => e.type === "mention");
  if (mentionEntity) {
    const mentionedUsername = ctx.message.text.substring(
      mentionEntity.offset,
      mentionEntity.offset + mentionEntity.length
    );
    await ctx.reply(`💕 Hai ${mentionedUsername}, ${gombal}`);
  } else {
    await ctx.reply("❌ Tag seseorang dengan format: `/gombalin @username`");
  }
});

bot.command("galau", async (ctx) => {
const galau = [
    "Lebih baik kita sadar diri,dari pada ngemis hanya untuk dimengerti",
    "Hal paling menyedihkan dalam hidup adalah merenungi hal-hal yang sudah kau rancang dulu,dan tidak ada satupun yang tercapai hingga saat ini",
    "Belajar lah menghargai,karena gak semua rasa kecewa bisa dihilangkan dengan kata maaf",
    "Berdiam diri tidak menganggu siapapun jauh lebih baik daripada ngemis perhatian orang lain",
    "Pada akhirnya aku sadar,bahwa orang seperti ku tidak pantas dicintai",
    "Dihargai atau tidaknya aku itu tidak penting,yang pasti aku sudah berusaha semampuku dengan niat yang baik, selebihnya itu tergantung kesadaran mu",
    "Aku selalu berusaha jasi yang terbaik untuk siapapun, tapi nyatanya aku gagal",
    "Sesakit apapun itu aku tidak pernah membencimu,kau luka yang tidak bisa aku benci",
    "Aku tidak menyesal mengenalnya,tapi aku kecewa oada diriku telah jatuh cinta sedalam ini bahkan melupakanmu saja aku tidak mampu",
    "Penting tidaknya aku,aku hanya berusaha selalu ada buatmu",
    "Kembalilah kapanpun kamu mau semuanya masih tentang mu disini",
    "Don't expect too much, manusia itu gampang berubah",
    "Pemenang?,aku hanya menemani dia sampai tudak membutuhkan ku lagi",
    "Sering dianggap,tapi sering diabaikan,seakan dinginkan,tapi tidak dipedulikan",
    "Senja mengajarkan kita tentang indahnya melepaskan meskipun hati taj pernah benar-benar bisa melupakan",
    "Jika hujan datang tanpa diminta,maka aku juga bisa menahan rasa sakit sambil tersenyum",
    "Aku bertanya pada bulan dimalam hari,apakah aku seburuk itu untuk seseorang?",
    "Bahkan disaat aku memberikan versi terbaik ku aku masih saja tidaj dihargai",
    "Jangan salahkan dia, salahkan dirimu sendiri yang terlalu berlebihan",
    "Bahkan aku juga tidak tau,saat ini aku sedang dicintai atau dipermainkan",
    "Terlalu banyak kekurangan sehingga untuk percaya diripun seperti mempermalukan diri sendiri",
    "Saking mahalnya kebahagiaan itu,sampai aku hanya bisa mengarangnya didalam pikiranku",
    "Melihat anak seusiaku merasakan hangatnya sebuah keluarga,dan aku hanya bisa berkhayal seakan-akan aku bisa seperti mereka",
    "Kagumi saja tanpa berharap memiliki",
    "Jika kehadiranku adalah masalah,maafkan aku, mungkin aku tak seharusnya ada",
    "Jika bahagiaku terletak dimimpi,maka aku rela tidur selamanya",
    "Jangan paksa seseorang untuk mencintaimu,kamu boleh mencintainya,taoi biarkan dia mencintai pilihannya",
    "Jangan pernah menjadi orang yang selalu ada, untuk orang yang menjadikanmu hanya sesempatnya saja",
    "Setidaknya kalau emang tidak mencintai jangan bertingkah seakan mencintai, ditipu lebih menyakitkan dari pada ditinggalkan",
    "Orang sabar juga bisa pergi,jadi hargai jangan sampai telat menghargai",
    "Aku percaya adanya cinta,taoi aku tidak percaya jika aku dicintai",
    "Selepas dia,aku tidak tertarik lagi untuk jatuh cinta",
    "Bahkan disaat kecewa,sku masih membalas pesanmu dengan baik",
    "Bukan salahmu, tapi salahku sebab terlalu mengemis waktuku sedankan aku tau duniamu bukan hanya aku",
    "Jika sendiri daoat membuaku tenang,maka biarkan aku sendiran selamanya",
    "Jika senja mengalah demi malam,maka aku akan mengalah demi seseorang yang kau jadikan pilihan",
]
const jembut = galau[Math.floor(Math.random() * galau.length)];
  await ctx.reply(`🍁 ${jembut}`);
});

const spotifyCache = new Map();

bot.command("spotifysearch", async (ctx) => {
  try {
    const query = ctx.message.text.split(" ").slice(1).join(" ");
    if (!query) {
      return ctx.reply("❌ Salah input!\nContoh: /spotifysearch alan walker faded");
    }
    const res = await axios.get(
      `https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(query)}`
    );
    let data = res.data;
    if (data.data) data = data.data;
    if (typeof data === "string") data = JSON.parse(data);
    if (!Array.isArray(data) || data.length === 0) {
      return ctx.reply("⚠️ Tidak ada hasil ditemukan. Coba kata kunci lain.");
    }

    // Simpan hasil di cache per user
    spotifyCache.set(ctx.from.id, { results: data, index: 0 });
    await sendSpotifyResult(ctx, data[0], 0);
  } catch (err) {
    console.error("Spotify Search Error:", err.message);
    return ctx.reply("❌ Terjadi kesalahan saat mencari lagu.");
  }
});

// Fungsi kirim hasil Spotify
async function sendSpotifyResult(ctx, item, index) {
  const thumbnail = item.thumbnail || "https://i.ibb.co/qpZ1X7t/spotify-default.png";

  const caption = `
┏╼━「  𝗦𝗽𝗼𝘁𝗶𝗳𝘆 𝗦𝗲𝗮𝗿𝗰𝗵 🍁 」━━━━━━╾┓
╎🎵 *${item.title || "Unknown"}*
╎👤 Artist: ${item.artist || "-"}
╎💿 Album: ${item.album || "-"}
╎📅 Rilis: ${item.release_date || "-"}
╎⏱ Durasi: ${item.duration || "-"}
╎🔗 [Spotify Link](${item.track_url})
┗╼━━━━━━━━━━━━━━━━━━━━━━╾┛
  `;

  await ctx.replyWithPhoto(
    { url: thumbnail },
    {
      caption,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⬇️ Download", callback_data: `spotifydl_${index}` },
            { text: "⏭ Lagu Selanjutnya", callback_data: `spotifynext_${index + 1}` }
          ]
        ]
      }
    }
  );
}

// Handle tombol Download
bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    if (!spotifyCache.has(userId)) {
      return ctx.answerCbQuery("❌ Tidak ada data pencarian aktif.");
    }

    const { results } = spotifyCache.get(userId);

    // Download
  if (data.startsWith("spotifydl_")) {
  const index = parseInt(data.split("_")[1]);
  const item = results[index];
  await ctx.answerCbQuery("⬇️ Sedang mendownload...");
  const dl = await axios.get(
    `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(item.track_url)}`
  );
  console.log("DEBUG Spotify DL:", dl.data);
  if (!dl.data || !dl.data.data || !dl.data.data.download) {
    return ctx.reply("❌ Gagal mengambil link download dari API.");
  }
  
  const song = dl.data.data;
  return ctx.replyWithAudio(
    { url: song.download },
    {
      title: song.title,
      performer: song.artis || item.artist,
      thumb: { url: song.image }, // kasih thumbnail album
    }
  );
}

    // Next Lagu
    if (data.startsWith("spotifynext_")) {
      const index = parseInt(data.split("_")[1]);
      if (index >= results.length) {
        return ctx.answerCbQuery("⚠️ Tidak ada lagu selanjutnya.");
      }
      spotifyCache.set(userId, { results, index });
      await ctx.deleteMessage();
      await sendSpotifyResult(ctx, results[index], index);
    }
  } catch (err) {
    console.error("Callback Error:", err.message);
    return ctx.reply("❌ Terjadi kesalahan saat memproses permintaan.");
  }
});

// ================= ASAH OTAK =================
bot.command("asahotak", async (ctx) => {
  try {
    const res = await axios.get("https://api.siputzx.my.id/api/games/asahotak");
    const d = res.data;

    // Debug biar tau struktur API
    console.log("DEBUG ASAH OTAK:", JSON.stringify(d, null, 2));

    const soal =
      d.soal || d.question || d.result?.soal || d.data?.soal || "Soal tidak tersedia";
    const jawaban =
      d.jawaban || d.answer || d.result?.jawaban || d.data?.jawaban || null;

    if (!ctx.session) ctx.session = {};
    ctx.session.answer_asahotak = jawaban ? jawaban.toLowerCase() : "jawaban tidak tersedia";

    await ctx.reply(`🧠 Pertanyaan Asah Otak:\n${soal}\n\nKetik jawabanmu dengan /jawabasahotak <tebakan>`);
  } catch (e) {
    console.error("Error asahotak:", e.message);
    await ctx.reply("❌ Terjadi error saat mengambil soal Asah Otak.");
  }
});

bot.command("jawabasahotak", async (ctx) => {
  if (!ctx.session || !ctx.session.answer_asahotak) {
    return ctx.reply("❌ Tidak ada soal aktif. Jalankan /asahotak dulu.");
  }

  const userAnswer = ctx.message.text.split(" ").slice(1).join(" ").toLowerCase();
  if (userAnswer === ctx.session.answer_asahotak) {
    await ctx.reply("✅ Benar! 🎉 Jawaban kamu tepat.");
  } else {
    await ctx.reply(`❌ Salah.\nJawaban yang benar: ${ctx.session.answer_asahotak}`);
  }
});

// ================= CAK LONTONG =================
bot.command("caklontong", async (ctx) => {
  try {
    const res = await axios.get("https://api.siputzx.my.id/api/games/caklontong");
    const d = res.data;

    console.log("DEBUG CAK LONTONG:", JSON.stringify(d, null, 2));

    const soal = d.data?.soal || d.soal || "Soal tidak tersedia";
    const jawaban = d.data?.jawaban || d.jawaban || null;
    const alasan = d.data?.deskripsi || d.deskripsi || "alasan tidak tersedia";

    if (!ctx.session) ctx.session = {};
    ctx.session.answer_caklontong = jawaban ? jawaban.toLowerCase() : "jawaban tidak tersedia";
    ctx.session.reason_caklontong = alasan;

    await ctx.reply(`🤣 Pertanyaan Cak Lontong:\n${soal}\n\nKetik jawabanmu dengan /jawabcaklontong <tebakan>`);
  } catch (e) {
    console.error("Error caklontong:", e.message);
    await ctx.reply("❌ Terjadi error saat mengambil soal Cak Lontong.");
  }
});

bot.command("jawabcaklontong", async (ctx) => {
  if (!ctx.session || !ctx.session.answer_caklontong) {
    return ctx.reply("❌ Tidak ada soal aktif. Jalankan /caklontong dulu.");
  }

  const userAnswer = ctx.message.text.split(" ").slice(1).join(" ").toLowerCase();
  if (userAnswer === ctx.session.answer_caklontong) {
    await ctx.reply(`✅ Benar! 🎉\nJawaban: ${ctx.session.answer_caklontong}\n💡 ${ctx.session.reason_caklontong}`);
  } else {
    await ctx.reply(`❌ Salah.\nJawaban: ${ctx.session.answer_caklontong}\n💡 ${ctx.session.reason_caklontong}`);
  }
});

bot.command("tebaklirik", async (ctx) => {
  try {
    const res = await axios.get("https://api.siputzx.my.id/api/games/tebaklirik");
    const d = res.data;

    console.log("DEBUG TEBAK LIRIK:", JSON.stringify(d, null, 2));

    const soal = d.data?.soal || d.soal || "Lirik tidak tersedia";
    const jawaban = d.data?.jawaban || d.jawaban || null;

    if (!ctx.session) ctx.session = {};
    ctx.session.answer_tebaklirik = jawaban ? jawaban.toLowerCase() : "jawaban tidak tersedia";

    await ctx.reply(`🎶 Tebak Lirik:\n${soal}\n\nKetik jawabanmu dengan /jawabtebaklirik <tebakan>`);
  } catch (e) {
    console.error("Error tebaklirik:", e.message);
    await ctx.reply("❌ Terjadi error saat mengambil soal Tebak Lirik.");
  }
});

// ======== Tebak Lagu ========
bot.command("tebaklagu", async (ctx) => {
  try {
    const res = await axios.get("https://api.siputzx.my.id/api/games/tebaklagu");
    const data = res.data?.data;

    if (!data || !data.lagu) {
      return ctx.reply("❌ Lagu tidak tersedia, coba lagi.");
    }

    // pastikan ctx.session ada
    if (!ctx.session) ctx.session = {};

    ctx.session.answer_tebaklagu = data.judul ? data.judul.toLowerCase() : null;
    ctx.session.artist_tebaklagu = data.artis || null;

    await ctx.replyWithAudio(
      { url: data.lagu },
      { caption: `🎶 Tebak Lagu:\nDengarkan potongan lagu ini.\n\nKetik jawabanmu dengan:\n/jawabtebaklagu <judul>` }
    );

  } catch (e) {
    console.error("Error Tebak Lagu:", e);
    ctx.reply("❌ Terjadi error saat mengambil soal Tebak Lagu.");
  }
});

// ======== Jawab Tebak Lagu ========
bot.command("jawabtebaklagu", (ctx) => {
  const userAnswer = ctx.message.text.split(" ").slice(1).join(" ").toLowerCase();

  // pastikan ctx.session ada
  if (!ctx.session) ctx.session = {};

  if (!ctx.session.answer_tebaklagu) {
    return ctx.reply("⚠️ Tidak ada permainan Tebak Lagu yang aktif. Ketik /tebaklagu dulu.");
  }

  if (userAnswer === ctx.session.answer_tebaklagu) {
    ctx.reply(`✅ Benar! Judul lagunya adalah *${ctx.session.answer_tebaklagu}* oleh *${ctx.session.artist_tebaklagu}*`);
  } else {
    ctx.reply(`❌ Salah.\nJawaban: *${ctx.session.answer_tebaklagu}*\n🎤 Penyanyi: *${ctx.session.artist_tebaklagu}*`);
  }

  // reset session
  ctx.session.answer_tebaklagu = null;
  ctx.session.artist_tebaklagu = null;
});

// ==== COMMAND ZODIAK ====
bot.command("zodiak", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) {
    return ctx.reply("❌ Contoh: /zodiak scorpio");
  }

  try {
    // Panggil API siputzx
    const res = await axios.get(
      `https://api.siputzx.my.id/api/primbon/zodiak?zodiak=${encodeURIComponent(text)}`
    );

    const d = res.data;

    // cek validasi response
    if (!d || d.status !== true || !d.data) {
      return ctx.reply("⚠️ Data zodiak tidak ditemukan.");
    }

    const z = d.data;

    // format pesan
    let msg = `♈ <b>Ramalan Zodiak</b>\n\n`;
    msg += `🔮 <b>Zodiak:</b> ${z.zodiak || text}\n`;
    msg += `🎲 <b>Nomor Keberuntungan:</b> ${z.nomor_keberuntungan || "-"}\n`;
    msg += `🌺 <b>Bunga:</b> ${z.bunga_keberuntungan || "-"}\n`;
    msg += `🎨 <b>Warna:</b> ${z.warna_keberuntungan || "-"}\n`;
    msg += `💎 <b>Batu:</b> ${z.batu_keberuntungan || "-"}\n`;
    msg += `💫 <b>Planet:</b> ${z.planet_yang_mengitari || "-"}\n`;
    msg += `💧 <b>Elemen:</b> ${z.elemen_keberuntungan || "-"}\n`;
    msg += `❤️ <b>Pasangan Cocok:</b> ${z.pasangan_zodiak || "-"}\n\n`;

    if (z.asmarah) {
      msg += `💌 <b>Asmara:</b> ${z.asmarah}\n`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (e) {
    console.error("❌ Zodiak Error:", e.response?.status, e.response?.data || e.message);
    ctx.reply("⚠️ API zodiak error atau sedang down.");
  }
});

// ==== COMMAND CEKGANTENG ====
bot.command("cekganteng", (ctx) => {
  const percent = Math.floor(Math.random() * 10 + 1) * 10;
  let caption = "";

  switch (percent) {
    case 100: caption = "🔥 Ganteng level dewa! Semua orang auto klepek-klepek 😍"; break;
    case 90: caption = "😎 Hampir sempurna, tinggal tunggu dilamar artis!"; break;
    case 80: caption = "✨ Ganteng banget! Tinggal nunggu fans berdatangan."; break;
    case 70: caption = "😊 Ganteng natural, nggak usah banyak gaya udah keren."; break;
    case 60: caption = "😉 Lumayan ganteng, masih bisa bikin baper tetangga."; break;
    case 50: caption = "🙂 Ganteng standar, kayak mas-mas Indomaret."; break;
    case 40: caption = "🤔 Hmm... ya masih mending lah, asal jangan nyengir terus."; break;
    case 30: caption = "😅 Ganteng dikit, tapi lebih ganteng kalau dompet tebal."; break;
    case 20: caption = "🙃 Ganteng tipis-tipis, butuh filter TikTok buat naik level."; break;
    case 10: caption = "😂 Waduh, lebih ganteng pas lagi gelap lampu mati."; break;
    default: caption = "🤖 Error mendeteksi kegantengan!";
  }

  ctx.reply(`📸 Persentase ganteng kamu: <b>${percent}%</b>\n\n${caption}`, {
    parse_mode: "HTML",
  });
});

// ==== COMMAND CEKCANTIK ====
bot.command("cekcantik", (ctx) => {
  const percent = Math.floor(Math.random() * 10 + 1) * 10;
  let caption = "";

  switch (percent) {
    case 100: caption = "👑 Cantik bak bidadari turun dari khayangan! Semua terpesona 😍"; break;
    case 90: caption = "💃 Hampir sempurna, bisa jadi Miss Universe nih!"; break;
    case 80: caption = "✨ Cantik banget! Banyak yang ngantri jadi fans."; break;
    case 70: caption = "😊 Cantik natural, tanpa make up pun tetap memukau."; break;
    case 60: caption = "😉 Lumayan cantik, bisa bikin tetangga iri hati."; break;
    case 50: caption = "🙂 Cantik standar, masih bisa jadi cover majalah sekolah."; break;
    case 40: caption = "🤔 Cantik-cantik hemat, butuh skincare rutin biar naik level."; break;
    case 30: caption = "😅 Cantik dikit, tapi auranya bikin adem."; break;
    case 20: caption = "🙃 Cantik tipis-tipis, filter Instagram jadi penyelamat."; break;
    case 10: caption = "😂 Waduh, cantiknya cuma keliatan pas lampu remang-remang."; break;
    default: caption = "🤖 Error mendeteksi kecantikan!";
  }

  ctx.reply(`💄 Persentase cantik kamu: <b>${percent}%</b>\n\n${caption}`, {
    parse_mode: "HTML",
  });
});

bot.command("cektolol", (ctx) => {
  const percent = Math.floor(Math.random() * 10 + 1) * 10;
  let caption = "";

  switch (percent) {
    case 100: caption = "😹 Fiks Ini Mah, Tololnya natural sekali yaa"; break;
    case 90: caption = "🗿 Keknya Ini bawaan dari lahir deh tololnya"; break;
    case 80: caption = "🤭 Apalah ini mah orang fomo biasanya"; break;
    case 70: caption = "😭 Kadang bloon kadang normal kek punya penyakit aja"; break;
    case 60: caption = "😈 Fix Ini bocah kebanyakan halu bangun bego"; break;
    case 50: caption = "😂 Ini lu serius?, kadang oon kadang tolol??, pantesan"; break;
    case 40: caption = "🫠 Wah jangan mau fomo sih, ntar makin bloon"; break;
    case 30: caption = "🤥 Biasanya ini mah badut ya yang disekolah"; break;
    case 20: caption = "🙃 Ini mah orang random kadang ngikut kata otak yang random"; break;
    case 10: caption = "🙏🏻 Waduh, ini sepuh ini mah yang suka merendah"; break;
    default: caption = "🤖 Error mendeteksi ketololan!";
  }

  ctx.reply(`😹 Persentase tolol kamu: <b>${percent}%</b>\n\n${caption}`, {
    parse_mode: "HTML",
  });
});

// ==== COMMAND CEK MEMEK ====
bot.command("cekmemek", (ctx) => {
  const percent = Math.floor(Math.random() * 10 + 1) * 10;
  let caption = "";

  switch (percent) {
    case 100: caption = "😋 Fiks Ini Mah, pink mengoda"; break;
    case 90: caption = "🤭 Wah masihh pw ya dek pantesan sempit"; break;
    case 80: caption = "😵 Biasanya pink nih boleh diobok obok gak dek"; break;
    case 70: caption = "😩 Biasanya sih agakk tembem tetap enak sih wkwk"; break;
    case 60: caption = "😁 Pink sih tapi agak longgar dikit, work it lah"; break;
    case 50: caption = "😂 Wah longgar parah lu dipake berapa orang njir"; break;
    case 40: caption = "😹 Sebaiknya jangan gegabah, biasanya udah hitam"; break;
    case 30: caption = "🗿 Udah hytam bauk lagi iuuuuhh"; break;
    case 20: caption = "🙃 Jangan deh, dari pada kena hiv"; break;
    case 10: caption = "🙏🏻 Waduh, ini longgar bau ada belatung nya lagi"; break;
    default: caption = "🤖 Error mendeteksi ketololan!";
  }

  ctx.reply(`😋 Persentase memek kamu: <b>${percent}%</b>\n\n${caption}`, {
    parse_mode: "HTML",
  });
});

// TOURL 

bot.command("tourl", async (ctx) => {
  try {
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.photo) {
      return ctx.reply("❌ Balas sebuah foto dengan perintah /tourl");
    }

    const photoArr = ctx.message.reply_to_message.photo;
    const fileId = photoArr[photoArr.length - 1].file_id;

    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", new Blob([buffer]), "image.jpg"); // <-- pakai Blob

    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form,
    });

    const url = await res.text();

    await ctx.reply(
      `✅ Berhasil upload ke Catbox\n\n🔗 URL: ${url}\n♾️ Expired: Permanen`
    );
  } catch (err) {
    console.error("❌ Error /tourl:", err);
    ctx.reply("⚠️ Gagal upload ke Catbox, coba lagi.");
  }
});

// ==== ARTINAMA ====
bot.command("artinama", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /artinama Marsel");

  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/primbon/artinama?nama=${encodeURIComponent(text)}`);
    const data = res.data;

    if (!data || !data.status || !data.data) {
      return ctx.reply("⚠️ Gagal mengambil arti nama. Coba lagi nanti.");
    }

    const { nama, arti } = data.data;
    const message = `📛 *Arti Nama: ${nama}*\n\n${arti}`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("Artinama Error:", e.message);
    ctx.reply("⚠️ Terjadi kesalahan saat mengambil arti nama.");
  }
});

// ==== COMMAND KECOCOKAN NAMA PASANGAN ====
bot.command("kecocokan", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length < 2) {
    return ctx.reply("❌ Contoh: /kecocokan Marsel Geby");
  }

  const nama1 = args[0];
  const nama2 = args[1];

  try {
    const res = await axios.get(
      `https://api.siputzx.my.id/api/primbon/kecocokan_nama_pasangan?nama1=${encodeURIComponent(nama1)}&nama2=${encodeURIComponent(nama2)}`
    );

    const data = res.data?.data;
    if (!data) return ctx.reply("⚠️ Gagal mendapatkan hasil dari API.");

    const caption = `
💞 *Hasil Kecocokan Nama Pasangan* 💞

👤 Nama Anda: *${data.nama_anda}*
👤 Nama Pasangan: *${data.nama_pasangan}*

✅ *Sisi Positif:*
${data.sisi_posistif || data.sisi_positif}

⚠️ *Sisi Negatif:*
${data.sisi_negatif}

📝 *Catatan:*
${data.catatan}
    `;

    if (data.gambar) {
      await ctx.replyWithPhoto({ url: data.gambar }, { caption, parse_mode: "Markdown" });
    } else {
      await ctx.reply(caption, { parse_mode: "Markdown" });
    }
  } catch (e) {
    console.error("❌ Error kecocokan:", e.message);
    ctx.reply("⚠️ Error mengambil data dari API.");
  }
});

// ==== COMMAND /tafsirmimpi ====
bot.command("tafsirmimpi", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /tafsirmimpi bertemu setan");

  try {
    const url = `https://api.siputzx.my.id/api/primbon/tafsirmimpi?mimpi=${encodeURIComponent(text)}`;
    const res = await axios.get(url);

    if (!res.data || !res.data.status) {
      return ctx.reply("⚠️ Tafsir mimpi tidak ditemukan.");
    }

    const keyword = res.data.data?.keyword || "-";
    const solusi = res.data.data?.solusi || "Tidak ada solusi.";

    const hasil = `🌙 *Tafsir Mimpi*\n\n🔑 Keyword: *${keyword}*\n📌 Solusi: ${solusi}`;
    await ctx.reply(hasil, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("TafsirMimpi Error:", e.message);
    ctx.reply("⚠️ Gagal mengambil tafsir mimpi, coba lagi nanti.");
  }
});

// DECODE BASE 64

bot.command("decodebase64", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("❌ Contoh: /decodebase64 SGVsY2hpbmE=");

  try {
    const apiUrl = `https://api.siputzx.my.id/api/tools/base642text?base64=${encodeURIComponent(text)}`;
    const { data } = await axios.get(apiUrl);

    if (data.status) {
      ctx.reply(`Decoded Text: ${data.data.text}`);
    } else {
      ctx.reply("❌ Gagal mendecode Base64.");
    }
  } catch (err) {
    console.error("❌ Error decodebase64:", err.message);
    ctx.reply("⚠️ Terjadi kesalahan saat mendecode Base64.");
  }
});

bot.action(/.*/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(`⚠️ Callback '${ctx.callbackQuery.data}' tidak dikenali`);
});


// Run bot
bot.launch().then(() => console.log("✅ Bot berjalan..."));