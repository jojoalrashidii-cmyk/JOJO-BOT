require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

// --- إعداد الفونت ---
const FONT_NAME = 'MyCustomFont';
const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, FONT_NAME);
    console.log('✅ تم تحميل الخط بنجاح');
} else {
    console.error('⚠️ خطأ: ملف font.ttf غير موجود في المجلد!');
}

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

// الرومات المطلوبة
const DESIGN_CHANNEL_ID = '1501583456872829068';
const MATCHING_CHANNEL_ID = '1518670780911583283';
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';
const isProcessing = new Set();
const designCache = new Map();

// --- اتصال البوت والستريم ---
client.once(Events.ClientReady, async (c) => {
    client.user.setPresence({ 
        activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
        status: 'online' 
    });
    
    const vc = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (vc) {
        const connection = joinVoiceChannel({
            channelId: vc.id,
            guildId: vc.guild.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
        });
        connection.on(VoiceConnectionStatus.Ready, () => console.log('✅ متصل بالروم الصوتي!'));
    }
});

function drawImageCover(ctx, img, x, y, width, height) {
    const ratio = Math.max(width / img.width, height / img.height);
    const sWidth = width / ratio;
    const sHeight = height / ratio;
    const sx = (img.width - sWidth) / 2;
    const sy = (img.height - sHeight) / 2;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
}

// دالة رسم الأفاتارات المتعددة بحواف دائرية
async function drawAvatars(ctx, avatarUrls, startX, y, size = 150) {
    for (let i = 0; i < avatarUrls.length; i++) {
        ctx.save();
        ctx.beginPath();
        // رسم الدائرة والحواف
        ctx.arc(startX + (i * (size + 20)) + (size / 2), y + (size / 2), size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#0f0f0f';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#0f0f0f';
        ctx.stroke();
        ctx.clip();
        
        const avatar = await loadImage(avatarUrls[i]);
        ctx.drawImage(avatar, startX + (i * (size + 20)), y, size, size);
        ctx.restore();
    }
}

async function createMatchingCard(bannerUrl, avatarUrls, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 40, 40, 920, 300); 
    
    // رسم الأفاتارات (موقعها: x=60, y=330)
    await drawAvatars(ctx, avatarUrls, 60, 330, 150);

    // حساب بداية النصوص (بجانب الأفاتارات)
    const textStartX = 60 + (avatarUrls.length * 170);

    // النصوص (الاسم واليوزر)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 40px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, textStartX, 380);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `20px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), textStartX, 420);

    // البيانات (MEMBER SINCE / JOINED SERVER)
    ctx.fillStyle = '#777777';
    ctx.font = `bold 14px "${FONT_NAME}"`;
    ctx.fillText('MEMBER SINCE', textStartX, 470);
    ctx.fillText('JOINED SERVER', textStartX + 200, 470);

    ctx.fillStyle = '#ffffff';
    ctx.font = `20px "${FONT_NAME}"`;
    
    const memberSince = member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day
