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
} else {
    console.error('⚠️ تحذير: ملف font.ttf غير موجود في المجلد!');
}

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const TARGET_CHANNEL_ID = '1501583456872829068';
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';
const isProcessing = new Set();

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

// --- تم تحديث الإحداثيات هنا لتطابق صورتك تماماً ---
async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    // 1. الخلفية
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    // 2. البانر
    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 0, 0, 1000, 350); 

    // 3. دائرة الأفاتار (تداخل مع البانر)
    ctx.save();
    ctx.beginPath();
    ctx.arc(140, 350, 90, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0f0f'; // لون الحافة لدمجها مع الخلفية
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0f0f0f';
    ctx.stroke();
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 50, 260, 180, 180);
    ctx.restore();

    // 4. النصوص
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 40px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, 260, 370);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `20px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 405);

    // 5. الخط الفاصل
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(950, 480);
    ctx.stroke();

    // 6. نصوص التواريخ
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
    const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
    
    try {
        const canvas = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('try_design').setLabel('Try').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678'),
            new ButtonBuilder().setCustomId('send_dm').setLabel('DM').setStyle(ButtonStyle.Secondary).setEmoji('1518609827599880253')
        );

        if (targetChannel) {
            await targetChannel.send({ 
                files: [attachment],
                components: [row]
            });
        }
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
        await interaction.reply({ content: '🎨 أرسل الصورتين هنا للتجربة!', ephemeral: true });
    } else if (interaction.customId === 'send_dm') {
        try {
            const canvas = await createProfileCard(interaction.message.attachments.first().url, interaction.message.attachments.first().url, interaction.member);
            const buffer = await canvas.encode('png');
            await interaction.user.send({ 
                content: '📸 إليك تصميمك:', 
                files: [new AttachmentBuilder(buffer, { name: 'profile.png' })] 
            });
            await interaction.reply({ content: '✅ تم الإرسال للخاص!', ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: '❌ افتح الخاص يا وحش!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
