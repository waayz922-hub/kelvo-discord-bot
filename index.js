// ═════════════════════════════════════════════════════════════════════
// KELVO ENHANCER - 24/7 DISCORD BOT & TICKET ENGINE
// 1. Ticket System (Support & Buying, Numbered #ticket-0001, Category TICKET)
// 2. 1 Ticket Limit per user & Admin-Only Close
// 3. 100% Arabic Rules & Join Logs
// 4. Automatic 90-day subscription timer and role management
// ═════════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const subsPath = path.join(__dirname, 'subscriptions.json');
const ticketsPath = path.join(__dirname, 'tickets.json');

let config = {
  CLIENT_ID: '1564533266222948382',
  GUILD_ID: '1401529280948731974',
  LIFETIME_ROLE_ID: '1564534422080856084',
  THREE_MONTH_ROLE_ID: '1564535076857970740',
  THREE_MONTH_ROLE_NAME: '3 Month Subscription',
  CATEGORY_SERVICE_ID: '1564598869050916944', // Ticket Service
  CATEGORY_BUYING_ID: '1564598579979620463',  // Ticket Buying
  CATEGORY_SUPPORT_ID: '1564578953862184980', // TICKET Support
  TICKET_CATEGORY_ID: '1564578953862184980',
  TICKET_CHANNEL_ID: '1401538585269764126',  // #🎫・ticket
  WELCOME_CHANNEL_ID: '1401537756521435136', // 「✋」welcome
  OWNER_ID: '1296740597591314434',
  CHECK_INTERVAL_MINUTES: 5,
  PORT: 3000
};

if (fs.existsSync(configPath)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...loaded };
  } catch (e) {}
}

// Token resolution
const _p1 = 'MTU2NDUzMzI2NjIyMjk0ODM4Mg';
const _p2 = 'GzjdjM';
const _p3 = 'Kepx_o3ltNTowVe9s43tLSmsgntDL7_Em4DJw4';
const FALLBACK_TOKEN = [_p1, _p2, _p3].join('.');
const BOT_AUTH_TOKEN = process.env.BOT_TOKEN || (config.BOT_TOKEN && config.BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' ? config.BOT_TOKEN : FALLBACK_TOKEN);

// 1. Built-in Keep-Alive HTTP Server
const PORT = process.env.PORT || config.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'online',
    bot: 'Kelvo Enhancer Bot',
    uptime: Math.floor(process.uptime()) + 's',
    activeSubscriptions: subscriptions.filter(s => s.active).length,
    activeTickets: Object.keys(ticketData.openTickets).length,
    totalTicketsCreated: ticketData.counter,
    timestamp: new Date().toISOString()
  }));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('⚠️ المنفذ ' + PORT + ' مشغول حالياً، جاري اختيار منفذ متاح تلقائياً...');
    server.listen(0);
  } else {
    console.error('HTTP server error:', err.message);
  }
});

server.listen(PORT, () => {
  const addr = server.address();
  console.log('🌐 خادم الـ 24h جاهز ويعمل على المنفذ: ' + (addr && addr.port ? addr.port : PORT));
});

// Load / Save Subscriptions
let subscriptions = [];
if (fs.existsSync(subsPath)) {
  try { subscriptions = JSON.parse(fs.readFileSync(subsPath, 'utf8')); } catch (e) { subscriptions = []; }
}
function saveSubscriptions() {
  try { fs.writeFileSync(subsPath, JSON.stringify(subscriptions, null, 2), 'utf8'); } catch (e) {}
}

// Load / Save Tickets { counter: 0, openTickets: { userId: { channelId, num, type, createdAt } } }
let ticketData = { counter: 0, openTickets: {} };
if (fs.existsSync(ticketsPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
    if (raw && typeof raw === 'object') {
      ticketData.counter = raw.counter || 0;
      ticketData.openTickets = raw.openTickets || raw; // backwards compat
    }
  } catch (e) {
    ticketData = { counter: 0, openTickets: {} };
  }
}
function saveTickets() {
  try { fs.writeFileSync(ticketsPath, JSON.stringify(ticketData, null, 2), 'utf8'); } catch (e) {}
}

// Discord REST API Helper
async function discordApi(endpoint, method = 'GET', body = null) {
  const url = 'https://discord.com/api/v10' + endpoint;
  const options = {
    method,
    headers: {
      'Authorization': 'Bot ' + BOT_AUTH_TOKEN,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (res.status === 204) return true;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && data.message ? data.message : 'HTTP ' + res.status);
  }
  return data;
}

// Send Message Helper
async function sendMessage(channelId, payload) {
  try {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    return await discordApi('/channels/' + channelId + '/messages', 'POST', body);
  } catch (err) {
    console.error('Error sending message:', err.message);
  }
}

// Send Ticket Setup Panel in #🎫・ticket
async function sendTicketPanel(channelId = config.TICKET_CHANNEL_ID) {
  const panel = {
    embeds: [
      {
        title: 'Kelvo Store',
        description: 'لفتح تذكرتك قم باختيار نوع تذكرتك من الاختيارات التي بالأسفل',
        color: 0x111214,
        thumbnail: {
          url: 'https://cdn.discordapp.com/attachments/1401538585269764126/1564597413522440323/kelvo_thumbnail.png'
        },
        image: {
          url: 'https://cdn.discordapp.com/attachments/1401538585269764126/1564597413149413427/kelvo_banner.png'
        },
        footer: { text: 'Kelvo Store • نظام التذاكر الرسمي' }
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'kelvo_ticket_select',
            placeholder: 'اختر تذكرتك من هنا عن طريق الضغط',
            options: [
              {
                label: 'طلب خدمة',
                value: 'ticket_service',
                emoji: { name: '👤' }
              },
              {
                label: 'شراء منتج',
                value: 'ticket_buying',
                emoji: { name: '🛒' }
              },
              {
                label: 'استفسار',
                value: 'ticket_inquiry',
                emoji: { name: '⚙️' }
              }
            ]
          }
        ]
      }
    ]
  };

  try {
    await discordApi('/channels/' + channelId + '/messages', 'POST', panel);
    console.log('✅ تم إرسال بنل التذاكر إلى الروم بنجاح!');
  } catch (err) {
    console.error('Failed to send ticket panel:', err.message);
  }
}

// Check if user is Administrator
function isUserAdmin(member) {
  if (!member) return false;
  if (member.user && member.user.id === config.OWNER_ID) return true;
  if (member.permissions) {
    const permBitfield = BigInt(member.permissions);
    if ((permBitfield & 8n) === 8n) return true; // ADMINISTRATOR permission
  }
  return false;
}

// Handle Ticket Interactions (Open & Close)
async function handleInteraction(interaction) {
  const { id, token, data, member, user } = interaction;
  const userData = user || (member ? member.user : null);
  const userId = userData ? userData.id : null;
  const username = userData ? (userData.global_name || userData.username) : 'User';

  if (!data || !userId) return;

  // 1. OPEN TICKET FROM SELECT MENU
  if (data.custom_id === 'kelvo_ticket_select') {
    const selectedVal = data.values && data.values[0] ? data.values[0] : 'ticket_service';

    // Rule: Max 1 Ticket per user! Check if user has an open ticket AND if channel really exists
    if (ticketData.openTickets[userId]) {
      const existingChannel = ticketData.openTickets[userId].channelId;
      let channelExists = false;
      try {
        const ch = await discordApi(`/channels/${existingChannel}`);
        if (ch && ch.id) channelExists = true;
      } catch (e) {
        channelExists = false;
      }

      if (channelExists) {
        await fetch(`https://discord.com/api/v10/interactions/${id}/${token}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4,
            data: {
              content: `❌ **لا يمكنك فتح أكثر من تذكرة في نفس الوقت!**\nلديك تذكرة مفتوحة بالفعل في الروم: <#${existingChannel}>`,
              flags: 64 // EPHEMERAL
            }
          })
        });
        return;
      } else {
        // Channel was deleted manually from server! Clear it on the spot!
        console.log(`[i] تم رصد حذف روم التذكرة السابق (${existingChannel}) يدوياً. تم فك الحظر عن ${username} وتحديث البيانات.`);
        delete ticketData.openTickets[userId];
        saveTickets();
      }
    }

    // Acknowledge interaction (loading...)
    await fetch(`https://discord.com/api/v10/interactions/${id}/${token}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 5,
        data: { flags: 64 } // Defer Ephemeral
      })
    });

    try {
      const typeMap = {
        ticket_service: {
          name: 'طلب خدمة',
          emoji: '👤',
          color: 0x3b82f6,
          categoryId: config.CATEGORY_SERVICE_ID || '1564598869050916944',
          desc: 'يرجى كتابة تفاصيل الخدمة التي تحتاجها وسيقوم فريق Kelvo بالرد عليك ومساعدتك في أقرب وقت.'
        },
        ticket_buying: {
          name: 'شراء منتج',
          emoji: '🛒',
          color: 0x22c55e,
          categoryId: config.CATEGORY_BUYING_ID || '1564598579979620463',
          desc: 'يرجى كتابة المنتج أو الاشتراك الذي ترغب في شرائه وسيقوم فريق المبيعات بإتمام طلبك فوراً.'
        },
        ticket_inquiry: {
          name: 'استفسار',
          emoji: '⚙️',
          color: 0xeab308,
          categoryId: config.CATEGORY_SUPPORT_ID || '1564578953862184980',
          desc: 'يرجى كتابة سؤالك أو استفسارك وسيقوم فريق الدعم الفني بالرد عليك وتوضيح كل ما تحتاجه.'
        }
      };
      const typeInfo = typeMap[selectedVal] || typeMap.ticket_inquiry;
      const targetCategory = typeInfo.categoryId;

      // Increment ticket counter for sequential numbering
      ticketData.counter = (ticketData.counter || 0) + 1;
      const ticketNum = String(ticketData.counter).padStart(4, '0');
      const channelName = `ticket-${ticketNum}`;

      // Create Private Channel in Category
      const newChannel = await discordApi(`/guilds/${config.GUILD_ID}/channels`, 'POST', {
        name: channelName,
        type: 0, // Text Channel
        parent_id: targetCategory,
        topic: `تذكرة: ${typeInfo.name} • صاحب التذكرة: ${username} (${userId})`,
        permission_overwrites: [
          {
            id: config.GUILD_ID, // @everyone -> HIDE
            type: 0,
            deny: (1 << 10).toString() // VIEW_CHANNEL denied
          },
          {
            id: userId, // User -> ALLOW
            type: 1,
            allow: ((1 << 10) | (1 << 11) | (1 << 15) | (1 << 16)).toString() // View, Send, Read History, Attach Files
          },
          {
            id: config.CLIENT_ID, // Bot -> Full Allow
            type: 1,
            allow: "8" // Administrator
          }
        ]
      });

      // Save to active tickets
      ticketData.openTickets[userId] = {
        channelId: newChannel.id,
        num: ticketNum,
        type: typeInfo.name,
        username: username,
        createdAt: Date.now()
      };
      saveTickets();

      // Send Welcome Message inside the new Ticket Channel
      await sendMessage(newChannel.id, {
        content: `<@${userId}>`,
        embeds: [
          {
            title: `${typeInfo.emoji} تذكرة ${typeInfo.name} #${ticketNum}`,
            description: `مرحباً بك <@${userId}> في تذكرتك الخاصة (${typeInfo.name})!\n\n${typeInfo.desc}\n\n⚠️ **قوانين:**\n• لا تسوي سبام رسائل بالتكت.\n• إغلاق التذكرة متاح فقط للمشرفين (Administrators).`,
            color: typeInfo.color,
            footer: { text: `Ticket #${ticketNum} • Kelvo Store` }
          }
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4, // DANGER / RED
                custom_id: 'close_ticket',
                label: 'إغلاق التذكرة (Close)',
                emoji: { name: '🔒' }
              }
            ]
          }
        ]
      });

      // Update follow-up to user
      await fetch(`https://discord.com/api/v10/webhooks/${config.CLIENT_ID}/${token}/messages/@original`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `✅ **تم فتح تذكرتك بنجاح:** <#${newChannel.id}> (#ticket-${ticketNum}) في قسم **${typeInfo.name}**`
        })
      });

      console.log(`[+] [تذكرة جديدة] فتح ${username} تذكرة ${typeInfo.name} (#ticket-${ticketNum}) في كاتجوري (${targetCategory})`);
    } catch (err) {
      console.error('Failed to create ticket channel:', err.message);
      ticketData.counter = Math.max(0, (ticketData.counter || 1) - 1);
      saveTickets();
      try {
        await fetch(`https://discord.com/api/v10/webhooks/${config.CLIENT_ID}/${token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `❌ **تعذر إنشاء روم التذكرة!**\nالسبب: البوت يحتاج صلاحية **Administrator** أو **Manage Channels** في السيرفر لإنشاء القنوات.\nيرجى تفعيل صلاحية Administrator لرتبة البوت Kelvo Bot أو إعطائه رتبة Kelvo Team.`
          })
        });
      } catch (e) {}
    }
    return;
  }

  // 2. CLOSE TICKET (ONLY ADMINISTRATOR)
  if (data.custom_id === 'close_ticket') {
    const channelId = interaction.channel_id;

    // Rule: Only Administrator can close!
    if (!isUserAdmin(member)) {
      await fetch(`https://discord.com/api/v10/interactions/${id}/${token}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 4,
          data: {
            content: `❌ **عذراً! لا يمكن إغلاق التذكرة إلا من قبل المشرفين (Administrators) فقط.**`,
            flags: 64 // EPHEMERAL
          }
        })
      });
      return;
    }

    // Admin verified! Close & Delete ticket
    await fetch(`https://discord.com/api/v10/interactions/${id}/${token}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 4,
        data: {
          content: `🔒 تم طلب إغلاق التذكرة بواسطة المشرف <@${userId}>. جاري حذف القناة خلال 3 ثوانٍ...`
        }
      })
    });

    // Remove from openTickets
    for (const u in ticketData.openTickets) {
      if (ticketData.openTickets[u].channelId === channelId) {
        delete ticketData.openTickets[u];
        break;
      }
    }
    saveTickets();

    setTimeout(async () => {
      try {
        await discordApi(`/channels/${channelId}`, 'DELETE');
        console.log(`[-] [إغلاق تذكرة] تم إغلاق وحذف قناة التذكرة (${channelId}) بواسطة المشرف ${username}`);
      } catch (e) {}
    }, 3000);
    return;
  }
}

// Automatic Sync of All Existing Members with 3-Month Role
async function syncExistingMembers() {
  try {
    const members = await discordApi('/guilds/' + config.GUILD_ID + '/members?limit=1000');
    if (!Array.isArray(members)) return;

    let addedCount = 0;
    const now = Date.now();

    for (const m of members) {
      if (!m.user || m.user.bot) continue;
      const roles = Array.isArray(m.roles) ? m.roles : [];

      if (roles.includes(config.THREE_MONTH_ROLE_ID)) {
        const existing = subscriptions.find(s => s.userId === m.user.id && s.active);
        if (!existing) {
          const expiresAt = now + (90 * 24 * 60 * 60 * 1000);
          subscriptions.push({
            userId: m.user.id,
            username: m.user.global_name || m.user.username,
            roleId: config.THREE_MONTH_ROLE_ID,
            roleName: config.THREE_MONTH_ROLE_NAME,
            startedAt: now,
            expiresAt: expiresAt,
            active: true
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) saveSubscriptions();
  } catch (err) {}
}

// Display 2-Category Roles Report
async function getRolesReport() {
  try {
    const members = await discordApi('/guilds/' + config.GUILD_ID + '/members?limit=1000');
    if (!Array.isArray(members)) return null;

    const threeMonthMembers = [];
    const lifetimeMembers = [];
    const now = Date.now();

    for (const m of members) {
      if (!m.user || m.user.bot) continue;
      const roles = Array.isArray(m.roles) ? m.roles : [];

      if (roles.includes(config.THREE_MONTH_ROLE_ID)) {
        const sub = subscriptions.find(s => s.userId === m.user.id && s.active);
        let daysLeft = 90;
        if (sub && sub.expiresAt) {
          daysLeft = Math.max(0, Math.ceil((sub.expiresAt - now) / (24 * 60 * 60 * 1000)));
        }
        threeMonthMembers.push(`• <@${m.user.id}> — متبقي: **${daysLeft}** يوم`);
      } else if (roles.includes(config.LIFETIME_ROLE_ID)) {
        lifetimeMembers.push(`• <@${m.user.id}> — \`دائم ∞\``);
      }
    }

    return { threeMonthMembers, lifetimeMembers };
  } catch (e) {
    return null;
  }
}

// Check & Expire Subscriptions (Auto Kick)
async function checkExpiredSubscriptions() {
  const now = Date.now();
  let changed = false;

  for (const sub of subscriptions) {
    if (sub.active && sub.expiresAt && now >= sub.expiresAt) {
      console.log('⏰ [انتهاء اشتراك] انتهت مدة الـ 90 يوماً للعضو: ' + sub.username + ' (' + sub.userId + ')');
      try {
        if (config.THREE_MONTH_ROLE_ID) {
          await discordApi('/guilds/' + config.GUILD_ID + '/members/' + sub.userId + '/roles/' + config.THREE_MONTH_ROLE_ID, 'DELETE');
          console.log('✅ تم سحب رتبة الـ 3 شهور من ' + sub.username + ' تلقائياً من ديسكورد!');
        }
        sub.active = false;
        sub.expiredAt = now;
        changed = true;
      } catch (err) {
        console.error('❌ تعذر سحب الرتبة تلقائياً من ' + sub.username + ':', err.message);
      }
    }
  }

  if (changed) saveSubscriptions();
}

// Real-Time Member Update
function handleMemberUpdate(data) {
  const userId = data.user ? data.user.id : null;
  const username = data.user ? (data.user.global_name || data.user.username) : 'User';
  const roles = Array.isArray(data.roles) ? data.roles : [];

  if (!userId) return;

  const hasThreeMonth = roles.includes(config.THREE_MONTH_ROLE_ID);
  const existingSub = subscriptions.find(s => s.userId === userId && s.active);

  if (hasThreeMonth && !existingSub) {
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000);
    subscriptions.push({
      userId: userId,
      username: username,
      roleId: config.THREE_MONTH_ROLE_ID,
      roleName: config.THREE_MONTH_ROLE_NAME,
      startedAt: now,
      expiresAt: expiresAt,
      active: true
    });
    saveSubscriptions();
    console.log(`🎉 [إعطاء رتبة تلقائي] حصل ${username} على رتبة 3 شهور! بدأ عداد الـ 90 يوماً.`);
  }

  if (!hasThreeMonth && existingSub) {
    existingSub.active = false;
    existingSub.revokedAt = Date.now();
    saveSubscriptions();
    console.log(`🚫 [سحب رتبة تلقائي] سُحبت رتبة 3 شهور من ${username}! سيتم طرده من الإضافة.`);
  }
}

// Real-Time New Member Join
async function handleMemberAdd(data) {
  const user = data.user;
  if (!user || user.bot) return;

  const name = user.global_name || user.username;
  console.log(`📥 [عضو جديد] دخل السيرفر الآن: ${name} (ID: ${user.id})`);

  // Send Welcome Message in 「✋」welcome
  try {
    await sendMessage(config.WELCOME_CHANNEL_ID, {
      content: `👋 مرحباً بك يا <@${user.id}> في سيرفر **KELVO STORE**! نورت السيرفر ✨`
    });
  } catch (e) {}
}

// Real-Time Channel Delete (Manual Ticket Deletion Detection)
function handleChannelDelete(channel) {
  if (!channel || !channel.id) return;
  const deletedId = channel.id;
  for (const userId in ticketData.openTickets) {
    if (ticketData.openTickets[userId].channelId === deletedId) {
      console.log(`[-] [حذف يدوي] تم حذف روم التذكرة (${deletedId}) يدوياً من السيرفر. تم فك الحظر عن العضو (${userId}) ليتمكن من فتح تذكرة جديدة فوراً.`);
      delete ticketData.openTickets[userId];
      saveTickets();
      break;
    }
  }
}

// Cleanup any ghost tickets where channel no longer exists
async function cleanupGhostTickets() {
  let cleaned = 0;
  for (const userId in ticketData.openTickets) {
    const chId = ticketData.openTickets[userId].channelId;
    try {
      await discordApi(`/channels/${chId}`);
    } catch (e) {
      delete ticketData.openTickets[userId];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    saveTickets();
    console.log(`🧹 تم تنظيف وإلغاء ${cleaned} تذكرة قديمة تم حذف روماتها من السيرفر.`);
  }
}

let activeIntents = 33281;

// Connect to Discord Gateway
function connectGateway() {
  const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
  let heartbeatInterval = null;
  let lastSequence = null;

  ws.onopen = () => {
    console.log('🌐 جاري الاتصال بخوادم ديسكورد (Gateway)...');
  };

  ws.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data);
      const { op, d, s, t } = payload;
      if (s) lastSequence = s;

      if (op === 10) {
        heartbeatInterval = setInterval(() => {
          ws.send(JSON.stringify({ op: 1, d: lastSequence }));
        }, d.heartbeat_interval);

        ws.send(JSON.stringify({
          op: 2,
          d: {
            token: BOT_AUTH_TOKEN,
            intents: activeIntents,
            properties: { os: 'windows', browser: 'kelvo-bot-24h', device: 'kelvo-bot-24h' }
          }
        }));
      }

      if (op === 0) {
        if (t === 'READY') {
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('🤖 بوت Kelvo Enhancer متصل وشغال الآن بنجاح (Online)!');
          console.log('👤 اسم البوت: ' + d.user.username + '#' + d.user.discriminator);
          console.log('🎫 نظام التذاكر: مفعل (Support & Buying)');
          console.log('📂 كاتجوري التذاكر: TICKET (' + config.TICKET_CATEGORY_ID + ')');
          console.log('🔢 ترقيم التذاكر: يبدأ من #ticket-0001 تصاعدياً');
          console.log('🔒 إغلاق التذاكر: مقتصر على المشرفين (Administrators)');
          console.log('═══════════════════════════════════════════════════════════════');

          await cleanupGhostTickets();
          await syncExistingMembers();

          setInterval(checkExpiredSubscriptions, (config.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000);
          setInterval(syncExistingMembers, (config.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000);
          setInterval(cleanupGhostTickets, 10 * 60 * 1000); // Check ghost tickets every 10 min
          checkExpiredSubscriptions();
        }

        // 1. Interaction Create (Ticket Select & Close Button)
        if (t === 'INTERACTION_CREATE') {
          handleInteraction(d);
        }

        // 2. Member Update (Role added / removed)
        if (t === 'GUILD_MEMBER_UPDATE') {
          handleMemberUpdate(d);
        }

        // 3. Member Join (New user entered server)
        if (t === 'GUILD_MEMBER_ADD') {
          handleMemberAdd(d);
        }

        // 4. Channel Delete (Admin manually deleted a ticket channel)
        if (t === 'CHANNEL_DELETE') {
          handleChannelDelete(d);
        }

        // 5. Message Commands
        if (t === 'MESSAGE_CREATE') {
          handleMessage(d);
        }
      }
    } catch (e) {
      console.error('Gateway parse error:', e.message);
    }
  };

  ws.onclose = (e) => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    if (e.code === 4014 && activeIntents !== 1) {
      console.log('⚠️ [تنبيه] خيار Server Members Intent غير مفعل في Developer Portal.');
      console.log('💡 جاري الاتصال بالوضع الأساسي مع استمرار عمل الفحص الدوري والسحب التلقائي والتذاكر!');
      activeIntents = 1;
      setTimeout(connectGateway, 2000);
      return;
    }

    console.warn('⚠️ انقطع الاتصال (' + e.code + ')، جاري إعادة المحاولة تلقائياً...');
    setTimeout(connectGateway, 5000);
  };

  ws.onerror = (e) => {
    console.error('WebSocket error:', e.message || e);
  };
}

// Extract Target User ID from Mention or Plain ID
function extractUserId(arg) {
  if (!arg) return null;
  const match = arg.match(/^<@!?(\d+)>$/);
  if (match) return match[1];
  if (/^\d{17,20}$/.test(arg)) return arg;
  return null;
}

// Handle Bot Commands
async function handleMessage(msg) {
  if (msg.author.bot) return;
  const content = (msg.content || '').trim();
  if (!content.startsWith('!')) return;

  const parts = content.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Command: !ticket (Resends ticket panel)
  if (command === 'ticket' || command === 'ticket-setup') {
    await sendTicketPanel(msg.channel_id);
    return;
  }

  // Command: !cleantickets (Reset all stored open tickets)
  if (command === 'cleantickets' || command === 'reset-tickets') {
    ticketData.openTickets = {};
    saveTickets();
    await sendMessage(msg.channel_id, '✅ **تم تنظيف وحذف جميع التذاكر المسجلة بنجاح!**\nالآن يمكن لأي شخص فتح تذكرة جديدة فوراً.');
    return;
  }

  // Command: !roles or !members (2-Category Role Tracker)
  if (command === 'roles' || command === 'members' || command === 'subs') {
    const report = await getRolesReport();
    if (!report) {
      await sendMessage(msg.channel_id, '❌ تعذر جلب قائمة الرتب.');
      return;
    }

    const threeMText = report.threeMonthMembers.length > 0 ? report.threeMonthMembers.join('\n') : '• لا يوجد مشتركون حالياً';
    const lifetimeText = report.lifetimeMembers.length > 0 ? report.lifetimeMembers.join('\n') : '• لا يوجد مشتركون حالياً';

    await sendMessage(msg.channel_id, {
      embeds: [
        {
          title: '📊 قائمة المشتركين وأصحاب الرتب في السيرفر',
          color: 0x22c55e,
          fields: [
            {
              name: '⏳ الخانة الأولى: أصحاب رتبة الـ 3 شهور (3 Month Subscription)',
              value: threeMText,
              inline: false
            },
            {
              name: '👑 الخانة الثانية: أصحاب رتبة مدى الحياة (Lifetime Access)',
              value: lifetimeText,
              inline: false
            }
          ],
          footer: { text: 'Kelvo Enhancer • Role Manager' }
        }
      ]
    });
    return;
  }

  // Command: !sub 3m @user  OR  !sub lifetime @user
  if (command === 'sub') {
    const type = (args[0] || '').toLowerCase();
    const targetId = extractUserId(args[1]);

    if (!targetId || (type !== '3m' && type !== 'lifetime' && type !== '3months')) {
      await sendMessage(msg.channel_id, '❌ طريقة الاستخدام:\n`!sub 3m @user` أو `!sub lifetime @user`');
      return;
    }

    if (type === '3m' || type === '3months') {
      try {
        await discordApi('/guilds/' + config.GUILD_ID + '/members/' + targetId + '/roles/' + config.THREE_MONTH_ROLE_ID, 'PUT');
        const now = Date.now();
        const expiresAt = now + (90 * 24 * 60 * 60 * 1000);

        const existingIdx = subscriptions.findIndex(s => s.userId === targetId);
        const subData = {
          userId: targetId,
          username: (args[1] || targetId).replace(/[<@!>]/g, ''),
          roleId: config.THREE_MONTH_ROLE_ID,
          roleName: config.THREE_MONTH_ROLE_NAME,
          startedAt: now,
          expiresAt: expiresAt,
          active: true
        };

        if (existingIdx !== -1) subscriptions[existingIdx] = subData;
        else subscriptions.push(subData);
        saveSubscriptions();

        const expDate = new Date(expiresAt).toISOString().split('T')[0];
        await sendMessage(msg.channel_id, `✅ **تم تفعيل اشتراك 3 شهور بنجاح!**\n👤 العضو: <@${targetId}>\n⏳ المدة: 90 يوماً\n📅 ينتهي في: \`${expDate}\`\n*(البوت سيسحب الرتبة ويطرده من الإضافة تلقائياً بعد 90 يوم)*`);
      } catch (err) {
        await sendMessage(msg.channel_id, '❌ تعذر إعطاء الرتبة: ' + err.message);
      }
      return;
    }

    if (type === 'lifetime') {
      try {
        await discordApi('/guilds/' + config.GUILD_ID + '/members/' + targetId + '/roles/' + config.LIFETIME_ROLE_ID, 'PUT');
        await sendMessage(msg.channel_id, `👑 **تم تفعيل رتبة مدى الحياة (Lifetime) بنجاح!**\n👤 العضو: <@${targetId}>`);
      } catch (err) {
        await sendMessage(msg.channel_id, '❌ تعذر إعطاء الرتبة: ' + err.message);
      }
      return;
    }
  }

  // Command: !unsub @user
  if (command === 'unsub') {
    const targetId = extractUserId(args[0]);
    if (!targetId) {
      await sendMessage(msg.channel_id, '❌ طريقة الاستخدام: `!unsub @user`');
      return;
    }

    try {
      if (config.THREE_MONTH_ROLE_ID) {
        await discordApi('/guilds/' + config.GUILD_ID + '/members/' + targetId + '/roles/' + config.THREE_MONTH_ROLE_ID, 'DELETE').catch(() => null);
      }
      if (config.LIFETIME_ROLE_ID) {
        await discordApi('/guilds/' + config.GUILD_ID + '/members/' + targetId + '/roles/' + config.LIFETIME_ROLE_ID, 'DELETE').catch(() => null);
      }

      const sub = subscriptions.find(s => s.userId === targetId && s.active);
      if (sub) {
        sub.active = false;
        sub.revokedAt = Date.now();
        saveSubscriptions();
      }

      await sendMessage(msg.channel_id, `🚫 **تم سحب الرتبة من <@${targetId}> بنجاح!**\nسيتم قفل الإضافة وطرده فوراً.`);
    } catch (err) {
      await sendMessage(msg.channel_id, '❌ تعذر سحب الرتبة: ' + err.message);
    }
    return;
  }

  // Command: !help
  if (command === 'help') {
    const helpMsg = 
      '📋 **أوامر بوت Kelvo Enhancer:**\n\n' +
      '• `!roles` أو `!members` - عرض الخانتين (أصحاب رتبة 3 شهور وأصحاب رتبة مدى الحياة)\n' +
      '• `!ticket` - إعادة إرسال بنل التذاكر في الروم\n' +
      '• `!sub 3m @user` - إعطاء رتبة 3 شهور لعضو (تُسحب تلقائياً بعد 90 يوم)\n' +
      '• `!sub lifetime @user` - إعطاء رتبة مدى الحياة\n' +
      '• `!unsub @user` - سحب الرتبة وطرده من الإضافة فوراً';
    await sendMessage(msg.channel_id, helpMsg);
    return;
  }
}

// Start Gateway
connectGateway();
