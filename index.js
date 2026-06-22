require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, 'MyCustomFont');

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const TARGET_CHANNEL_ID = '1501583456872829068';
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';

// دالة قص البانر (مع ترك هوامش كما في صورتك)
function drawImageCover(ctx, img, x, y, width, height) {
    const ratio = Math.max(width / img.width, height / img.height);
    const sWidth = width / ratio;
    const sHeight = height / ratio;
    const sx = (img.width - sWidth) / 2;
    const sy = (img.height - sHeight) / 2;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
}

async function createProfileCard(bannerUrl, avatarUrl, member) {
    // أبعاد الكانفاس لتعطي نفس نسبة الطول والعرض الموجودة في صورتك
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    const font = fs.existsSync(fontPath) ? '"MyCustomFont"' : 'Arial';

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    // البانر: مقصوص من الحواف ومترك مساحة في الأعلى
    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 30, 30, 940, 280); 

    // الأفاتار: بنفس الحجم والموقع
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 370, 85, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 65, 285, 170, 170);
    ctx.restore();

    // النصوص (أحجام صغيرة ودقيقة)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(member.user.username, 260, 380);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `18px ${font}`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 410);

    // الخط الفاصل
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(950, 480);
    ctx.stroke();

    // التواريخ
    ctx.fillStyle = '#666666';
    ctx.font = `bold 12px ${font}`;
    ctx.fillText('MEMBER SINCE', 50, 520);
    ctx.fillText('JOINED SERVER', 550, 520);

    ctx.fillStyle = '#ffffff';
    ctx.font = `16px ${font}`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 550);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 550, 550);

    return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
}

client.once('ready', async () => {
    client.user.setPresence({ activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], status: 'online' });
    const vc = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (vc) joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator });
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design')) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return message.reply('❌ ليس لديك الصلاحية.');
    if (message.attachments.size < 2) return message.reply('⚠️ يرجى إرفاق صورتين.');

    const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
    try {
        const card = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        await targetChannel.send({ files: [card] });
        // إيقاف التنفيذ لضمان عدم التكرار
    } catch (err) {
        console.error(err);
        message.reply('❌ خطأ في التصميم.');
    }
});

client.login(process.env.TOKEN);
