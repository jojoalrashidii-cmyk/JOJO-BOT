require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

// --- إعداد الفونت ---
const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'MyCustomFont');
}
const FONT_NAME = 'MyCustomFont';

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const PROFILE_CHANNEL_ID = '1501583456872829068'; 
const BUTTON_CHANNEL_ID = '1501583456872829068'; 
const VOICE_CHANNEL_ID = '1518127536834613360'; // تأكد من الـ ID هنا
const ROLE_ID = '1501374221992071348';
const isProcessing = new Set();

// --- تفعيل الستريم والدخول للروم عند التشغيل ---
client.once(Events.ClientReady, async (c) => {
    console.log(`✅ البوت متصل: ${c.user.tag}`);
    
    // ضبط حالة الستريم
    client.user.setPresence({ 
        activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
        status: 'online' 
    });

    // الاتصال بالروم الصوتي
    const vc = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (vc) {
        joinVoiceChannel({
            channelId: vc.id,
            guildId: vc.guild.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
        });
        console.log('✅ تم الدخول للروم الصوتي!');
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
