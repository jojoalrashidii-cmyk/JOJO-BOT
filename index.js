require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const TARGET_CHANNEL_ID = '1501583456872829068';
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';
const isProcessing = new Set();

async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    
    // خلفية داكنة
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    // البانر: تم تكبيره ليمتد أكثر من الأسفل
    const banner = await loadImage(bannerUrl);
    ctx.drawImage(banner, 0, 0, 1000, 360); 

    // الأفاتار: دائري بموقع متداخل دقيق
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 420, 95, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 55, 325, 190, 190);
    ctx.restore();

    // النصوص (أحجام دقيقة كما في صورتك)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial'; 
    ctx.fillText(member.user.username, 280, 430);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px Arial';
    ctx.fillText('@' + member.user.username.toLowerCase(), 280, 460);

    // الخط الفاصل
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(50, 520);
    ctx.lineTo(950, 520);
    ctx.stroke();

    // النصوص السفلية (MEMBER SINCE / JOINED SERVER)
    ctx.fillStyle = '#777777';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('MEMBER SINCE', 50, 560);
    ctx.fillText('JOINED SERVER', 550, 560);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 585);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 550, 585);

    return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design') || isProcessing.has(message.author.id)) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return message.reply('❌ ليس لديك الصلاحية.');
    if (message.attachments.size < 2) return message.reply('⚠️ يرجى إرفاق صورتين.');

    isProcessing.add(message.author.id);
    const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
    
    try {
        const card = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        await targetChannel.send({ files: [card] });
    } catch (err) {
        console.error(err);
    } finally {
        isProcessing.delete(message.author.id);
    }
});

client.login(process.env.TOKEN);
