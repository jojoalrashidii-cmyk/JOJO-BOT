require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1518610511183478864/AkY2C6ye3hoq9iVm0OTJ4Ol-NucsVGBxQvjzGEOzxFjzSllBa4_sfU3PfqXQTG3jk3Xy';
const FONT_NAME = 'MyCustomFont';
const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, FONT_NAME);

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const TARGET_CHANNEL_ID = '1501583456872829068';
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';
const isProcessing = new Set();

function drawImageCover(ctx, img, x, y, width, height) {
    const ratio = Math.max(width / img.width, height / img.height);
    const sWidth = width / ratio;
    const sHeight = height / ratio;
    const sx = (img.width - sWidth) / 2;
    const sy = (img.height - sHeight) / 2;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
}

async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);
    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 30, 30, 940, 280); 
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 370, 85, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 65, 285, 170, 170);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 32px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, 260, 380);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `18px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 410);
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(950, 480);
    ctx.stroke();
    ctx.fillStyle = '#666666';
    ctx.font = `bold 12px "${FONT_NAME}"`;
    ctx.fillText('MEMBER SINCE', 50, 520);
    ctx.fillText('JOINED SERVER', 550, 520);
    ctx.fillStyle = '#ffffff';
    ctx.font = `16px "${FONT_NAME}"`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 550);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 550, 550);
    return canvas;
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design') || isProcessing.has(message.author.id)) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return message.reply('❌ ليس لديك الصلاحية.');
    if (message.attachments.size < 2) return message.reply('⚠️ يرجى إرفاق صورتين.');

    isProcessing.add(message.author.id);
    try {
        const canvas = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        // إرسال عبر الويب هوك
        await axios.post(WEBHOOK_URL, {
            embeds: [{
                color: 0x2A4660,
                image: { url: 'attachment://profile.png' },
                footer: { 
                    text: '7OJO3 Profiles || بروفايلات 7OJO3',
                    icon_url: 'https://cdn.discordapp.com/attachments/1501304755941675018/1518611094086750409/IMG_6674.png'
                }
            }]
        });

        // إرسال الأزرار في الروم
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('try_design').setLabel('Try').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678'),
            new ButtonBuilder().setCustomId('send_dm').setLabel('DM').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678')
        );

        await message.channel.send({ components: [row] });
        await message.reply('✅ تم إرسال تصميمك عبر الويب هوك.');
    } catch (err) {
        console.error(err);
        message.reply('❌ حدث خطأ.');
    } finally {
        isProcessing.delete(message.author.id);
    }
});

client.login(process.env.TOKEN);
