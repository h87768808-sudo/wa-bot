const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

let events = fs.existsSync('./events.json')? JSON.parse(fs.readFileSync('./events.json')) : [];
let warnings = fs.existsSync('./warnings.json')? JSON.parse(fs.readFileSync('./warnings.json')) : {};
let scores = fs.existsSync('./scores.json')? JSON.parse(fs.readFileSync('./scores.json')) : {};
let rules = "1- الاحترام المتبادل\n2- ممنوع الروابط والارقام\n3- مسموح للكل يعمل فعاليات";
let lastEventTime = {};
let gameState = {};

const characters = [
    { file: './anime_eyes/naruto.jpg', names: ['ناروتو', 'naruto'] },
    { file: './anime_eyes/luffy.jpg', names: ['لوفي', 'luffy'] },
    { file: './anime_eyes/gojo.jpg', names: ['غوجو', 'gojo'] },
    { file: './anime_eyes/levi.jpg', names: ['ليفاي', 'levi'] },
    { file: './anime_eyes/goku.jpg', names: ['غوكو', 'goku'] },
];

function saveAll() {
    fs.writeFileSync('./events.json', JSON.stringify(events, null, 2));
    fs.writeFileSync('./warnings.json', JSON.stringify(warnings, null, 2));
    fs.writeFileSync('./scores.json', JSON.stringify(scores, null, 2));
}

function zakhraf(text) {
    return [
        `꧁ ${text} ꧂`,
        `★彡 ${text} 彡★`,
        `『 ${text} 』`,
        `ـ『 ${text} 』ـ`,
        `༺ ${text} ༻`,
        `『 ${text} 』 ♛`
    ];
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({ auth: state });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.qr) {
            console.log("اعمل Scan للـ QR:");
            qrcode.generate(u.qr, { small: true });
        }
        if (u.connection === 'open') console.log('بوت إلياس كايزر اشتغل ✅');
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) return;

        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const textLower = text.toLowerCase();

        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants;
        const sender = participants.find(p => p.id === msg.key.participant);
        const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin';
        const bot = participants.find(p => p.id === sock.user.id);
        const isBotAdmin = bot?.admin === 'admin' || bot?.admin === 'superadmin';

        const linkRegex = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|chat\.whatsapp\.com\/|discord\.gg\/)/i;
        const hasContact =!!(msg.message.contactMessage || msg.message.contactsArrayMessage);
        const hasLink = linkRegex.test(textLower);

        if (!isSenderAdmin && (hasLink || hasContact)) {
            if (!isBotAdmin) return;
            const targetId = msg.key.participant;
            try {
                await sock.sendMessage(from, { delete: msg.key });
                await sock.groupSettingUpdate(from, 'announcement');
                await sock.groupParticipantsUpdate(from, [targetId], 'remove');
                const deco = zakhraf("تم اخضاع العضو بنجاح بواسطة إلياس كايزر")[0];
                await sock.sendMessage(from, {
                    text: `🔒 تم قفل الشات تلقائيا\n\n${deco}\n@${targetId.split('@')[0]}\nالسبب: ${hasLink? 'رابط ممنوع' : 'جهة اتصال'}\n\nلفتح الشات: /فتح`,
                    mentions: [targetId]
                });
            } catch (e) { console.log(e); }
            return;
        }

        if (textLower === 'بوت' || textLower === 'يا بوت') {
            const decoReply = zakhraf("عمك إلياس كايزر لسا مسيطر")[1];
            await sock.sendMessage(from, { text: decoReply });
            return;
        }

        if (text === '/قفل' && isSenderAdmin) {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: '🔒 تم قفل الشات - للمشرفين فقط' });
        }
        if (text === '/فتح' && isSenderAdmin) {
            await sock.groupSettingUpdate(from, 'not_announcement');
            await sock.sendMessage(from, { text: '🔓 تم فتح الشات للكل' });
        }
        if (text.startsWith('/طرد') && isSenderAdmin) {
            if (mentionedJid.length === 0) return;
            await sock.groupParticipantsUpdate(from, mentionedJid, 'remove');
            const deco = zakhraf("تم اخضاع العضو بنجاح بواسطة إلياس كايزر")[0];
            await sock.sendMessage(from, { text: `${deco}`, mentions: mentionedJid });
        }
        if (text.startsWith('/ترقية') && isSenderAdmin && mentionedJid.length > 0) {
            await sock.groupParticipantsUpdate(from, mentionedJid, 'promote');
            await sock.sendMessage(from, { text: '✅ تمت الترقية لمشرف' });
        }
        if (text.startsWith('/تحذير') && isSenderAdmin && mentionedJid.length > 0) {
            const target = mentionedJid[0];
            warnings[target] = (warnings[target] || 0) + 1;
            if (warnings[target] >= 3) {
                await sock.groupParticipantsUpdate(from, [target], 'remove');
                delete warnings[target];
                await sock.sendMessage(from, { text: `تم اخضاع العضو بنجاح بواسطة إلياس كايزر 😈 - 3 تحذيرات`, mentions: [target] });
            } else {
                await sock.sendMessage(from, {
