require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

const FONT_NAME = 'MyCustomFont';
// تأكد أن ملف الخط الجديد موجود باسم font.ttf في المجلد
const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, FONT_NAME);

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const PROFILE_CHANNEL_ID = '1501583456872829068'; 
const BUTTON_CHANNEL_ID = '1501583456872829068'; 
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
    
    // خلفية البروفايل
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 0, 0, 1000, 350); 
    
    // دائرة الأفاتار
    ctx.save();
    ctx.beginPath();
    ctx.arc(140, 350, 90, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0f0f0f';
    ctx.stroke();
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 50, 260, 180, 180);
    ctx.restore();

    // النصوص بالخط الجديد (Serif style)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 40px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, 260, 370);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `20px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 405);

    // الخط الفاصل
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(950, 480);
    ctx.stroke();

    // نصوص التاريخ
    ctx.fillStyle = '#777777';
    ctx.font = `bold 14px "${FONT_NAME}"`;
    ctx.fillText('MEMBER SINCE', 50, 520);
    ctx.fillText('JOINED SERVER', 550, 520);

    ctx.fillStyle = '#ffffff';
    ctx.font = `20px "${FONT_NAME}"`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 555);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 550, 555);

    return canvas;
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design') || isProcessing.has(message.author.id)) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return;
    if (message.attachments.size < 2) return;

    isProcessing.add(message.author.id);
    try {
        const canvas = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        const profileChannel = client.channels.cache.get(PROFILE_CHANNEL_ID);
        if (profileChannel) await profileChannel.send({ files: [attachment] });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('try_design').setLabel('Try').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678'),
            new ButtonBuilder().setCustomId('send_dm').setLabel('DM').setStyle(ButtonStyle.Secondary).setEmoji('1518609827599880253')
        );

        const buttonChannel = client.channels.cache.get(BUTTON_CHANNEL_ID);
        if (buttonChannel) await buttonChannel.send({ components: [row] });
        
        await message.delete().catch(() => {});
    } catch (err) {
        console.error(err);
    } finally {
        isProcessing.delete(message.author.id);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'try_design') {
        await interaction.reply({ content: '🎨 أرسل الصورتين مجدداً هنا للتجربة!', ephemeral: true });
    } else if (interaction.customId === 'send_dm') {
        try {
            const canvas = await createProfileCard(interaction.message.attachments.first()?.url || 'https://via.placeholder.com/150', 'https://via.placeholder.com/150', interaction.member);
            const buffer = await canvas.encode('png');
            await interaction.user.send({ files: [new AttachmentBuilder(buffer, { name: 'profile.png' })] });
            await interaction.reply({ content: '✅ تم الإرسال للخاص!', ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: '❌ افتح الخاص يا وحش!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
