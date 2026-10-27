// ═════════════════════════════════════════════════════════════════════
// KELVO ENHANCER - 24/7 DISCORD AUTOMATION BOT
// 100% Automatic: Gives, tracks, and strips 3-month roles automatically
// Runs natively on Node.js 18+ (No external packages required)
// ═════════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const subsPath = path.join(__dirname, 'subscriptions.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ ملف config.json غير موجود!');
  process.exit(1);
}

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 1. Built-in Keep-Alive HTTP Server (For 24/7 Cloud Hosting on Render/Railway/Koyeb)
const PORT = process.env.PORT || config.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'online',
    bot: 'Kelvo Enhancer Role Manager',
    uptime: Math.floor(process.uptime()) + 's',
    activeSubscriptions: subscriptions.filter(s => s.active).length,
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log('🌐 خادم الـ 24h جاهز ويعمل على المنفذ: ' + PORT);
});

// Check Bot Token
const botToken = process.env.BOT_TOKEN || config.BOT_TOKEN;
if (!botToken || botToken === 'YOUR_BOT_TOKEN_HERE') {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚠️  يرجى وضع توكن البوت (Bot Token) في ملف config.json');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Load or create subscriptions
let subscriptions = [];
if (fs.existsSync(subsPath)) {
  try {
    subscriptions = JSON.parse(fs.readFileSync(subsPath, 'utf8'));
  } catch (e) {
    subscriptions = [];
  }
}

function saveSubscriptions() {
  fs.writeFileSync(subsPath, JSON.stringify(subscriptions, null, 2), 'utf8');
}

// Discord REST API Helper
async function discordApi(endpoint, method = 'GET', body = null) {
  const token = process.env.BOT_TOKEN || config.BOT_TOKEN;
  if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    throw new Error('لم يتم تعيين توكن البوت بعد');
  }

  const url = 'https://discord.com/api/v10' + endpoint;
  const options = {
    method,
    headers: {
      'Authorization': 'Bot ' + token,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (res.status === 204) return true;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && data.message ? data.message : 'HTTP ' + res.status);
  }
  return data;
}

// Send Message to Channel
async function sendMessage(channelId, content) {
  try {
    return await discordApi('/channels/' + channelId + '/messages', 'POST', { content });
  } catch (err) {
    console.error('Error sending message:', err.message);
  }
}

// Automatic Sync of All Existing Members with 3-Month Role
async function syncExistingMembers() {
  try {
    console.log('🔍 [تلقائي] جاري فحص ومزامنة أعضاء السيرفر...');
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
          console.log('⚡ [مزامنة تلقائية] تم تسجيل اشتراك العضو: ' + m.user.username + ' (' + m.user.id + ') لمدة 90 يوماً');
        }
      }
    }

    if (addedCount > 0) {
      saveSubscriptions();
      console.log('✅ تم حفظ ' + addedCount + ' مشترك في ملف الاشتراكات تلقائياً!');
    }
  } catch (err) {
    if (err.message.includes('Unknown Guild')) {
      console.log('💡 تنبيه: البوت لم يدخل السيرفر بعد. يرجى دعوة البوت عبر الرابط الخاص بك.');
    } else {
      console.warn('Sync notice:', err.message);
    }
  }
}

// Automatic Expiration Checker: Strips Role from Discord when 90 Days End
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

  if (changed) {
    saveSubscriptions();
  }
}

// Handle Real-Time Role Changes (GUILD_MEMBER_UPDATE)
function handleMemberUpdate(data) {
  const userId = data.user ? data.user.id : null;
  const username = data.user ? (data.user.global_name || data.user.username) : 'User';
  const roles = Array.isArray(data.roles) ? data.roles : [];

  if (!userId) return;

  const hasThreeMonth = roles.includes(config.THREE_MONTH_ROLE_ID);
  const existingSub = subscriptions.find(s => s.userId === userId && s.active);

  // 1. Role was ADDED in Discord:
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
    console.log('🎉 [اكتشاف تلقائي] تم إعطاء رتبة 3 شهور للعضو: ' + username + ' (' + userId + ') — تم تفعيل عداد الـ 90 يوماً تلقائياً!');
  }

  // 2. Role was REMOVED in Discord:
  if (!hasThreeMonth && existingSub) {
    existingSub.active = false;
    existingSub.revokedAt = Date.now();
    saveSubscriptions();
    console.log('🚫 [اكتشاف تلقائي] تم سحب رتبة 3 شهور من العضو: ' + username + ' (' + userId + ') — سيتم طرده من الإضافة فوراً عند فتحها!');
  }
}

let activeIntents = 33281; // Full intents: GUILDS (1) + GUILD_MEMBERS (2) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768)

// Connect to Discord Gateway WebSocket
function connectGateway() {
  const token = process.env.BOT_TOKEN || config.BOT_TOKEN;
  if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    return;
  }

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

      // Opcode 10: Hello
      if (op === 10) {
        heartbeatInterval = setInterval(() => {
          ws.send(JSON.stringify({ op: 1, d: lastSequence }));
        }, d.heartbeat_interval);

        // Opcode 2: Identify
        ws.send(JSON.stringify({
          op: 2,
          d: {
            token: token,
            intents: activeIntents,
            properties: {
              os: 'windows',
              browser: 'kelvo-bot-24h',
              device: 'kelvo-bot-24h'
            }
          }
        }));
      }

      // Opcode 0: Dispatch Events
      if (op === 0) {
        if (t === 'READY') {
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('🤖 بوت Kelvo Enhancer متصل الآن بنجاح!');
          console.log('👤 البوت: ' + d.user.username + '#' + d.user.discriminator);
          console.log('🆔 آيدي رتبة الـ 3 شهور: ' + config.THREE_MONTH_ROLE_ID);
          console.log('👑 آيدي رتبة مدى الحياة: ' + config.LIFETIME_ROLE_ID);
          console.log('═══════════════════════════════════════════════════════════════');

          await syncExistingMembers();

          // Check every 5 minutes
          setInterval(checkExpiredSubscriptions, (config.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000);
          setInterval(syncExistingMembers, (config.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000);
          checkExpiredSubscriptions();
        }

        // Live Role Add/Remove Detection
        if (t === 'GUILD_MEMBER_UPDATE') {
          handleMemberUpdate(d);
        }

        // Chat Commands
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

    // If Privileged Intent 4014 occurred, fallback to basic intent (1) so bot never goes down!
    if (e.code === 4014 && activeIntents !== 1) {
      console.log('⚠️ [تنبيه] خيار Server Members Intent غير مفعل في Developer Portal.');
      console.log('💡 جاري الاتصال بالوضع الأساسي مع استمرار عمل الفحص الدوري والسحب التلقائي!');
      console.log('👉 لتفعيل المراقبة اللحظية: ادخل Developer Portal > Bot وفعّل Server Members Intent.');
      activeIntents = 1;
      setTimeout(connectGateway, 2000);
      return;
    }

    console.warn('⚠️ انقطع الاتصال (' + e.code + ')، جاري إعادة المحاولة تلقائياً خلال 5 ثوانٍ...');
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

  if (command === 'help') {
    const helpMsg = 
      '📋 **أوامر بوت Kelvo Enhancer لإدارة الرتب والاشتراكات:**\n\n' +
      '• `!sub 3m @user` - إعطاء رتبة 3 شهور لعضو (يسحبها تلقائياً بعد 90 يوم)\n' +
      '• `!sub lifetime @user` - إعطاء رتبة مدى الحياة (Lifetime Access)\n' +
      '• `!unsub @user` - سحب الرتبة وطرده من الإضافة فوراً\n' +
      '• `!check @user` - فحص الأيام المتبقية لاشتراك العضو\n' +
      '• `!list` - عرض المشتركين النشطين في نظام الـ 3 شهور\n\n' +
      '💡 *ملاحظة:* البوت تلقائي 100%، يمكنك أيضاً إعطاء الرتبة للعضو في ديسكورد مباشرة وسيتعرف عليها فوراً!';
    await sendMessage(msg.channel_id, helpMsg);
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

        if (existingIdx !== -1) {
          subscriptions[existingIdx] = subData;
        } else {
          subscriptions.push(subData);
        }
        saveSubscriptions();

        const expDate = new Date(expiresAt).toISOString().split('T')[0];
        await sendMessage(msg.channel_id, '✅ **تم تفعيل اشتراك 3 شهور بنجاح!**\n👤 العضو: <@' + targetId + '>\n⏳ المدة: 90 يوماً\n📅 ينتهي في: `' + expDate + '`\n*(البوت سيسحب الرتبة ويطرده من الإضافة تلقائياً فور انتهاء المدة)*');
      } catch (err) {
        await sendMessage(msg.channel_id, '❌ تعذر إعطاء الرتبة: ' + err.message + '\n*(تأكد من أن رتبة البوت في إعدادات السيرفر تقع فوق رتبة الاشتراك)*');
      }
      return;
    }

    if (type === 'lifetime') {
      try {
        await discordApi('/guilds/' + config.GUILD_ID + '/members/' + targetId + '/roles/' + config.LIFETIME_ROLE_ID, 'PUT');
        await sendMessage(msg.channel_id, '👑 **تم تفعيل رتبة مدى الحياة (Lifetime) بنجاح!**\n👤 العضو: <@' + targetId + '>');
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

      await sendMessage(msg.channel_id, '🚫 **تم سحب الرتبة من <@' + targetId + '> بنجاح!**\nسيتم قفل الإضافة وطرده فوراً عند فتحها.');
    } catch (err) {
      await sendMessage(msg.channel_id, '❌ تعذر سحب الرتبة: ' + err.message);
    }
    return;
  }

  // Command: !check @user
  if (command === 'check') {
    const targetId = extractUserId(args[0]);
    if (!targetId) {
      await sendMessage(msg.channel_id, '❌ طريقة الاستخدام: `!check @user`');
      return;
    }

    const sub = subscriptions.find(s => s.userId === targetId && s.active);
    if (!sub) {
      await sendMessage(msg.channel_id, 'ℹ️ لا يوجد اشتراك 3 شهور نشط لهذا العضو.');
      return;
    }

    const daysLeft = Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    const expDate = new Date(sub.expiresAt).toISOString().split('T')[0];
    await sendMessage(msg.channel_id, '📊 **بيانات اشتراك <@' + targetId + '>:**\n• الرتبة: ' + sub.roleName + '\n• الأيام المتبقية: **' + daysLeft + '** يوم\n• تاريخ الانتهاء: `' + expDate + '`');
    return;
  }

  // Command: !list
  if (command === 'list') {
    const activeSubs = subscriptions.filter(s => s.active);
    if (activeSubs.length === 0) {
      await sendMessage(msg.channel_id, 'ℹ️ لا يوجد مشتركون نشطون حالياً.');
      return;
    }

    let listText = '📋 **قائمة المشتركين النشطين (اشتراك 3 شهور):**\n\n';
    activeSubs.forEach((s, idx) => {
      const daysLeft = Math.max(0, Math.ceil((s.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
      listText += (idx + 1) + '. <@' + s.userId + '> — متبقي: **' + daysLeft + '** يوم\n';
    });
    await sendMessage(msg.channel_id, listText);
    return;
  }
}

// Start Gateway
connectGateway();
