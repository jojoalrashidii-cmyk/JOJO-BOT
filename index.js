require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events } = require('discord.js');
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

// دالة رسم احترافية
async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(900, 500); // الأبعاد الأصلية التي اخترتها
    const ctx = canvas.getContext('2d');
    const font = fs.existsSync(fontPath) ? '"MyCustomFont"' : 'Arial';

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 900, 500);

    const banner = await loadImage(bannerUrl);
    ctx.drawImage(banner, 0, 0, 900, 250);

    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 350, 80, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 70, 270, 160, 160);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 30px ${font}`;
    ctx.fillText(member.user.username, 260, 320);
    
    ctx.font = `16px ${font}`;
    ctx.fillStyle = '#b9bbbe';
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 350);

    ctx.strokeStyle = '#2f3136';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 420);
    ctx.lineTo(850, 420);
    ctx.stroke();

    ctx.fillStyle = '#b9bbbe';
    ctx.font = `12px ${font}`;
    ctx.fillText('MEMBER SINCE', 60, 450);
    ctx.fillText('JOINED SERVER', 500, 450);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 18px ${font}`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 60, 475);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 500, 475);

    return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
}

client.once('ready', async () => {
    client.user.setPresence({ activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], status: 'online' });
    const vc = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (vc) joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator });
});

// منع التكرار: استخدام flag بسيط
const processing = new Set();

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design')) return;
    if (processing.has(message.author.id)) return;
    
    if (!message.member.roles.cache.has(ROLE_ID)) return message.reply('❌ ليس لديك الصلاحية.');
    if (message.attachments.size < 2) return message.reply('⚠️ يرجى إرفاق صورتين.');

    processing.add(message.author.id);
    const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
    
    try {
        const card = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        await targetChannel.send({ files: [card] });
    } catch (err) {
        console.error(err);
        message.reply('❌ خطأ في التصميم.');
    } finally {
        processing.delete(message.author.id);
    }
});

client.login(process.env.TOKEN);
